/**
 * @file app.error.ts
 */

/**
 * Interface representing a custom application error.
 */
export interface AppError extends Error {
    statusCode: number;
}

/**
 * Type guard: an object is an AppError iff it is an Error with a numeric
 * statusCode in the HTTP range. Use this in middleware instead of duck-typing
 * on `err.statusCode` (which lies when a plain Error is passed in).
 */
export function isAppError(err: unknown): err is AppError {
    return (
        err instanceof Error &&
        'statusCode' in err &&
        typeof (err as { statusCode: unknown }).statusCode === 'number' &&
        (err as { statusCode: number }).statusCode >= 400 &&
        (err as { statusCode: number }).statusCode < 600
    );
}


/**
 * Represents an internal server error.
 * Extends Error to ensure `instanceof Error` checks and stack traces work correctly.
 */
export class InternalServerError extends Error implements AppError {
    statusCode: number = 500;
    constructor(message: string) {
        super(message);
        this.name = "InternalServerError";
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}

/**
 * Represents a Bad Request error (HTTP 400).
 * This error is typically used to indicate that the server cannot process the request
 * due to client-side issues such as invalid input or malformed request syntax.
 */
export class BadRequestError extends Error implements AppError {
    statusCode: number = 400;
    constructor(message: string) {
        super(message);
        this.name = "BadRequestError";
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}

/**
 * Represents a "Not Found" error.
 * This error is typically used to indicate that a requested resource could not be found.
 */
export class NotFoundError extends Error implements AppError {
    statusCode: number = 404;
    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

/**
 * Represents an Unauthorized error (HTTP 401).
 * This error is typically used to indicate that the request requires user authentication.
 */
export class UnauthorizedError extends Error implements AppError {
    statusCode: number = 401;
    constructor(message: string) {
        super(message);
        this.name = "UnauthorizedError";
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}


/**
 * Represents a Forbidden error (HTTP 403).
 * This error is typically used to indicate that the server understands the request
 * but refuses to authorize it.
 */
export class ForbiddenError extends Error implements AppError {
    statusCode: number = 403;
    constructor(message: string) {
        super(message);
        this.name = "ForbiddenError";
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}

/**
 * Represents a Conflict error (HTTP 409).
 * This error is typically used to indicate that the request could not be completed
 * due to a conflict with the current state of the target resource.
 */
export class ConflictError extends Error implements AppError {
    statusCode: number = 409;
    constructor(message: string) {
        super(message);
        this.name = "ConflictError";
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

/**
 * Represents an error for unimplemented functionality.
 */
export class NotImplementedError extends Error implements AppError {
    statusCode: number = 501;
    constructor(message: string) {
        super(message);
        this.name = "NotImplementedError";
        Object.setPrototypeOf(this, NotImplementedError.prototype);
    }
}
