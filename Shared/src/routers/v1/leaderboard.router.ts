import { Router } from "express";
import { snapshotLeaderboard } from "../../controllers/leaderboard.controller";

const leaderboardRouter = Router();

leaderboardRouter.post("/snapshot", snapshotLeaderboard);

export default leaderboardRouter;
