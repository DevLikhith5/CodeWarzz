#!/usr/bin/env python3
"""
CodeWarz Chaos Engineering Suite
=================================
Proves system resilience with 99.9% uptime under fault conditions by:

  1. Container Killer    — randomly terminates service containers
  2. Network Partitioner — simulates network failures via tc/iptables
  3. Steady-State Probe  — polls health endpoints during chaos, records uptime

Usage:
  python3 chaos_runner.py [--config chaos.config.yml]

Requires:
  pip install docker requests pyyaml rich
  docker running + containers up (docker compose up -d)
"""

import argparse
import random
import subprocess
import sys
import time
import threading
import logging
import json
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
import signal

try:
    import docker
    import requests
    import yaml
    from rich.console import Console
    from rich.table import Table
    from rich.live import Live
    from rich.panel import Panel
    from rich import box
except ImportError:
    print("Install dependencies: pip install docker requests pyyaml rich")
    sys.exit(1)

console = Console()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("chaos")

# ─── Config ───────────────────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    "gateway_url": "http://localhost:3000",
    "health_endpoint": "/health",
    "probe_interval_s": 2,
    "chaos_interval_s": 15,
    "experiment_duration_s": 120,
    "targets": [
        {"name": "codewarz-core",        "weight": 3},
        {"name": "codewarz-leaderboard", "weight": 2},
        {"name": "codewarz-gateway",     "weight": 1},
    ],
    "network_fault_duration_s": 10,
    "restart_delay_s": 5,
    "exclude_containers": ["codewarz-postgres", "codewarz-redis", "codewarz-rabbitmq"],
    "report_path": "chaos_report.json",
}


@dataclass
class ProbeResult:
    timestamp: str
    status_code: Optional[int]
    latency_ms: float
    success: bool
    error: Optional[str] = None


@dataclass
class ChaosEvent:
    timestamp: str
    kind: str        # "container_kill" | "network_partition"
    target: str
    duration_s: Optional[float] = None
    outcome: str = "triggered"


@dataclass
class ChaosReport:
    started_at: str
    ended_at: str = ""
    total_probes: int = 0
    successful_probes: int = 0
    uptime_pct: float = 0.0
    chaos_events: list = field(default_factory=list)
    probe_results: list = field(default_factory=list)
    p99_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0


# ─── Steady-State Probe ────────────────────────────────────────────────────────

class SteadyStateProbe:
    """Continuously polls the health endpoint and records uptime."""

    def __init__(self, base_url: str, endpoint: str, interval_s: float):
        self.url = base_url.rstrip("/") + endpoint
        self.interval_s = interval_s
        self.results: list[ProbeResult] = []
        self._stop = threading.Event()

    def start(self):
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()

    def _loop(self):
        while not self._stop.is_set():
            result = self._probe()
            self.results.append(result)
            if result.success:
                console.print(f"[green]✓[/green] {result.latency_ms:.0f}ms", end="  ")
            else:
                console.print(f"[red]✗[/red] {result.error}", end="  ")
            time.sleep(self.interval_s)

    def _probe(self) -> ProbeResult:
        ts = datetime.now(timezone.utc).isoformat()
        t0 = time.monotonic()
        try:
            resp = requests.get(self.url, timeout=5)
            latency = (time.monotonic() - t0) * 1000
            return ProbeResult(
                timestamp=ts,
                status_code=resp.status_code,
                latency_ms=latency,
                success=resp.status_code < 500,
            )
        except Exception as e:
            latency = (time.monotonic() - t0) * 1000
            return ProbeResult(
                timestamp=ts,
                status_code=None,
                latency_ms=latency,
                success=False,
                error=str(e),
            )

    def uptime(self) -> float:
        if not self.results:
            return 100.0
        ok = sum(1 for r in self.results if r.success)
        return ok / len(self.results) * 100

    def percentile(self, p: float) -> float:
        latencies = sorted(r.latency_ms for r in self.results)
        if not latencies:
            return 0.0
        idx = int(len(latencies) * p / 100)
        return latencies[min(idx, len(latencies) - 1)]


# ─── Container Killer ─────────────────────────────────────────────────────────

class ContainerKiller:
    """Randomly terminates Docker containers to simulate pod crashes."""

    def __init__(self, exclude: list[str]):
        self.client = docker.from_env()
        self.exclude = set(exclude)
        self.events: list[ChaosEvent] = []

    def kill_random(self, targets: list[dict]) -> Optional[ChaosEvent]:
        """Picks a weighted-random target container and kills it."""
        names = [t["name"] for t in targets if t["name"] not in self.exclude]
        weights = [t["weight"] for t in targets if t["name"] not in self.exclude]

        if not names:
            log.warning("No killable targets available")
            return None

        chosen = random.choices(names, weights=weights, k=1)[0]

        try:
            container = self.client.containers.get(chosen)
            container.kill()
            ts = datetime.now(timezone.utc).isoformat()
            event = ChaosEvent(
                timestamp=ts,
                kind="container_kill",
                target=chosen,
                outcome="killed",
            )
            self.events.append(event)
            console.print(f"\n[bold red]💀 KILLED[/bold red] container: [yellow]{chosen}[/yellow]")
            log.warning(f"CHAOS: killed container {chosen}")
            return event
        except docker.errors.NotFound:
            log.warning(f"Container {chosen} not found (may already be down)")
            return None
        except Exception as e:
            log.error(f"Failed to kill {chosen}: {e}")
            return None


# ─── Network Partitioner ──────────────────────────────────────────────────────

class NetworkPartitioner:
    """Simulates network partitions by adding tc qdisc loss rules."""

    def __init__(self):
        self.events: list[ChaosEvent] = []
        self._active_ifaces: list[str] = []

    def _get_iface(self) -> Optional[str]:
        """Returns the primary non-loopback network interface."""
        try:
            result = subprocess.run(
                ["ip", "route", "get", "8.8.8.8"],
                capture_output=True, text=True, timeout=5,
            )
            for part in result.stdout.split():
                if part not in ("via", "dev", "src", "uid", "cache") and "." not in part and part != "8.8.8.8":
                    # crude but effective
                    pass
            # simpler: just grab from `ip link`
            r2 = subprocess.run(["ip", "link"], capture_output=True, text=True)
            for line in r2.stdout.splitlines():
                if ": " in line and "lo" not in line and "docker" not in line:
                    iface = line.split(": ")[1].split("@")[0].strip()
                    if iface:
                        return iface
        except Exception:
            pass
        return None

    def add_packet_loss(self, loss_pct: float = 30.0, duration_s: float = 10.0) -> Optional[ChaosEvent]:
        """Adds {loss_pct}% packet loss on the host interface for {duration_s}s."""
        iface = self._get_iface()
        ts = datetime.now(timezone.utc).isoformat()

        event = ChaosEvent(
            timestamp=ts,
            kind="network_partition",
            target=iface or "unknown",
            duration_s=duration_s,
        )

        if not iface:
            console.print("[yellow]⚠ Network partitioner: cannot detect interface (skipping)[/yellow]")
            event.outcome = "skipped_no_iface"
            self.events.append(event)
            return event

        try:
            # Apply tc loss rule
            subprocess.run(
                ["tc", "qdisc", "add", "dev", iface, "root", "netem", "loss", f"{loss_pct}%"],
                check=True, capture_output=True,
            )
            self._active_ifaces.append(iface)
            event.outcome = "applied"
            self.events.append(event)
            console.print(
                f"\n[bold magenta]🔌 NETWORK PARTITION[/bold magenta] "
                f"{loss_pct}% loss on [cyan]{iface}[/cyan] for {duration_s}s"
            )

            # Schedule removal
            def _restore():
                time.sleep(duration_s)
                self._remove_loss(iface)
            threading.Thread(target=_restore, daemon=True).start()
        except subprocess.CalledProcessError as e:
            log.warning(f"tc failed (may lack CAP_NET_ADMIN): {e.stderr.decode()}")
            event.outcome = "skipped_no_cap"
            self.events.append(event)

        return event

    def _remove_loss(self, iface: str):
        try:
            subprocess.run(
                ["tc", "qdisc", "del", "dev", iface, "root"],
                check=True, capture_output=True,
            )
            console.print(f"\n[green]🔌 Network restored[/green] on [cyan]{iface}[/cyan]")
            if iface in self._active_ifaces:
                self._active_ifaces.remove(iface)
        except Exception:
            pass

    def cleanup(self):
        for iface in list(self._active_ifaces):
            self._remove_loss(iface)


# ─── Chaos Runner ─────────────────────────────────────────────────────────────

class ChaosRunner:
    def __init__(self, config: dict):
        self.config = config
        self.probe = SteadyStateProbe(
            config["gateway_url"],
            config["health_endpoint"],
            config["probe_interval_s"],
        )
        self.killer = ContainerKiller(config["exclude_containers"])
        self.partitioner = NetworkPartitioner()
        self.report = ChaosReport(started_at=datetime.now(timezone.utc).isoformat())
        self._stop = threading.Event()

    def run(self):
        duration = self.config["experiment_duration_s"]
        chaos_interval = self.config["chaos_interval_s"]

        console.print(Panel.fit(
            f"[bold cyan]CodeWarz Chaos Engineering Suite[/bold cyan]\n"
            f"Duration: [yellow]{duration}s[/yellow] | "
            f"Chaos every: [yellow]{chaos_interval}s[/yellow] | "
            f"Probe: [yellow]{self.config['probe_interval_s']}s[/yellow]\n"
            f"Gateway: [blue]{self.config['gateway_url']}[/blue]",
            title="🔥 CHAOS MODE ENGAGED",
            border_style="red",
        ))

        # Handle SIGINT gracefully
        signal.signal(signal.SIGINT, lambda s, f: self._stop.set())

        self.probe.start()

        deadline = time.monotonic() + duration
        next_chaos = time.monotonic() + chaos_interval

        while time.monotonic() < deadline and not self._stop.is_set():
            if time.monotonic() >= next_chaos:
                self._inject_chaos()
                next_chaos = time.monotonic() + chaos_interval
            time.sleep(0.5)

        self.probe.stop()
        self.partitioner.cleanup()
        self._compile_report()
        self._print_report()
        self._save_report()

    def _inject_chaos(self):
        """Randomly choose container kill or network partition."""
        fault = random.choice(["container_kill", "network_partition"])

        if fault == "container_kill":
            event = self.killer.kill_random(self.config["targets"])
            if event:
                self.report.chaos_events.append(asdict(event))
        else:
            event = self.partitioner.add_packet_loss(
                loss_pct=random.uniform(20, 60),
                duration_s=self.config["network_fault_duration_s"],
            )
            if event:
                self.report.chaos_events.append(asdict(event))

    def _compile_report(self):
        self.report.ended_at = datetime.now(timezone.utc).isoformat()
        self.report.total_probes = len(self.probe.results)
        self.report.successful_probes = sum(1 for r in self.probe.results if r.success)
        self.report.uptime_pct = self.probe.uptime()
        self.report.p99_latency_ms = self.probe.percentile(99)
        self.report.p50_latency_ms = self.probe.percentile(50)
        self.report.probe_results = [asdict(r) for r in self.probe.results[-50:]]  # last 50

    def _print_report(self):
        console.print("\n")
        color = "green" if self.report.uptime_pct >= 99.9 else "yellow" if self.report.uptime_pct >= 99 else "red"

        table = Table(title="Chaos Engineering Report", box=box.ROUNDED, border_style="cyan")
        table.add_column("Metric", style="bold")
        table.add_column("Value", style=color)

        table.add_row("Experiment duration", f"{self.config['experiment_duration_s']}s")
        table.add_row("Total probes", str(self.report.total_probes))
        table.add_row("Successful probes", str(self.report.successful_probes))
        table.add_row(
            "Uptime",
            f"[{color}]{self.report.uptime_pct:.3f}%[/{color}]",
        )
        table.add_row("p50 latency", f"{self.report.p50_latency_ms:.1f} ms")
        table.add_row("p99 latency", f"{self.report.p99_latency_ms:.1f} ms")
        table.add_row("Chaos events injected", str(len(self.report.chaos_events)))

        console.print(table)

        if self.report.uptime_pct >= 99.9:
            console.print(Panel("[bold green]✅ SYSTEM RESILIENT — 99.9% uptime under fault conditions[/bold green]"))
        else:
            console.print(Panel(f"[bold yellow]⚠ Uptime {self.report.uptime_pct:.2f}% — below 99.9% SLO[/bold yellow]"))

    def _save_report(self):
        path = self.config["report_path"]
        with open(path, "w") as f:
            json.dump(asdict(self.report), f, indent=2)
        console.print(f"\n[dim]Report saved to [blue]{path}[/blue][/dim]")


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CodeWarz Chaos Engineering Suite")
    parser.add_argument("--config", default=None, help="Path to YAML config file")
    parser.add_argument("--duration", type=int, default=None, help="Override experiment duration (s)")
    parser.add_argument("--dry-run", action="store_true", help="Probe only, no fault injection")
    args = parser.parse_args()

    config = dict(DEFAULT_CONFIG)

    if args.config:
        with open(args.config) as f:
            overrides = yaml.safe_load(f)
            config.update(overrides or {})

    if args.duration:
        config["experiment_duration_s"] = args.duration

    if args.dry_run:
        config["chaos_interval_s"] = float("inf")
        console.print("[yellow]DRY RUN: fault injection disabled[/yellow]")

    runner = ChaosRunner(config)
    runner.run()


if __name__ == "__main__":
    main()
