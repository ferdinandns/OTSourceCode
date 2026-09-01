// hooks/auth/useAuthUser.tsx
import Cookies from "js-cookie";

export interface AuthUser {
    id: number;
    name: string;
    username: string;
    email: string;
    role: string;
    user_group: number;
    /** Req 2: true when the password is expired or was admin-set and never changed. */
    must_change_password: boolean;
}

/**
 * Returns the currently logged-in user from the cookie, or null if not logged in.
 * This is a synchronous read — no network call.
 */
export const useAuthUser = (): AuthUser | null => {
    const raw = Cookies.get("user");
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AuthUser;
    } catch {
        return null;
    }
};