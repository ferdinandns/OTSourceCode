import { useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const TIMEOUT_MS = 8 * 60 * 60 * 1000;
const EXEMPT_ROUTES = [
    /^\/instruments\/read\//,
    /^\/verifications\/start\//,
];

export const useInactivityLogout = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const logoutRef = useRef(logout);
    const navigateRef = useRef(navigate);
    
    useEffect(() => { logoutRef.current = logout; }, [logout]);
    useEffect(() => { navigateRef.current = navigate; }, [navigate]);
    
    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            logoutRef.current();
            navigateRef.current("/", { replace: true, state: { reason: "inactivity" } });
        }, TIMEOUT_MS);
    }, []);
    
    useEffect(() => {
        const isExempt = EXEMPT_ROUTES.some(pattern => pattern.test(location.pathname));
        
        if (!isAuthenticated || isExempt) {
            if (timerRef.current) clearTimeout(timerRef.current);
            return;
        }
        
        const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
        resetTimer();
        events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
        
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(ev => window.removeEventListener(ev, resetTimer));
        };
    }, [isAuthenticated, resetTimer, location.pathname]);
};