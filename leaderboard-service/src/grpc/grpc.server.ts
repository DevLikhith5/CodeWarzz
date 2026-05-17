/**
 * gRPC server for the leaderboard service.
 *
 * Exposes LeaderboardService (UpdateLeaderboard, GetTopLeaderboard, GetUserRank)
 * so the evaluation-service-go can call leaderboard updates over gRPC instead
 * of publishing to RabbitMQ and waiting for the verdict consumer.
 *
 * This is the WRITE side of the CQRS pattern:
 *   - UpdateLeaderboard  → writes to Redis sorted set (Write Model)
 *   - Write model projection → async fan-out to Read Model (Redis Hash)
 *
 * Read operations (GetTopLeaderboard, GetUserRank) serve from the Read Model.
 *
 * Proto: ../../proto/codewarz.proto
 */

import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import logger from '../config/logger.config';
import { updateLeaderboard, getUserRank } from '../services/leaderboard.service';
import { leaderboardReadModelService } from '../services/leaderboard.readmodel.service';

const PROTO_PATH = path.resolve(__dirname, '../../../proto/codewarz.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
const codewarz = protoDescriptor.codewarz;

// ─── Handlers ────────────────────────────────────────────────────────────────

async function updateLeaderboardHandler(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>,
) {
    const { contestId, userId, score, timeTakenMs, contestEndTime } = call.request;
    const metadata = call.metadata.getMap();
    const correlationId = metadata['x-correlation-id'] || 'unknown';

    try {
        const result = await updateLeaderboard({
            contestId,
            userId,
            score: Number(score),
            timeTakenInMs: Number(timeTakenMs),
            contestEndTime: contestEndTime || undefined,
        });

        // ── CQRS write → project to read model asynchronously ──
        leaderboardReadModelService.project(contestId).catch((err: any) =>
            logger.error('Read model projection failed', { error: err.message, contestId, correlationId }),
        );

        logger.info('gRPC UpdateLeaderboard success', { contestId, userId, score, correlationId });

        callback(null, {
            success: true,
            contestId: result.contestId,
            userId: result.userId,
            score: result.score,
        });
    } catch (err: any) {
        logger.error('gRPC UpdateLeaderboard error', { error: err.message, correlationId });
        callback({ code: grpc.status.INTERNAL, message: err.message });
    }
}

async function getTopLeaderboardHandler(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>,
) {
    const { contestId, limit } = call.request;
    try {
        // Read from Read Model for 10x throughput
        const entries = await leaderboardReadModelService.getTop(contestId, limit || 50);
        callback(null, { contestId, entries });
    } catch (err: any) {
        logger.error('gRPC GetTopLeaderboard error', { error: err.message });
        callback({ code: grpc.status.INTERNAL, message: err.message });
    }
}

async function getUserRankHandler(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>,
) {
    const { contestId, userId } = call.request;
    try {
        const result = await getUserRank(contestId, userId);
        if (!result) {
            return callback(null, { found: false });
        }
        callback(null, {
            found: true,
            userId: result.userId,
            rank: result.rank,
            score: result.score,
            penaltyMinutes: result.penaltyMinutes,
        });
    } catch (err: any) {
        logger.error('gRPC GetUserRank error', { error: err.message });
        callback({ code: grpc.status.INTERNAL, message: err.message });
    }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export function startLeaderboardGRPCServer(port: number | string = 50052): grpc.Server {
    const server = new grpc.Server();

    server.addService(codewarz.LeaderboardService.service, {
        updateLeaderboard: updateLeaderboardHandler,
        getTopLeaderboard: getTopLeaderboardHandler,
        getUserRank: getUserRankHandler,
    });

    const addr = `0.0.0.0:${port}`;
    server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
        if (err) {
            logger.error('Failed to bind leaderboard gRPC server', { error: err.message });
            return;
        }
        logger.info('Leaderboard gRPC server listening', { addr: `0.0.0.0:${boundPort}` });
    });

    return server;
}
