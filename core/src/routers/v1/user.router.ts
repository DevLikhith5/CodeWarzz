import { Router } from "express";
import { getProfileController, getStatsController, getActivityController, getLastAttemptedProblemController, getGlobalLeaderboardController } from "../../controllers/user.controller";
import { verifyToken } from "../../middlewares/auth.middleware";

const userRouter = Router();

userRouter.get("/profile", verifyToken, getProfileController);
userRouter.get("/stats", verifyToken, getStatsController);
userRouter.get("/activity", verifyToken, getActivityController);
userRouter.get("/last-problem", verifyToken, getLastAttemptedProblemController);
userRouter.get("/leaderboard/global", getGlobalLeaderboardController); // Public route, no verifyToken strictly needed but maybe good for tracking? User said "fetch from api". Let's maximize access. Or make it public.

export default userRouter;
