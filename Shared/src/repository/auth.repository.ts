import { eq } from 'drizzle-orm';
import  db  from '../config/db';
import { users } from '../db/schema';

export type CreateUserParams = typeof users.$inferInsert;

export class AuthRepository {
    async findUserByEmail(email: string) {
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        return user;
    }

    async createUser(userData: CreateUserParams) {
        const [newUser] = await db.insert(users).values(userData).returning();
        return newUser;
    }

    async updateRefreshToken(userId: string, refreshToken: string) {
        await db.update(users).set({ refreshToken }).where(eq(users.id, userId));
    }

    async findUserByRefreshToken(refreshToken: string) {
        const [user] = await db.select().from(users).where(eq(users.refreshToken, refreshToken)).limit(1);
        return user;
    }
}

export const authRepository = new AuthRepository();
