import bcrypt from 'bcryptjs';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { authRepository } from '../repository/auth.repository';
import { ConflictError, UnauthorizedError, BadRequestError } from '../utils/errors/app.error';
import { verifyIdToken } from '../utils/helpers/oAuth/verifyToken';

const JWT_SECRET = process.env.JWT_SECRET || 'JWT_SECRET';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'REFRESH_SECRET';

export class AuthService {
    private generateTokens(userId: string, role: string) {
        const accessToken = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1m' });
        const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: '7d' });
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
            jwt.verify(token, REFRESH_SECRET);
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

            const payload = await verifyIdToken(id_token);
            if (payload == undefined || payload.email == undefined) {
                throw new UnauthorizedError('Invalid token');
            }

            const { email, name } = payload;
            

            let user = await authRepository.findUserByEmail(email);

            if (!user) {
                const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
                const hashedPassword = await bcrypt.hash(randomPassword, 10);

                user = await authRepository.createUser({
                    username: name || email.split('@')[0],
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
                console.error("Google Auth Error:", error.response?.data);
                throw new BadRequestError('Failed to authenticate with Google');
            }
            throw error;
        }
    }
}

export const authService = new AuthService();
