import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";

const AuthCallback = () => {
    const navigate = useNavigate();
    const { checkAuth, isAuthenticated, isLoading } = useAuthStore();

    useEffect(() => {
        const verifySession = async () => {
            try {
                await checkAuth();
            } catch (error) {
                console.error("Auth callback verification failed", error);
                navigate("/auth");
            }
        };
        verifySession();
    }, [checkAuth, navigate]);

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate("/dashboard");
        } else if (!isLoading && !isAuthenticated) {
            // Only redirect to auth if we are definitely done loading and still not authenticated
            // However, the initial state is propertly handled by verifySession catch, 
            // but if checkAuth completes without error but sets isAuthenticated to false (unlikely with current logic but possible), 
            // we might want a timeout or just let the user see the loading state -> actually better to redirect.
            // Let's rely on the first useEffect for error handling mostly, but this one for success.
            // If checkAuth finishes and we are NOT authenticated, we should probably go back to auth.
            navigate('/auth');
        }
    }, [isAuthenticated, isLoading, navigate]);

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
};

export default AuthCallback;
