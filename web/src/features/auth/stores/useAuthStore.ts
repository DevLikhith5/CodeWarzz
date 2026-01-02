import { create } from 'zustand';
import { AuthRepository, User } from '@/repositories/auth.repository';
import { useCodeEditorStore } from '@/features/problems/stores/codeEditorStore';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    login: (data: any) => Promise<void>;
    signup: (data: any) => Promise<void>;
    googleLogin: () => void;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await AuthRepository.signin(data);
            const userResponse = await AuthRepository.getMe();
            set({ user: (userResponse as any).user || (userResponse as any).data.user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Login failed', isLoading: false });
            throw error;
        }
    },

    signup: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await AuthRepository.signup(data);
            set({ isLoading: false });

        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Signup failed', isLoading: false });
            throw error;
        }
    },

    googleLogin: () => {

        window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/auth/google/signin`;
    },

    logout: async () => {
        try {
            await AuthRepository.logout();
        } catch (error) {
            console.error("Logout failed", error);
        }
        set({ user: null, isAuthenticated: false });
        useCodeEditorStore.getState().clearAll();
        localStorage.clear();
    },

    checkAuth: async () => {
        try {
            set({ isLoading: true });
            const response = await AuthRepository.getMe();
            const user = (response as any).user || (response as any).data?.user;

            if (user) {
                set({ user, isAuthenticated: true, isLoading: false });
            } else {
                set({ user: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    }
}));
