import { useQuery } from "@tanstack/react-query";
import { getInstrumentSchema } from "../../api/instrument";

export const useInstrumentSchema = (id: string) => {
  return useQuery({
    queryKey: ["instrument-schema", id],
    queryFn: () => getInstrumentSchema(id),
  });
};
