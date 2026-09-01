// hooks/auth/useRegister.tsx
import { useMutation } from "@tanstack/react-query";
import Api from "../../services/api";

interface RegisterRequest {
    name: string;
    /** Optional — backend auto-generates "first.last" from name if omitted. */
    username?: string;
    email: string;
    password: string;
    lokasi_utama_id: number;
    lokasi_tambahan_ids?: number[];
}

export const useRegister = () => {
    return useMutation({
        mutationFn: async (data: RegisterRequest) => {
            const response = await Api.post("/api/register", data);
            return response.data;
        },
    });
};