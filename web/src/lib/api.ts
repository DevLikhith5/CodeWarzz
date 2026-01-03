import axios from 'axios';

const API_URL =
    import.meta.env.VITE_API_URL ||
    '/api/v1';


const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

import { useAuthStore } from '@/features/auth/stores/useAuthStore';

// For refreshing logic
interface FailedRequest {
    resolve: (token: any) => void;
    reject: (error: any) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: any, token: any = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Cache-busting interceptor for GET requests
api.interceptors.request.use((config) => {
    if (config.method?.toLowerCase() === 'get') {
        config.params = {
            ...config.params,
            _t: Date.now(),
        };
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Prevent infinite loops
        if (error.response?.status === 401 && !originalRequest._retry) {

            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => {
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Call refresh endpoint
                await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });

                // Success
                isRefreshing = false;
                processQueue(null, true);

                return api(originalRequest);
            } catch (refreshError) {
                // Failure
                isRefreshing = false;
                processQueue(refreshError, null);

                // Force logout
                useAuthStore.getState().logout();
                if (window.location.pathname !== '/auth') {
                    window.location.href = '/auth';
                }

                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
