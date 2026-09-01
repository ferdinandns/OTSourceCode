import { useMutation, useQuery } from "@tanstack/react-query";
import axiosInstance from "../../api/instrument";

// ==================== AUTO-READ (NEW) ====================

// Start auto-read loop (sistem otomatis baca n kali)
export const useStartAutoRead = () => {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await axiosInstance.post(
        `/api/instruments/${id}/start-auto-read`,
        data
      );
      return response.data;
    },
  });
};

// Poll progress dari auto-read
export const useReadProgress = (usageId: number | null, enabled: boolean) => {
  return useQuery({
    queryKey: ["read-progress", usageId],
    queryFn: async () => {
      if (!usageId) throw new Error("Usage ID is required");
      const response = await axiosInstance.get(
        `/api/instruments/usage/${usageId}/progress`
      );
      return response.data;
    },
    enabled: enabled && !!usageId,
    refetchInterval: 500, // Poll every 500ms to catch multi-line saves
  });
};

// ==================== MANUAL READ (EXISTING) ====================

export const useStartReadProcess = () => {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await axiosInstance.post(
        `/api/instruments/${id}/start-read`,
        data
      );
      return response.data;
    },
  });
};

export const useEndReadProcess = () => {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await axiosInstance.post(
        `/api/instruments/${id}/end-read`,
        data
      );
      return response.data;
    },
  });
};

// Read data now (manual trigger)
export const useReadDataNow = () => {
  return useMutation({
    mutationFn: async ({ id, usageId }: { id: string; usageId: number }) => {
      const response = await axiosInstance.post(
        `/api/instruments/${id}/read-now`,
        {
          usage_id: usageId,
        }
      );
      return response.data;
    },
  });
};

// Poll live results
export const useLiveResults = (usageId: number | null, enabled: boolean) => {
  return useQuery({
    queryKey: ["live-results", usageId],
    queryFn: async () => {
      if (!usageId) throw new Error("Usage ID is required");
      const response = await axiosInstance.get(
        `/api/instruments/usage/${usageId}/results`
      );
      return response.data;
    },
    enabled: enabled && !!usageId,
    refetchInterval: 1000, // Poll every 1s to show live results promptly
  });
};

export const useRetryItem = () => {
  return useMutation({
    mutationFn: async ({
      usageId,
      itemNumber,
    }: {
      usageId: number;
      itemNumber: number;
    }) => {
      const response = await axiosInstance.post(
        `/api/instruments/usage/${usageId}/retry-item`,
        { item_number: itemNumber }
      );
      return response.data;
    },
  });
};
