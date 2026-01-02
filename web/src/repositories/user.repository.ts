import api from '../lib/api';

export interface UserProfile {
    user: {
        id: string;
        username: string;
        email: string;
        role: string;
        createdAt: string;
    };
    solved: {
        EASY: number;
        MEDIUM: number;
        HARD: number;
        TOTAL: number;
    };
    submissions: {
        total: number;
        accepted: number;
        acceptanceRate: string;
    };
    tags: Array<{
        tag: string;
        count: number;
        percentage: string;
    }>;
}

export interface UserStats {
    solved: {
        EASY: number;
        MEDIUM: number;
        HARD: number;
        TOTAL: number;
    };
    submissions: {
        total: number;
        accepted: number;
        acceptanceRate: string;
    };
    tags: Array<{
        tag: string;
        count: number;
        percentage: string;
    }>;
}

export interface UserActivity {
    date: string;
    count: number;
}

export class UserRepository {
    // Fetches full profile including some stats (based on userService.getUserProfile)
    async getProfile(): Promise<UserProfile> {
        const response = await api.get('/users/profile');
        return response.data.data; // Assuming successResponse wrapper
    }

    // Fetches detailed stats
    async getStats(): Promise<UserStats> {
        const response = await api.get('/users/stats');
        return response.data.data;
    }

    // Fetches activity history
    async getActivity(): Promise<UserActivity[]> {
        const response = await api.get('/users/activity');
        return response.data.data;
    }

    async getLastAttemptedProblem(): Promise<{ id: string, title: string, slug: string, difficulty: string } | null> {
        const response = await api.get('/users/last-problem');
        return response.data.data ? response.data.data.problem : null;
    }
}

export const userRepository = new UserRepository();
