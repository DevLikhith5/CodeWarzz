import { eq } from 'drizzle-orm';
import db from '../config/db';
import { users } from '../db/schema';

export type CreateUserParams = typeof users.$inferInsert;

import { observeDbQuery } from "../utils/metrics.utils";

export class AuthRepository {
    async findUserByEmail(email: string) {
        return await observeDbQuery('findUserByEmail', 'users', async () => {
            return await db.query.users.findFirst({
                where: eq(users.email, email)
            });
        });
    }

    async createUser(userData: CreateUserParams) {
        return await observeDbQuery('createUser', 'users', async () => {
            const [newUser] = await db.insert(users).values(userData).returning();
            return newUser;
        });
    }

    async updateRefreshToken(userId: string, refreshToken: string) {
        return await observeDbQuery('updateRefreshToken', 'users', async () => {
            await db.update(users).set({ refreshToken }).where(eq(users.id, userId));
        });
    }

    async findUserByRefreshToken(refreshToken: string) {
        return await observeDbQuery('findUserByRefreshToken', 'users', async () => {
            return await db.query.users.findFirst({
                where: eq(users.refreshToken, refreshToken)
            });
        });
    }
}

export const authRepository = new AuthRepository();
