import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

export function RoleGuard({
    children,
    allowedRoles,
    fallbackPath = "/"
}: {
    children: React.ReactNode;
    allowedRoles: string[];
    fallbackPath?: string;
}) {
    const { isLoaded, user } = useUser();

    if (!isLoaded) {
        return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
    }

    const role = (user?.publicMetadata?.role as string) || "staff";

    if (!allowedRoles.includes(role)) {
        // If they are an admin/manager on a staff page or vice versa, bounce them
        return <Navigate to={fallbackPath} replace />;
    }

    return <>{children}</>;
}
