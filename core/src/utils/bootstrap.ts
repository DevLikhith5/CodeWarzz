/**
 * Process-level safety net for Node.js services.
 *
 * Provides two things every CodeWarz service needs:
 *
 *  1. `installProcessSafetyNet()` — registers `uncaughtException` and
 *     `unhandledRejection` handlers so an escaped async error logs a
 *     structured event + bumps a metric before the process exits with
 *     code 1. Without this, Node's default behavior is to die silently
 *     and the orchestrator cannot distinguish "clean restart" from
 *     "bug-induced crash".
 *
 *  2. `gracefulShutdown(name, serverHandle, ...cleanups)` — a single
 *     async function that runs a list of cleanup callbacks in order,
 *     tracks whether each one succeeded, and exits with code 0 only
 *     if every cleanup succeeded (else 1).
 *
 * Usage in a service's server.ts:
 *
 *     import { installProcessSafetyNet, gracefulShutdown } from '../../core/src/utils/bootstrap';
 *     installProcessSafetyNet('core');
 *
 *     const shutdown = (signal: string) =>
 *         gracefulShutdown('core', signal, [httpServer, grpcServer], [
 *             () => rabbitMQ.close(),
 *             () => stopCDCListener(),
 *         ]);
 *     process.on('SIGTERM', () => void shutdown('SIGTERM'));
 *     process.on('SIGINT',  () => void shutdown('SIGINT'));
 */

import logger from '../config/logger.config';
import { metricsService } from '../service/metrics.service';

let safetyNetInstalled = false;

export function installProcessSafetyNet(serviceName: string): void {
    if (safetyNetInstalled) return;
    safetyNetInstalled = true;

    process.on('uncaughtException', (err: Error) => {
        logger.error(`[${serviceName}] Uncaught exception — forcing shutdown`, {
            error: err.message,
            stack: err.stack,
            name: err.name,
        });
        try {
            metricsService.getAppErrorsTotal().inc({
                type: 'UncaughtException',
                code: 500,
            });
        } catch {
            // metrics unavailable — do not mask the original error
        }
        // Give the logger a tick to flush before exiting.
        setTimeout(() => process.exit(1), 50).unref();
    });

    process.on('unhandledRejection', (reason: unknown) => {
        const err =
            reason instanceof Error
                ? reason
                : new Error(typeof reason === 'string' ? reason : 'Non-error rejection');

        logger.error(`[${serviceName}] Unhandled promise rejection — forcing shutdown`, {
            error: err.message,
            stack: err.stack,
            name: err.name,
        });
        try {
            metricsService.getAppErrorsTotal().inc({
                type: 'UnhandledRejection',
                code: 500,
            });
        } catch {
            // metrics unavailable
        }
        setTimeout(() => process.exit(1), 50).unref();
    });

    logger.info(`[${serviceName}] Process safety net installed (uncaughtException + unhandledRejection)`);
}

type Cleanup = () => unknown | Promise<unknown>;
type ServerHandle = { close: (cb?: (err?: Error) => void) => void } | undefined | null;

const SHUTDOWN_TIMEOUT_MS = 15_000;

export async function gracefulShutdown(
    serviceName: string,
    signal: string,
    servers: ServerHandle[],
    cleanups: Cleanup[]
): Promise<void> {
    logger.info(`[${serviceName}] Received ${signal}, shutting down gracefully...`);

    let allSucceeded = true;

    const safeRun = async (label: string, fn: () => unknown | Promise<unknown>) => {
        try {
            await fn();
            logger.debug(`[${serviceName}] Cleanup ok: ${label}`);
        } catch (err: any) {
            allSucceeded = false;
            logger.error(`[${serviceName}] Cleanup failed: ${label}`, { error: err.message });
        }
    };

    // Wrap the entire shutdown in a hard timeout so a stuck cleanup does
    // not prevent the orchestrator from restarting the pod.
    const timer = setTimeout(() => {
        logger.error(`[${serviceName}] Shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    // 1. Stop accepting new HTTP/gRPC traffic first.
    for (const server of servers) {
        if (server && typeof server.close === 'function') {
            await safeRun('server.close', () => new Promise<void>((resolve) => server.close(() => resolve())));
        }
    }

    // 2. Run the service-specific cleanups in order.
    for (const cleanup of cleanups) {
        await safeRun(cleanup.name || 'anonymous', cleanup);
    }

    const code = allSucceeded ? 0 : 1;
    if (!allSucceeded) {
        logger.error(`[${serviceName}] One or more cleanups failed — exiting with code ${code}`);
    }
    process.exit(code);
}
