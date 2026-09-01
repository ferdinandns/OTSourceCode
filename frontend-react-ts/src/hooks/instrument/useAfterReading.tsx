import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../api/instrument";

interface SaveResultRequest {
  final_condition: "OK" | "NOT OK";
  selected_batches: string[];                   
  final_checklist_results?: {
    items: any[];                                
    all_ok: boolean;
    completed_at: string;
  };
}

interface ChecklistItem {
  id: string;
  label: string;
  value: string;
  notes?: string;
}

interface RereadRequest {
  batch_number: string;
  item_number?: number | null;
  reason: string;
}

// ✅ FIX: exportToPDF now accepts targetUsageId to override the hook's usageId
interface ExportPDFRequest {
  batchNumber: string;
  targetUsageId?: number; // If provided, export from this ID (for rerreads → use parent ID)
}

interface AfterReadingResponse {
  usage_id: number;
  instrument_id: number;
  instrument_name: string;
  kategori_sampel: string;
  sampel: string[];
  no_qc_batch: string[];
  status: string;
  batch_results: any[];
  reread_history: any[];
  can_export: boolean;
  requires_approval: boolean;
  result_status?: string;
  parent_usage_id?: number;
  current_reread_id?: number;
  current_reread_status?: string;
  reread_batch_status?: Record<string, string>;
  final_checklist_items?: ChecklistItem[];
  require_all_final_ok: boolean ;  
}

// ==================== HOOK ====================
export const useAfterReading = (usageId: number | null) => {
  const queryClient = useQueryClient();

  const {
    data: afterReadingData,
    isLoading,
    refetch,
  } = useQuery<AfterReadingResponse>({
    queryKey: ["after-reading", usageId],
    queryFn: async () => {
      if (!usageId) throw new Error("Usage ID is required");
      const response = await axiosInstance.get(
        `/api/instruments/usage/${usageId}/after-reading`
      );
      return response.data.data;
    },
    enabled: !!usageId,
  });

  const saveResult = useMutation({
    mutationFn: async (data: SaveResultRequest) => {
      if (!usageId) throw new Error("Usage ID is required");
      const response = await axiosInstance.post(
        `/api/instruments/usage/${usageId}/save-result`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["after-reading", usageId] });
      queryClient.invalidateQueries({ queryKey: ["instrument-detail"] });
    },
  });

  const requestReread = useMutation({
    mutationFn: async (data: RereadRequest) => {
      if (!usageId) throw new Error("Usage ID is required");
      const response = await axiosInstance.post(
        `/api/instruments/usage/${usageId}/request-reread`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["after-reading", usageId] });
    },
  });

  // ✅ FIX: exportToPDF uses targetUsageId if provided, otherwise falls back to usageId
  // This ensures rerreads always export via the parent (root) usage ID
  const exportToPDF = useMutation({
    mutationFn: async ({ batchNumber, targetUsageId }: ExportPDFRequest) => {
      const exportId = targetUsageId ?? usageId;
      if (!exportId) throw new Error("Usage ID is required");
      const response = await axiosInstance.post(
        `/api/instruments/usage/${exportId}/export-pdf`,
        { batch_number: batchNumber }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["after-reading", usageId] });
    },
  });

  return {
    data: afterReadingData,
    isLoading,
    refetch,
    saveResult,
    requestReread,
    exportToPDF,
    isSaving: saveResult.isPending,
    isExporting: exportToPDF.isPending,
  };
};

// ==================== SUPERVISOR APPROVAL ====================
export const useApproveReread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      usageId,
      approved,
      notes,
    }: {
      usageId: number;
      approved: boolean;
      notes?: string;
    }) => {
      const response = await axiosInstance.post(
        `/api/instruments/usage/${usageId}/approve-reread`,
        { approved, notes }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["after-reading", variables.usageId] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    },
  });
};

// ==================== GET PENDING APPROVALS ====================
export const usePendingRereadApprovals = () => {
  return useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const response = await axiosInstance.get(
        `/api/instruments/usage/pending-reread-approvals`
      );
      return response.data.data;
    },
  });
};