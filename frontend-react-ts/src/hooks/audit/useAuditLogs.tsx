import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  action: "INSERT" | "UPDATE" | "DELETE" | "SELECT";
  table_name: string;
  record_id: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  endpoint: string;
  ip_address: string;
  created_at: string;
}

export interface AuditFilter {
  page?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  table_name?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface PaginatedAuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const useAuditLogs = (filter: AuditFilter) => {
  return useQuery<PaginatedAuditResponse>({
    queryKey: ["audit-logs", filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.page) params.set("page", String(filter.page));
      if (filter.limit) params.set("limit", String(filter.limit));
      if (filter.user_id) params.set("user_id", filter.user_id);
      if (filter.action) params.set("action", filter.action);
      if (filter.table_name) params.set("table_name", filter.table_name);
      if (filter.date_from) params.set("date_from", filter.date_from);
      if (filter.date_to) params.set("date_to", filter.date_to);
      if (filter.search) params.set("search", filter.search);

      const response = await api.get(`/api/audit/logs?${params.toString()}`);
      return response.data.data;
    },
    placeholderData: (prev) => prev,
  });
};

export const useAuditTables = () => {
  return useQuery<string[]>({
    queryKey: ["audit-tables"],
    queryFn: async () => {
      const response = await api.get("/api/audit/tables");
      return response.data.data;
    },
  });
};