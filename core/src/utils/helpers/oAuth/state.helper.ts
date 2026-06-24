import crypto from "crypto";
import { Request, Response } from "express";

export class StateHelper {
    static generateStateToken() {
        return crypto.randomBytes(32).toString("hex");
    }

    static setStateCookie(res: Response) {
        const stateToken = this.generateStateToken();

        res.cookie("state", stateToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "strict",
            path: "/",
            maxAge: 5 * 60 * 1000,
        });

        return stateToken;
    }

    static getStateCookie(req: Request) {
        return req.cookies.state;
    }
}
