import { useQuery } from "@tanstack/react-query";
import { getInstrumentDetail } from "../../api/instrument";

export const useInstrumentDetail = (id: string | number) => {
  const { data, isLoading, error, refetch, isError } = useQuery({
    queryKey: ["instrument-detail", id],
    queryFn: () => getInstrumentDetail(id),
    enabled: !!id,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  return { data, isLoading, isError, error, refetch };
};