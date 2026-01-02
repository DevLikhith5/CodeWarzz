import { Router } from "express";
import { snapshotLeaderboard, getArchivedLeaderboardController } from "../../controllers/leaderboard.controller";

const leaderboardRouter = Router();

leaderboardRouter.post("/snapshot", snapshotLeaderboard);
leaderboardRouter.get("/archive/:contestId", getArchivedLeaderboardController);

export default leaderboardRouter;
