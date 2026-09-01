import axios from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
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
// PRODUCT API FUNCTIONS
// ============================================

// Get all products
export const getProducts = async (params?: {
  site?: string;
  kategori_sampel?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const response = await axiosInstance.get("/api/products", { params });
  return response.data;
};

// Get product detail
export const getProductDetail = async (id: string | number) => {
  const response = await axiosInstance.get(`/api/products/${id}`);
  return response.data;
};

// Create new product
export const createProduct = async (data: any) => {
  const response = await axiosInstance.post("/api/products", data);
  return response.data;
};

// Update product
export const updateProduct = async (params: { id: number | string; data: any }) => {
  const response = await axiosInstance.put(`/api/products/${params.id}`, params.data);
  return response.data;
};

// Delete product
export const deleteProduct = async (id: number | string) => {
  const response = await axiosInstance.delete(`/api/products/${id}`);
  return response.data;
};

// Get products by category
export const getProductsByCategory = async (category: string) => {
  const response = await axiosInstance.get(`/api/products/by-category/${category}`);
  return response.data;
};

export default axiosInstance;