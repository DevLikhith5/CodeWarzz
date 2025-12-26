import { eq } from 'drizzle-orm';
import db from '../config/db';
import { users } from '../db/schema';

export type CreateUserParams = typeof users.$inferInsert;

export class AuthRepository {
    async findUserByEmail(email: string) {
        return await db.query.users.findFirst({
            where: eq(users.email, email)
        });
    }

    async createUser(userData: CreateUserParams) {
        const [newUser] = await db.insert(users).values(userData).returning();
        return newUser;
    }

    async updateRefreshToken(userId: string, refreshToken: string) {
        await db.update(users).set({ refreshToken }).where(eq(users.id, userId));
    }

    async findUserByRefreshToken(refreshToken: string) {
        return await db.query.users.findFirst({
            where: eq(users.refreshToken, refreshToken)
        });
    }
}

export const authRepository = new AuthRepository();
