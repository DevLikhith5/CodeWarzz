import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000, // 15s default request timeout
});

interface FailedRequest {
    resolve: () => void;
    reject: (error: any) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: any) => {
    failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve()));
    failedQueue = [];
};

function getCsrfToken(): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(/(?:^|;\s*)csrf=([0-9a-f]+)/);
    return match?.[1];
}

// Cache-busting only for time-sensitive endpoints (leaderboard, health) —
// not all GETs, which prevents the global cache buster from breaking
// HTTP caching / CDN behaviour for everything.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (config.method?.toLowerCase() === 'get' && config.url?.includes('leaderboard')) {
        config.params = { ...config.params, _t: Date.now() };
    }
    // CSRF protection: echo the double-submit cookie token in the
    // x-csrf-token header on state-changing requests. This pairs with
    // csrfProtection middleware in the backend.
    const method = (config.method || '').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
        const token = getCsrfToken();
        if (token) {
            config.headers = config.headers || ({} as any);
            (config.headers as any)['x-csrf-token'] = token;
        }
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status !== 401 || originalRequest._retry) {
            return Promise.reject(error);
        }

        // If a refresh is in flight, queue this request
        if (isRefreshing) {
            return new Promise<void>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(() => api(originalRequest));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            // Use the configured api instance so the refresh request itself
            // gets timeouts, headers, and the same withCredentials behaviour.
            await api.post('/auth/refresh', {});
            isRefreshing = false;
            processQueue(null);
            return api(originalRequest);
        } catch (refreshError) {
            isRefreshing = false;
            processQueue(refreshError);
            try {
                await useAuthStore.getState().logout();
            } catch {
                // ignore; the redirect below still runs
            }
            if (window.location.pathname !== '/auth') {
                window.location.href = '/auth';
            }
            return Promise.reject(refreshError);
        }
    }
);

export default api;
