import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { Skeleton } from "@/components/ui/skeleton";

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
            <div className="min-h-screen bg-background">
                {/* Navbar Skeleton */}
                <div className="h-16 border-b border-border/50" />
                <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
                    <div className="space-y-4 mb-8">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                        <Skeleton className="h-64 w-full rounded-xl" />
                        <Skeleton className="h-64 w-full rounded-xl" />
                    </div>
                </main>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
};

export default AuthGuard;
