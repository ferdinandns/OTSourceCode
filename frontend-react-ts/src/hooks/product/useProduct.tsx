import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProducts,
  getProductDetail,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
} from "../../api/product";

// Hook for fetching all products
export const useProducts = (params?: any) => {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => getProducts(params),
  });
};

// Hook for fetching product detail
export const useProductDetail = (id: string | number) => {
  return useQuery({
    queryKey: ["product-detail", id],
    queryFn: () => getProductDetail(id),
    enabled: !!id,
  });
};

// Hook for products by category
export const useProductsByCategory = (category: string) => {
  return useQuery({
    queryKey: ["products-by-category", category],
    queryFn: () => getProductsByCategory(category),
    enabled: !!category,
  });
};

// Hook for mutations (create, update, delete)
export const useProductMutation = () => {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const update = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return { create, update, remove };
};