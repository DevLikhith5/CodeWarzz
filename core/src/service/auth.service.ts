import bcrypt from 'bcryptjs';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authRepository } from '../repository/auth.repository';
import { ConflictError, UnauthorizedError, BadRequestError } from '../utils/errors/app.error';
import { verifyIdToken } from '../utils/helpers/oAuth/verifyToken';
import logger from '../config/logger.config';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('CRITICAL: JWT_SECRET environment variable must be set to a 32+ char secret');
}
if (!REFRESH_SECRET || REFRESH_SECRET.length < 32) {
    throw new Error('CRITICAL: REFRESH_SECRET environment variable must be set to a 32+ char secret');
}

export class AuthService {
    private generateTokens(userId: string, role: string) {
        const accessToken = jwt.sign({ id: userId, role }, JWT_SECRET!, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET!, { expiresIn: '7d' });
        return { accessToken, refreshToken };
    }

    async signUp(username: string, email: string, password: string, role: string = 'user') {
        const existingUser = await authRepository.findUserByEmail(email);
        if (existingUser) {
            throw new ConflictError('User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role === 'admin' ? 'admin' : 'user';

        const newUser = await authRepository.createUser({
            username,
            email,
            passwordHash: hashedPassword,
            role: userRole,
        });

        return {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role
        };
    }

    async signIn(email: string, password: string) {
        const user = await authRepository.findUserByEmail(email);
        if (!user) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const tokens = this.generateTokens(user.id, user.role);
        await authRepository.updateRefreshToken(user.id, tokens.refreshToken);

        return {
            ...tokens,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        };
    }

    async refreshToken(token: string) {
        if (!token) {
            throw new BadRequestError('Refresh token required');
        }

        try {
            jwt.verify(token, REFRESH_SECRET!);
        } catch (error) {
            throw new UnauthorizedError('Invalid refresh token');
        }

        const user = await authRepository.findUserByRefreshToken(token);
        if (!user) {
            throw new UnauthorizedError('Invalid refresh token');
        }

        const tokens = this.generateTokens(user.id, user.role);
        await authRepository.updateRefreshToken(user.id, tokens.refreshToken);

        return {
            ...tokens,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        };
    }
    async googleCallBack(code: string) {
        const client_id = process.env.GOOGLE_CLIENT_ID;
        const client_secret = process.env.GOOGLE_CLIENT_SECRET;
        const redirect_uri = process.env.GOOGLE_REDIRECT_URI;

        if (!client_id || !client_secret || !redirect_uri) {
            throw new BadRequestError('Google OAuth is not configured');
        }

        const tokenUrl = 'https://oauth2.googleapis.com/token';

        try {
            const { data } = await axios.post(tokenUrl, {
                client_id,
                client_secret,
                code,
                grant_type: 'authorization_code',
                redirect_uri
            });

            const { id_token } = data;

            if (!id_token) {
                throw new UnauthorizedError('Google did not return an ID token');
            }

            const payload = await verifyIdToken(id_token);
            if (!payload || !payload.email) {
                throw new UnauthorizedError('Invalid Google ID token');
            }

            const { email, name } = payload;

            let user = await authRepository.findUserByEmail(email);

            if (!user) {
                // Sanitize the username: strip non-printable / control characters,
                // collapse whitespace, and truncate to 50 chars to fit the
                // varchar(50) column. Without this, a Google profile with
                // e.g. a long emoji-laden name or RTL marks would crash the
                // INSERT with a Postgres error.
                const rawName = name || email.split('@')[0];
                const sanitized = rawName
                    // strip control chars and non-printable unicode
                    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                    // collapse internal whitespace
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 50) || email.split('@')[0].slice(0, 50);

                // Use crypto.randomBytes for password generation. Math.random
                // is not cryptographically secure — predictable passwords for
                // unverified-account fallbacks are a security anti-pattern
                // even if the user can only log in via Google.
                const randomPassword = crypto.randomBytes(32).toString('hex');
                const hashedPassword = await bcrypt.hash(randomPassword, 10);

                user = await authRepository.createUser({
                    username: sanitized,
                    email,
                    passwordHash: hashedPassword,
                    role: 'user',
                });
            }

            const tokens = this.generateTokens(user.id, user.role);
            await authRepository.updateRefreshToken(user.id, tokens.refreshToken);

            return {
                ...tokens,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            };

        } catch (error) {
            if (axios.isAxiosError(error)) {
                logger.error("Google Auth Error:", { data: error.response?.data });
                throw new BadRequestError('Failed to authenticate with Google');
            }
            throw error;
        }
    }
}

export const authService = new AuthService();
