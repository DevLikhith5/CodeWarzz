import { publishVerdict } from '../../../../core/src/queues/rabbitmq';

export interface LeaderboardJobPayload {
  submissionId: string;
  contestId: string;
  userId: string;
  score: number;
  contestEndTime?: string | number;
}

export async function pushToLeaderboardQueue(payload: LeaderboardJobPayload) {
  await publishVerdict(payload, {
    correlationId: payload.submissionId,
  });
}
