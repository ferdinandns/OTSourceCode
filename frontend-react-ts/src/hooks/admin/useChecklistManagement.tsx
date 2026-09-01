// frontend-react-ts/src/hooks/admin/useChecklistManagement.tsx

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../services/api";
import type {
  ChecklistByName,
  ChecklistByNameDetail,
  ChecklistItem,
  InstrumentNameWithStatus,
  InstrumentWithStatus,
  ConfigDetail,
  CreateChecklistByNameRequest,
} from "../../types/checklist";

// ==================== 🆕 BY NAME (NEW HOOKS) ====================

export const useChecklistByName = (instrumentType?: string) => {
  return useQuery<{ data: ChecklistByName[] }>({
    queryKey: ["checklist-by-name", instrumentType],
    queryFn: async () => {
      const response = await axiosInstance.get("/api/admin/checklist-by-name", {
        params: { type: instrumentType },
      });
      return response.data;
    },
  });
};

export const useChecklistByNameDetail = (configId: number | undefined) => {
  return useQuery<{ data: ChecklistByNameDetail }>({
    queryKey: ["checklist-by-name-detail", configId],
    queryFn: async () => {
      if (!configId) throw new Error("Config ID required");
      const response = await axiosInstance.get(
        `/api/admin/checklist-by-name/${configId}`
      );
      return response.data;
    },
    enabled: !!configId,
  });
};

export const useCreateChecklistByName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateChecklistByNameRequest) => {
      const response = await axiosInstance.post(
        "/api/admin/checklist-by-name",
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-by-name"] });
      queryClient.invalidateQueries({ queryKey: ["instrument-names-status"] });
    },
  });
};

export const useUpdateChecklistByName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      configId,
      data,
    }: {
      configId: number;
      data: CreateChecklistByNameRequest;
    }) => {
      const response = await axiosInstance.put(
        `/api/admin/checklist-by-name/${configId}`,
        data
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["checklist-by-name"] });
      queryClient.invalidateQueries({
        queryKey: ["checklist-by-name-detail", variables.configId],
      });
    },
  });
};

export const useDeleteChecklistByName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: number) => {
      const response = await axiosInstance.delete(
        `/api/admin/checklist-by-name/${configId}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-by-name"] });
      queryClient.invalidateQueries({ queryKey: ["instrument-names-status"] });
    },
  });
};

export const useInstrumentNamesWithChecklistStatus = (instrumentType: string) => {
  return useQuery<{ data: InstrumentNameWithStatus[] }>({
    queryKey: ["instrument-names-status", instrumentType],
    queryFn: async () => {
      const response = await axiosInstance.get(
        "/api/admin/instrument-names-checklist-status",
        {
          params: { type: instrumentType },
        }
      );
      return response.data;
    },
    enabled: !!instrumentType,
  });
};

// ==================== INDIVIDUAL INSTRUMENT CONFIG ====================

export const useInstrumentsChecklistStatus = (instrumentType?: string) => {
  return useQuery<{ data: InstrumentWithStatus[] }>({
    queryKey: ["instruments-checklist-status", instrumentType],
    queryFn: async () => {
      const response = await axiosInstance.get(
        "/api/admin/instruments-checklist-status",
        {
          params: { type: instrumentType },
        }
      );
      return response.data;
    },
  });
};

export const useInstrumentChecklistConfig = (instrumentId: number | undefined) => {
  return useQuery<{ data: ConfigDetail }>({
    queryKey: ["instrument-checklist-config", instrumentId],
    queryFn: async () => {
      if (!instrumentId) throw new Error("Instrument ID required");
      const response = await axiosInstance.get(
        `/api/instruments/${instrumentId}/checklist-config`
      );
      return response.data;
    },
    enabled: !!instrumentId,
  });
};

export const useUpdateInstrumentChecklistConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instrumentId,
      data,
    }: {
      instrumentId: number;
      data: {
        initial_checklist_items?: ChecklistItem[];
        final_checklist_items?: ChecklistItem[];
        require_all_initial_ok?: boolean;
        require_all_final_ok?: boolean;
      };
    }) => {
      const response = await axiosInstance.put(
        `/api/instruments/${instrumentId}/checklist-config`,
        data
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["instrument-checklist-config", variables.instrumentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["instruments-checklist-status"],
      });
    },
  });
};