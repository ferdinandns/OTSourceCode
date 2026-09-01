// hooks/user/useUserStatusUpdate.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Api from "../../services/api";

interface StatusUpdateRequest {
    id: number;
    status: "active" | "pending" | "deactive";
}

export const useUserStatusUpdate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: StatusUpdateRequest) => {
            const response = await Api.patch(`/api/users/${id}/status`, { status });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"], exact: true });
        },
    });
};