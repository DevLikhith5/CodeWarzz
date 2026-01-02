import api from '../lib/api';

export interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    createdAt?: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user?: User;
}

export class AuthRepository {
    static async signup(data: any): Promise<AuthResponse> {
        const response = await api.post('/auth/signup', data);
        return response.data; // Assuming wrapper response structure matches
    }

    static async signin(data: any): Promise<AuthResponse> {
        const response = await api.post('/auth/signin', data);
        return response.data;
    }



    static async getMe(): Promise<{ user: User }> {
        const response = await api.get('/auth/me');
        return response.data;
    }

    static async logout(): Promise<void> {
        await api.post('/auth/logout');
    }
}
