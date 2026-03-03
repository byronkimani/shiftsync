import { useAuth } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isLoaded, userId } = useAuth();
    const location = useLocation();

    if (!isLoaded) {
        return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
    }

    if (!userId) {
        // Redirect them to the /sign-in page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience.
        return <Navigate to="/sign-in" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
