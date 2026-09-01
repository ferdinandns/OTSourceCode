import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthUser } from "../hooks/auth/useAuthUser";
 
export const RequirePasswordChange = () => {
    const user = useAuthUser();
    const location = useLocation();
 
    if (user?.must_change_password && location.pathname !== "/change-password") {
        return (
            <Navigate
                to="/change-password"
                replace
                state={{ from: location, reason: "password_expired" }}
            />
        );
    }
 
    return <Outlet />;
};