
import { Router } from "express";
import {
    createContest,
    getContest,
    getAllContests,
    addProblemToContest,
    registerForContest,
    getContestProblems
} from "../../controllers/contest.controller";
import { verifyToken, isAdmin } from "../../middlewares/auth.middleware";

const contestRouter = Router();
console.log("HELLO")
contestRouter.post("/", verifyToken, isAdmin, createContest);
contestRouter.get("/", getAllContests);
contestRouter.post("/add-problem", verifyToken, isAdmin, addProblemToContest);
contestRouter.get("/:id", getContest);
contestRouter.post("/:id/register", verifyToken, registerForContest);
contestRouter.get("/:id/problems", verifyToken, getContestProblems);

export default contestRouter;
