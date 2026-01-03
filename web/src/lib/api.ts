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

// api.interceptors.request.use((config) => {
//     return config;
// });

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                // Call the refresh endpoint (cookies sent automatically)
                await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });

                // Tokens are refreshed in cookies automatically
                return api(originalRequest);
            } catch (refreshError) {
                window.location.href = '/auth'; // Redirect to login
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
