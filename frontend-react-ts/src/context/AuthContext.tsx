import { createContext, useState, useContext, ReactNode } from "react";
import Cookies from "js-cookie";

// ============================================
// GROUP & ROLE CONSTANTS (mirrors backend)
// ============================================
export const GROUP_SUPERADMIN = 1;
export const GROUP_MANAGER    = 2;
export const GROUP_SUPERVISOR = 3;
export const GROUP_ANALYST    = 4;
export const GROUP_USER       = 5;

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  user_group: number;
  site?: string; // "PLG" or "CKR"
  must_change_password: boolean; 
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  // Permission helpers
  isGroup: (group: number) => boolean;
  hasMinGroup: (maxGroup: number) => boolean; // true if user.group <= maxGroup
  canWrite: () => boolean;   // group <= 4
  canDelete: () => boolean;  // group <= 2
  isSuperadmin: () => boolean;
  isManagerOrAbove: () => boolean;
  isSupervisorOrAbove: () => boolean;
  isAnalystOrAbove: () => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── helpers ────────────────────────────────────────────────────────────────

const isTokenValid = (): boolean => {
  const token = Cookies.get("token");
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    Cookies.remove("token");
    return false;
  }
};

const loadUserFromCookie = (): AuthUser | null => {
  try {
    const raw = Cookies.get("user");
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isTokenValid);
  const [user, setUser] = useState<AuthUser | null>(loadUserFromCookie);

  const login = (token: string, userData: AuthUser) => {
    Cookies.set("token", token, { expires: 7 });
    Cookies.set("user", JSON.stringify(userData), { expires: 7 });
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = () => {
    Cookies.remove("token");
    Cookies.remove("user");
    Cookies.remove("current_lokasi");
    setIsAuthenticated(false);
    setUser(null);
  };

  // Permission helpers
  const isGroup = (group: number) => user?.user_group === group;
  const hasMinGroup = (maxGroup: number) => (user?.user_group ?? 99) <= maxGroup;
  const canWrite = () => hasMinGroup(GROUP_ANALYST);
  const canDelete = () => hasMinGroup(GROUP_MANAGER);
  const isSuperadmin = () => hasMinGroup(GROUP_SUPERADMIN);
  const isManagerOrAbove = () => hasMinGroup(GROUP_MANAGER);
  const isSupervisorOrAbove = () => hasMinGroup(GROUP_SUPERVISOR);
  const isAnalystOrAbove = () => hasMinGroup(GROUP_ANALYST);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      login,
      logout,
      isGroup,
      hasMinGroup,
      canWrite,
      canDelete,
      isSuperadmin,
      isManagerOrAbove,
      isSupervisorOrAbove,
      isAnalystOrAbove,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}