// frontend-react-ts/src/hooks/instrument/useChecklist.tsx

import { useQuery, useMutation } from "@tanstack/react-query";
import axiosInstance from "../../services/api";

interface ChecklistItem {
  id: number;
  label: string;
  type: "boolean" | "text" | "number";
  required: boolean;
  critical_ok: boolean;
  help_text?: string;
  placeholder?: string;
  min_value?: number;
  max_value?: number;
}

interface ChecklistResponse {
  id: number;
  value: boolean | string | number;
  ok: boolean;
  note: string;
}

interface ChecklistData {
  instrument_id: number;
  instrument_name: string;
  instrument_type: string;
  checklist_type: "initial" | "final";
  checklist_items: ChecklistItem[];
  require_all_ok: boolean;
}

interface ValidationResult {
  is_valid: boolean;
  all_ok: boolean;
  failed_items: number[];
  critical_failed: boolean;
  instrument_status: string;
  message: string;
  can_proceed: boolean;
}

// Get checklist for instrument
export const useChecklist = (
  instrumentId: string | undefined,
  checklistType: "initial" | "final",
  enabled: boolean = true
) => {
  return useQuery<{ data: ChecklistData }>({
    queryKey: ["checklist", instrumentId, checklistType],
    queryFn: async () => {
      if (!instrumentId) throw new Error("Instrument ID is required");
      const response = await axiosInstance.get(
        `/api/instruments/${instrumentId}/checklist`,
        {
          params: { type: checklistType },
        }
      );
      return response.data;
    },
    enabled: enabled && !!instrumentId,
  });
};

// Validate checklist responses
export const useValidateChecklist = () => {
  return useMutation<
    { data: ValidationResult },
    Error,
    {
      instrumentId: number;
      checklistType: "initial" | "final";
      responses: ChecklistResponse[];
    }
  >({
    mutationFn: async ({ instrumentId, checklistType, responses }) => {
      const response = await axiosInstance.post(
        "/api/instruments/validate-checklist",
        {
          instrument_id: instrumentId,
          checklist_type: checklistType,
          responses,
        }
      );
      return response.data;
    },
  });
};

// Start auto-read with checklist
export const useStartAutoReadWithChecklist = () => {
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        checklist_responses: ChecklistResponse[];
        kategori_sampel: string;
        sampel: string[];
        no_qc_batch: Array<{ no_qc_batch: string; jumlah_item: number }>;
        additional_data?: Record<string, any>;
      };
    }) => {
      const response = await axiosInstance.post(
        `/api/instruments/${id}/start-auto-read`,
        data
      );
      return response.data;
    },
  });
};

// End read process with checklist
export const useEndReadWithChecklist = () => {
  return useMutation({
    mutationFn: async ({
      instrumentId,
      usageId,
      checklistResponses,
    }: {
      instrumentId: string;
      usageId: number;
      checklistResponses: ChecklistResponse[];
    }) => {
      const response = await axiosInstance.post(
        `/api/instruments/${instrumentId}/end-read`,
        {
          usage_id: usageId,
          checklist_responses: checklistResponses,
        }
      );
      return response.data;
    },
  });
};

// Admin: Create checklist template
export const useCreateChecklistTemplate = () => {
  return useMutation({
    mutationFn: async (data: {
      instrument_type: string;
      template_name: string;
      description: string;
      initial_checklist_items: ChecklistItem[];
      final_checklist_items: ChecklistItem[];
    }) => {
      const response = await axiosInstance.post(
        "/api/admin/checklist-templates",
        data
      );
      return response.data;
    },
  });
};

// Admin: Update checklist config for specific instrument
export const useUpdateChecklistConfig = () => {
  return useMutation({
    mutationFn: async ({
      instrumentId,
      data,
    }: {
      instrumentId: string;
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
  });
};