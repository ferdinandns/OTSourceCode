import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getBridgePCs, 
  getBridgeStatus, 
  registerBridgePC, 
  getBridgeReadings,
  startInstrument,
  stopInstrument,
  restartInstrument,
  getInstrumentStatus,
  startBridge,
  stopBridge,
  restartBridge
} from '../../api/bridge';

export const useBridgePCs = () => {
  return useQuery({
    queryKey: ['bridge-pcs'],
    queryFn: getBridgePCs,
    refetchInterval: 30000, // Refresh every 30s
  });
};

export const useBridgeStatus = (pcId: string) => {
  return useQuery({
    queryKey: ['bridge-status', pcId],
    queryFn: () => getBridgeStatus(pcId),
    enabled: !!pcId,
    refetchInterval: 5000, // Refresh every 5s
  });
};

export const useRegisterBridge = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: registerBridgePC,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bridge-pcs'] });
    },
  });
};

export const useBridgeReadings = (pcId?: string, instrumentId?: string) => {
  return useQuery({
    queryKey: ['bridge-readings', pcId, instrumentId],
    queryFn: () => getBridgeReadings({ pc_id: pcId, instrument_id: instrumentId }),
    refetchInterval: 10000, // Refresh every 10s
  });
};

// ============================================
// 🆕 BRIDGE-LEVEL CONTROL HOOKS
// ============================================

export const useStartBridge = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (pcId: string) => startBridge(pcId),
    onSuccess: (_, pcId) => {
      queryClient.invalidateQueries({ queryKey: ['bridge-status', pcId] });
      queryClient.invalidateQueries({ queryKey: ['bridge-pcs'] });
      queryClient.invalidateQueries({ queryKey: ['bridge-readings'] });
    },
  });
};

export const useStopBridge = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (pcId: string) => stopBridge(pcId),
    onSuccess: (_, pcId) => {
      queryClient.invalidateQueries({ queryKey: ['bridge-status', pcId] });
      queryClient.invalidateQueries({ queryKey: ['bridge-pcs'] });
      queryClient.invalidateQueries({ queryKey: ['bridge-readings'] });
    },
  });
};

export const useRestartBridge = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (pcId: string) => restartBridge(pcId),
    onSuccess: (_, pcId) => {
      queryClient.invalidateQueries({ queryKey: ['bridge-status', pcId] });
      queryClient.invalidateQueries({ queryKey: ['bridge-pcs'] });
      queryClient.invalidateQueries({ queryKey: ['bridge-readings'] });
    },
  });
};

// 🆕 Start Instrument Hook
export const useStartInstrument = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pcId, instrumentId }: { pcId: string; instrumentId: number }) =>
      startInstrument(pcId, instrumentId),
    onSuccess: (_, variables) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['bridge-status', variables.pcId] });
      queryClient.invalidateQueries({ queryKey: ['bridge-readings'] });
    },
  });
};

// 🆕 Stop Instrument Hook
export const useStopInstrument = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pcId, instrumentId }: { pcId: string; instrumentId: number }) =>
      stopInstrument(pcId, instrumentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bridge-status', variables.pcId] });
      queryClient.invalidateQueries({ queryKey: ['bridge-readings'] });
    },
  });
};

// 🆕 Restart Instrument Hook
export const useRestartInstrument = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pcId, instrumentId }: { pcId: string; instrumentId: number }) =>
      restartInstrument(pcId, instrumentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bridge-status', variables.pcId] });
      queryClient.invalidateQueries({ queryKey: ['bridge-readings'] });
    },
  });
};

// 🆕 Get Instrument Status Hook
export const useInstrumentStatus = (pcId: string, instrumentId: number) => {
  return useQuery({
    queryKey: ['instrument-status', pcId, instrumentId],
    queryFn: () => getInstrumentStatus(pcId, instrumentId),
    enabled: !!pcId && !!instrumentId,
    refetchInterval: 3000, // Refresh every 3s for real-time status
  });
};