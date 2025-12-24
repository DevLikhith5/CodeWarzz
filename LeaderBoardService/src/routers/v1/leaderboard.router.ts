import { Router } from "express";
import { leaderboardController } from "../../controllers/leaderboard.controller";

const router = Router();


router.post(
  "/update",
    leaderboardController.upsertLeaderboard
);


router.get(
  "/contest/:contestId/top",
  leaderboardController.getTopLeaderboard
);

router.get(
  "/contest/:contestId/user/:userId",
  leaderboardController.getUserRank
);

export default router;
