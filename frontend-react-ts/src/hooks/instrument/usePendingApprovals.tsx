import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../services/api";
import { PendingApproval, ApprovalAction } from "../../types/instrument";

export const usePendingApprovals = () => {
  const queryClient = useQueryClient();

  // Fetch pending approvals
  const {
    data: approvals,
    isLoading,
    error,
    refetch,
  } = useQuery<PendingApproval[]>({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const response = await axiosInstance.get(
        "/api/instruments/usage/pending-reread-approvals"
      );
      const data = response.data.data || [];
      return data.filter(
        (item: PendingApproval) =>
          item.result_status === "awaiting_approval" ||
          item.result_status === "pending"
      );
    },
  });

  // Approve re-read
  const approveReread = useMutation({
    mutationFn: async ({
      usageId,
      notes = "",
    }: {
      usageId: number;
      notes?: string;
    }) => {
      const response = await axiosInstance.post(
        `/api/instruments/usage/${usageId}/approve-reread`,
        {
          approved: true,
          notes,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    },
    onError: (error: any) => {
      console.error("Failed to approve reread:", error);
      alert(
        error.response?.data?.message || "Failed to approve re-read. Please try again."
      );
    },
  });

  // Reject re-read
  const rejectReread = useMutation({
    mutationFn: async ({
      usageId,
      notes,
    }: {
      usageId: number;
      notes: string;
    }) => {
      if (!notes || notes.trim() === "") {
        throw new Error("Rejection notes are required");
      }

      const response = await axiosInstance.post(
        `/api/instruments/usage/${usageId}/approve-reread`,
        {
          approved: false,
          notes,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    },
    onError: (error: any) => {
      console.error("Failed to reject reread:", error);
      alert(
        error.message || error.response?.data?.message || "Failed to reject re-read. Please try again."
      );
    },
  });

  // Process approval (approve or reject)
  const processApproval = useMutation({
    mutationFn: async ({
      usageId,
      approved,
      notes,
    }: {
      usageId: number;
      approved: boolean;
      notes: string;
    }) => {
      const response = await axiosInstance.post(
        `/api/instruments/usage/${usageId}/approve-reread`,
        {
          approved,
          notes,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    },
    onError: (error: any) => {
      console.error("Failed to process approval:", error);
      alert(
        error.response?.data?.message || "Failed to process approval. Please try again."
      );
    },
  });

  return {
    approvals,
    isLoading,
    error,
    refetch,
    approveReread,
    rejectReread,
    processApproval,
  };
};