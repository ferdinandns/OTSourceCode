import axios from "axios";
import Cookies from "js-cookie";

// Base URL - sesuaikan dengan backend Golang
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// Setup axios instance dengan interceptor untuk auth
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Ambil token dari Cookies
axiosInstance.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 response
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("token");
      Cookies.remove("user");
      Cookies.remove("current_lokasi");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// ============================================
// INSTRUMENT API FUNCTIONS
// ============================================

// Get all instruments
export const getInstruments = async (params?: {
  site?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const response = await axiosInstance.get("/api/instruments", { params });
  return response.data; // Return full response including {status, message, data}
};

// Get instrument detail - FIXED
export const getInstrumentDetail = async (id: string | number) => {
  const response = await axiosInstance.get(`/api/instruments/${id}`);
  return response.data; // Return {status: "success", message: "...", data: {...}}
};

// Create new instrument
export const createInstrument = async (data: any) => {
  const response = await axiosInstance.post("/api/instruments", data);
  return response.data;
};

// Update instrument
export const updateInstrument = async (params: { id: number | string; data: any }) => {
  const response = await axiosInstance.put(`/api/instruments/${params.id}`, params.data);
  return response.data;
};

// Delete instrument
export const deleteInstrument = async (id: number | string) => {
  const response = await axiosInstance.delete(`/api/instruments/${id}`);
  return response.data;
};

// Update instrument configuration
export const updateInstrumentConfiguration = async (params: {
  id: number | string;
  data: any;
}) => {
  const response = await axiosInstance.put(
    `/api/instruments/${params.id}/configuration`,
    params.data
  );
  return response.data;
};

// Test connection
export const testConnection = async (id: number | string) => {
  const response = await axiosInstance.post(`/api/instruments/${id}/test-connection`);
  return response.data;
};

// Get usage history
export const getUsageHistory = async (id: number | string) => {
  const response = await axiosInstance.get(`/api/instruments/${id}/usage-history`);
  return response.data;
};

// ============================================
// READ INSTRUMENT FUNCTIONS (Section 4)
// ============================================

// Get instrument categories
export const getInstrumentCategories = async () => {
  const response = await axiosInstance.get("/api/instruments/categories");
  return response.data;
};

// Get instruments by type
export const getInstrumentsByType = async (type: string) => {
  const response = await axiosInstance.get(`/api/instruments/by-type/${type}`);
  return response.data;
};

// Start read process
// Start read process - UPDATED
export const startReadProcess = async (
  id: number | string,
  data: {
    kategori_sampel: string;
    sampel?: string[];
    no_qc_batch: any; // Will be array of batch objects
    jumlah_item: number;
    initial_condition?: any;
    additional_data?: any;
  }
) => {
  const response = await axiosInstance.post(`/api/instruments/${id}/start-read`, data);
  return response.data;
};

// Process read instrument
export const processReadInstrument = async (data: any) => {
  const response = await axiosInstance.post("/api/instruments/process-read", data);
  return response.data;
};

// Save read result
export const saveReadResult = async (data: any) => {
  const response = await axiosInstance.post("/api/instruments/save-result", data);
  return response.data;
};

// Uji ulang
export const ujiUlang = async (data: any) => {
  const response = await axiosInstance.post("/api/instruments/uji-ulang", data);
  return response.data;
};

// Approve uji ulang
export const approveUjiUlang = async (data: any) => {
  const response = await axiosInstance.post("/api/instruments/approve-uji-ulang", data);
  return response.data;
};

// Export to PDF
export const exportToPDF = async (data: any) => {
  const response = await axiosInstance.post("/api/instruments/export-pdf", data, {
    responseType: "blob",
  });
  return response.data;
};

// Save to file capture
export const saveToFileCapture = async (data: any) => {
  const response = await axiosInstance.post("/api/instruments/save-file", data);
  return response.data;
};

// End read process
// End read process - FIXED VERSION
export const endReadProcess = async (id: number | string, data: any) => {
  const response = await axiosInstance.post(`/api/instruments/${id}/end-read`, data);
  return response.data;
};

// Get usage status
export const getUsageStatus = async (usageId: number) => {
  const response = await axiosInstance.get(`/api/instruments/usage/${usageId}`);
  return response.data;
};

// ============================================
// LIVE READ FUNCTIONS
// ============================================

// Get instrument schema
export const getInstrumentSchema = async (id: string) => {
  const response = await axiosInstance.get(`/api/instruments/${id}`);
  return response.data;
};

// Read instrument live
export const readInstrumentLive = async (id: string) => {
  const response = await axiosInstance.get(`/api/instruments/${id}/read-live`);
  return response.data;
};

// Read data now
export const readDataNow = async (id: number | string, usageId: number) => {
  const response = await axiosInstance.post(`/api/instruments/${id}/read-now`, {
    usage_id: usageId,
  });
  return response.data;
};

// Get live results
export const getLiveResults = async (usageId: number) => {
  const response = await axiosInstance.get(`/api/instruments/usage/${usageId}/results`);
  return response.data;
};

// Add the following types at the end of the file:

export interface BatchResult {
  id: number;
  no_qc_batch: string;
  item_number: number;
  result_data: any;
  is_reread: boolean;
  created_at: string;
}

export interface RereadHistory {
  usage_id: number;
  reason: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  status: "pending" | "approved" | "rejected";
}

export interface AfterReadingData {
  usage_id: number;
  instrument_id: number;
  instrument_name: string;
  kategori_sampel: string;
  sampel: string[];
  no_qc_batch: string[];
  status: string;
  batch_results: BatchResult[];
  reread_history: RereadHistory[];
  can_export: boolean;
  requires_approval: boolean;
}

export interface Supervisor {
  id: number;
  name: string;
  location: string;
  user_group: string;
}


export default axiosInstance;