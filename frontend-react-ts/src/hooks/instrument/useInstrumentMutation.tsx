import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createInstrument,
  updateInstrument,
  deleteInstrument,
} from "../../api/instrument";

export const useInstrumentMutation = () => {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: createInstrument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
    },
  });

  const update = useMutation({
    mutationFn: updateInstrument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteInstrument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
    },
  });

  return { create, update, remove };
};
