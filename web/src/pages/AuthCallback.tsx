import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

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
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Authenticating...</p>
            </div>
        </div>
    );
};

export default AuthCallback;
