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
 * Represents a "Not Found" error (HTTP 404).
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
 * Represents an error for unimplemented functionality (HTTP 501).
 */
export class NotImplementedError extends Error implements AppError {
    statusCode: number = 501;
    constructor(message: string) {
        super(message);
        this.name = "NotImplementedError";
        Object.setPrototypeOf(this, NotImplementedError.prototype);
    }
}
