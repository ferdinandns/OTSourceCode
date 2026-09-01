import { useQuery } from "@tanstack/react-query";
import { readInstrumentLive } from "../../api/instrument";

export const useInstrumentReader = (id: string, interval: number) => {
  return useQuery({
    queryKey: ["instrument-read", id],
    queryFn: () => readInstrumentLive(id),
    refetchInterval: interval,
  });
};
