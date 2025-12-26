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

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key_change_me';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'default_internal_key';

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new UnauthorizedError('No token provided'));
    }

    const token = authHeader.split(' ')[1];

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
    if (apiKey && apiKey === INTERNAL_API_KEY) {
        return next();
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
        req.user = decoded;
    } catch (error) {
        // Ignore invalid token, treated as guest
    }
    next();
};
