import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ForbiddenError } from '../utils/errors/app.error';

const CSRF_COOKIE_NAME = 'csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_BODY_FIELD = '_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection via the double-submit cookie pattern.
 *
 * 1. On any request, if the client has no `csrf` cookie, we issue one
 *    (random 32-byte token, not httpOnly so the SPA can read it and
 *    echo it in the `x-csrf-token` header).
 * 2. On state-changing requests (POST/PUT/PATCH/DELETE), the middleware
 *    requires the `csrf` cookie to match the `x-csrf-token` header (or
 *    the `_csrf` body field, for non-JSON form submissions).
 *
 * Endpoints exempt from CSRF:
 *   - Service-to-service calls (with `x-internal-api-key` header) — these
 *     are not browser-initiated.
 *   - Bearer-JWT auth (Authorization header) — the attacker cannot read
 *     a Bearer token cross-origin either.
 *   - Login / signup / OAuth callback / refresh — these endpoints issue
 *     or refresh the auth cookie itself and have their own CSRF
 *     protection (e.g. OAuth `state` parameter for callback).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
    // Issue a CSRF cookie if the client doesn't have one. This happens on
    // any request (including safe methods) so that by the time the SPA
    // makes a state-changing request, the cookie is already set.
    let cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (!cookieToken) {
        cookieToken = crypto.randomBytes(32).toString('hex');
        res.cookie(CSRF_COOKIE_NAME, cookieToken, {
            httpOnly: false, // SPA must read this
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            // Scope the CSRF cookie to the API only. This prevents it from
            // being sent on static-asset requests (which would still work
            // but is unnecessary surface area).
            path: '/api',
        });
    }

    // Safe methods don't need CSRF validation.
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    // Service-to-service calls bypass CSRF (they are not browser-driven).
    const internalKey = req.headers['x-internal-api-key'];
    if (internalKey && process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
        return next();
    }

    // Bearer-JWT auth bypasses CSRF for the same reason.
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
        return next();
    }

    // The /auth/login, /auth/signup, /auth/refresh, and /auth/google/*
    // endpoints are explicitly exempt because:
    //   - login/signup: the user does not yet have a session, and the
    //     Set-Cookie response would be issued AFTER CSRF validation. The
    //     SPA cannot read a CSRF cookie that doesn't exist yet.
    //   - refresh: the refresh cookie is the only auth credential; CSRF
    //     protection here would require the attacker to already have the
    //     refresh cookie, which they don't.
    //   - google callback: the OAuth `state` parameter provides its own
    //     CSRF protection.
    if (req.path.startsWith('/auth/')) {
        return next();
    }

    const headerToken = (req.headers[CSRF_HEADER_NAME] as string) || req.body?.[CSRF_BODY_FIELD];

    if (!headerToken || typeof headerToken !== 'string') {
        return next(new ForbiddenError('CSRF token missing'));
    }

    // Constant-time comparison to prevent timing attacks.
    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);
    if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
        return next(new ForbiddenError('CSRF token mismatch'));
    }

    next();
}
