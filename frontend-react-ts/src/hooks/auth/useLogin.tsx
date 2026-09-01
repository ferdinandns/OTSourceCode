// hooks/auth/useLogin.tsx
import { useMutation } from "@tanstack/react-query";
import Api from "../../services/api";
import Cookies from "js-cookie";

interface LoginRequest {
    username: string;
    password: string;
    lokasi_id?: number;
}

interface LoginResponseData {
    id: number;
    name: string;
    username: string;
    email: string;
    role: string;
    user_group: number;
    status: string;
    must_change_password: boolean;
    token: string;
    lokasi_utama_id?: number | null;
    lokasi_aktif_id?: number | null;
}

export const useLogin = () => {
    return useMutation({
        mutationFn: async (data: LoginRequest) => {
            const response = await Api.post("/api/login", data);
            return response.data;
        },
        onSuccess: (response) => {
            const data: LoginResponseData = response.data;

            // Persist token and user info in cookies
            Cookies.set("token", data.token, { expires: 1 });
            Cookies.set("user", JSON.stringify({
                id: data.id,
                name: data.name,
                username: data.username,
                email: data.email,
                role: data.role,
                user_group: data.user_group,
                // Req 2: store flag so the router / AuthContext can redirect
                must_change_password: data.must_change_password,
            }), { expires: 1 });
        },
    });
};