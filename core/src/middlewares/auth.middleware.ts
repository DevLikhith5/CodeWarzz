import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors/app.error';


declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                role: string;
            };
        }
    }
}

const JWT_SECRET = process.env.JWT_SECRET;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('CRITICAL: JWT_SECRET environment variable must be set to a 32+ char secret');
}
if (!INTERNAL_API_KEY || INTERNAL_API_KEY.length < 16) {
    throw new Error('CRITICAL: INTERNAL_API_KEY environment variable must be set to a 16+ char secret');
}

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }
    if (!token) {
        return next(new UnauthorizedError('No token provided'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
        req.user = decoded;
        next();
    } catch (error) {
        return next(new UnauthorizedError('Invalid token'));
    }
};

export const verifyInternalOrUser = async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-internal-api-key'];
    // If the header is present, it MUST match the internal key exactly.
    // A wrong key is treated as a forbidden attempt to impersonate a service,
    // NOT as a request to fall through to user-JWT auth.
    if (apiKey) {
        if (apiKey === INTERNAL_API_KEY) {
            req.user = { id: 'system', role: 'system' };
            return next();
        }
        return next(new ForbiddenError('Invalid internal API key'));
    }
    return verifyToken(req, res, next);
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'admin') {
        return next(new ForbiddenError('Access denied. Admins only.'));
    }
    next();
};

export const extractUser = async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
        req.user = decoded;
        next();
    } catch (error) {
        // Public routes using extractUser must not reject requests with stale
        // or invalid tokens — they should fall back to anonymous. The frontend
        // refresh flow handles re-authentication for protected routes.
        return next();
    }
};
