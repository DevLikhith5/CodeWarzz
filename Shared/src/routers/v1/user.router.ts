import { Router } from "express";
import { getProfileController, getStatsController, getActivityController } from "../../controllers/user.controller";
import { verifyToken } from "../../middlewares/auth.middleware";

const userRouter = Router();

userRouter.get("/profile", verifyToken, getProfileController);
userRouter.get("/stats", verifyToken, getStatsController);
userRouter.get("/activity", verifyToken, getActivityController);

export default userRouter;
