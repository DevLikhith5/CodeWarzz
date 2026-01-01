import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

interface AuthGuardProps {
    children: React.ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
    const { isAuthenticated, checkAuth } = useAuthStore();
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const authenticate = async () => {
            if (isAuthenticated) {
                setIsChecking(false);
                return;
            }

            try {
                await checkAuth();
            } finally {
                setIsChecking(false);
            }
        };
        authenticate();
    }, [checkAuth, isAuthenticated]);

    useEffect(() => {
        if (!isChecking && !isAuthenticated) {
            navigate('/auth');
        }
    }, [isChecking, isAuthenticated, navigate]);

    if (isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
};

export default AuthGuard;
