import { RequestHandler } from "express";
import {
  updateLeaderboard,
  getTopLeaderboard,
  getUserRank,
} from "../services/leaderboard.service";

export const leaderboardController = {
  upsertLeaderboard: (async (req, res) => {
    try {
      const { userId, contestId, score, timeTakenInMs } = req.body;

      if (
        !userId ||
        !contestId ||
        score === undefined ||
        timeTakenInMs === undefined
      ) {
        res.status(400).json({ message: "Missing fields" });
        return;
      }

      const result = await updateLeaderboard({
        userId,
        contestId,
        score,
        timeTakenInMs,
      });

      res.status(200).json({
        message: "Leaderboard updated",
        ...result,
      });
      return;
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }
  }) as RequestHandler,

  getTopLeaderboard: (async (req, res) => {
    try {
      const { contestId } = req.params;
      const limit = Number(req.query.limit) || 50;

      const leaderboard = await getTopLeaderboard(contestId, limit);

      res.json({ contestId, leaderboard });
      return;
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
      return;
    }
  }) as RequestHandler,

  getUserRank: (async (req, res) => {
    try {
      const { contestId, userId } = req.params;

      const result = await getUserRank(contestId, userId);

      if (!result) {
        res.status(404).json({ message: "User not ranked" });
        return;
      }

      res.json(result);
      return;
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
      return;
    }
  }) as RequestHandler,
};
