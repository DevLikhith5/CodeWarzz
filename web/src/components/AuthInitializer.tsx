import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';

const AuthInitializer = () => {
    const { checkAuth } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return null;
};

export default AuthInitializer;
