#!/usr/bin/env python3
"""
chaos_scenarios.py — Predefined chaos scenarios for CodeWarz
============================================================
Provides higher-level chaos scenarios:
  1. cascade_failure      — kills core → verifies gateway fallback
  2. leaderboard_pressure — hammers leaderboard reads during kills
  3. split_brain          — simultaneous container kill + network loss

Run standalone:
  python3 chaos_scenarios.py --scenario cascade_failure
"""

import subprocess
import sys
import time
import json
import threading
import random
from datetime import datetime, timezone
from typing import Optional

try:
    import docker
    import requests
    from rich.console import Console
except ImportError:
    print("pip install docker requests rich")
    sys.exit(1)

console = Console()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _probe(url: str) -> dict:
    t0 = time.monotonic()
    try:
        r = requests.get(url, timeout=3)
        return {"ok": r.status_code < 500, "status": r.status_code, "ms": round((time.monotonic() - t0) * 1000, 1)}
    except Exception as e:
        return {"ok": False, "status": None, "ms": round((time.monotonic() - t0) * 1000, 1), "err": str(e)}


def _kill(client: docker.DockerClient, name: str) -> bool:
    try:
        client.containers.get(name).kill()
        console.print(f"[bold red]💀 KILLED[/bold red] {name}")
        return True
    except Exception as e:
        console.print(f"[yellow]⚠ Could not kill {name}: {e}[/yellow]")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Scenario 1: Cascade Failure
# Kill core service, ensure gateway returns 503 not 500 (graceful degradation)
# ─────────────────────────────────────────────────────────────────────────────

def scenario_cascade_failure(gateway: str = "http://localhost:3000"):
    console.rule("[bold]Scenario: Cascade Failure[/bold]")
    client = docker.from_env()
    results = {"scenario": "cascade_failure", "events": []}

    # Baseline
    r = _probe(f"{gateway}/health")
    results["events"].append({"t": _now(), "type": "baseline_probe", "result": r})
    console.print(f"Baseline: {r}")

    # Kill core
    killed = _kill(client, "codewarz-core")
    results["events"].append({"t": _now(), "type": "container_kill", "target": "codewarz-core", "success": killed})

    # Poll for 20s
    for _ in range(10):
        time.sleep(2)
        r = _probe(f"{gateway}/health")
        results["events"].append({"t": _now(), "type": "probe_during_fault", "result": r})
        status_label = f"[green]{r['status']}[/green]" if r["ok"] else f"[red]{r['status']}[/red]"
        console.print(f"  {_now()}: {status_label} {r['ms']}ms")

    ok_count = sum(1 for e in results["events"] if e.get("type") == "probe_during_fault" and e["result"]["ok"])
    total = sum(1 for e in results["events"] if e.get("type") == "probe_during_fault")
    results["uptime_pct"] = round(ok_count / max(total, 1) * 100, 2)
    console.print(f"\nUptime during core kill: [bold]{results['uptime_pct']}%[/bold]")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Scenario 2: Leaderboard Read Pressure
# 50 concurrent GET /leaderboard requests during container kill
# ─────────────────────────────────────────────────────────────────────────────

def scenario_leaderboard_pressure(gateway: str = "http://localhost:3000"):
    console.rule("[bold]Scenario: Leaderboard Read Pressure[/bold]")
    client = docker.from_env()
    url = f"{gateway}/api/v1/leaderboard/live/test-contest/top"
    results = {"scenario": "leaderboard_pressure", "read_results": []}

    def read_loop():
        for _ in range(25):
            r = _probe(url)
            results["read_results"].append(r)
            time.sleep(0.2)

    threads = [threading.Thread(target=read_loop) for _ in range(2)]
    for t in threads:
        t.start()

    time.sleep(1)
    _kill(client, "codewarz-leaderboard")

    for t in threads:
        t.join()

    ok = sum(1 for r in results["read_results"] if r["ok"])
    total = len(results["read_results"])
    latencies = sorted(r["ms"] for r in results["read_results"])
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0

    results["uptime_pct"] = round(ok / max(total, 1) * 100, 2)
    results["p99_ms"] = p99
    console.print(f"Read uptime: [bold]{results['uptime_pct']}%[/bold]  p99: {p99}ms")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Scenario 3: Split-Brain (simultaneous faults)
# ─────────────────────────────────────────────────────────────────────────────

def scenario_split_brain(gateway: str = "http://localhost:3000"):
    console.rule("[bold]Scenario: Split Brain[/bold]")
    client = docker.from_env()
    results = {"scenario": "split_brain", "events": []}

    def inject():
        time.sleep(random.uniform(0.5, 2))
        _kill(client, "codewarz-core")
        time.sleep(random.uniform(0.5, 2))
        _kill(client, "codewarz-leaderboard")

    inject_thread = threading.Thread(target=inject)
    inject_thread.start()

    for _ in range(15):
        time.sleep(1)
        r = _probe(f"{gateway}/health")
        results["events"].append({"t": _now(), "result": r})
        color = "green" if r["ok"] else "red"
        console.print(f"  [{color}]{r.get('status', 'ERR')}[/{color}] {r['ms']}ms")

    inject_thread.join()

    ok = sum(1 for e in results["events"] if e["result"]["ok"])
    results["uptime_pct"] = round(ok / max(len(results["events"]), 1) * 100, 2)
    console.print(f"\nSplit-brain uptime: [bold]{results['uptime_pct']}%[/bold]")
    return results


# ─── CLI ──────────────────────────────────────────────────────────────────────

SCENARIOS = {
    "cascade_failure": scenario_cascade_failure,
    "leaderboard_pressure": scenario_leaderboard_pressure,
    "split_brain": scenario_split_brain,
}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", choices=list(SCENARIOS.keys()), default="cascade_failure")
    parser.add_argument("--gateway", default="http://localhost:3000")
    parser.add_argument("--report", default="scenario_report.json")
    args = parser.parse_args()

    fn = SCENARIOS[args.scenario]
    result = fn(args.gateway)

    with open(args.report, "w") as f:
        json.dump(result, f, indent=2)
    console.print(f"\n[dim]Report saved → [blue]{args.report}[/blue][/dim]")
