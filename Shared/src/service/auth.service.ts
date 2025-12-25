import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRepository } from '../repository/auth.repository';
import { ConflictError, UnauthorizedError, BadRequestError } from '../utils/errors/app.error';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key_change_me';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'default_refresh_secret_key_change_me';

export class AuthService {
    private generateTokens(userId: string, role: string) {
        const accessToken = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '15m' });
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

        return tokens;
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

        return tokens;
    }
}

export const authService = new AuthService();
