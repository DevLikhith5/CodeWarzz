import { Router } from "express";
import { snapshotLeaderboard, getArchivedLeaderboardController } from "../../controllers/leaderboard.controller";
import { verifyToken, isAdmin } from "../../middlewares/auth.middleware";

const leaderboardRouter = Router();

leaderboardRouter.post("/snapshot", verifyToken, isAdmin, snapshotLeaderboard);
leaderboardRouter.get("/archive/:contestId", verifyToken, getArchivedLeaderboardController);

export default leaderboardRouter;
