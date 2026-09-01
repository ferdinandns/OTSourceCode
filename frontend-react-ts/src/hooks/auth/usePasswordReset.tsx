// hooks/auth/usePasswordReset.tsx
import { useMutation } from "@tanstack/react-query";
import Api from "../../services/api";

interface ForgotPasswordRequest {
    username: string;
}

interface ResetPasswordRequest {
    token: string;
    new_password: string;
}

// Step 1 — user provides their username to generate a reset token
export const useForgotPassword = () => {
    return useMutation({
        mutationFn: async (data: ForgotPasswordRequest) => {
            const response = await Api.post("/api/forgot-password", data);
            return response.data;
        },
    });
};

// Step 2 — user provides token + new password to complete the reset
export const useResetPassword = () => {
    return useMutation({
        mutationFn: async (data: ResetPasswordRequest) => {
            const response = await Api.post("/api/reset-password", data);
            return response.data;
        },
    });
};