
import { Router } from "express";
import {
    createContest,
    getContest,
    getAllContests,
    addProblemToContest,
    registerForContest,
    deregisterForContest,
    getContestProblems
} from "../../controllers/contest.controller";
import { verifyToken, isAdmin, extractUser } from "../../middlewares/auth.middleware";

import { validate } from "../../middlewares/validate.middleware";
import {
    createContestSchema,
    addProblemToContestSchema,
    registerContestSchema,
    contestIdSchema
} from "../../dtos/contest.dto";

const contestRouter = Router();

contestRouter.post("/", verifyToken, isAdmin, validate(createContestSchema), createContest);
contestRouter.get("/", extractUser, getAllContests);
contestRouter.post("/add-problem", verifyToken, isAdmin, validate(addProblemToContestSchema), addProblemToContest);
contestRouter.get("/:id", extractUser, validate({ params: contestIdSchema }), getContest);
contestRouter.post("/:id/register", verifyToken, validate(registerContestSchema), registerForContest);
contestRouter.post("/:id/deregister", verifyToken, validate(registerContestSchema), deregisterForContest);
contestRouter.get("/:id/problems", verifyToken, validate({ params: contestIdSchema }), getContestProblems);

export default contestRouter;
