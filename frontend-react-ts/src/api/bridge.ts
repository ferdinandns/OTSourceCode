import axiosInstance from './instrument';

// Get all bridge PCs
export const getBridgePCs = async () => {
  const response = await axiosInstance.get('/api/bridge/pcs');
  return response.data;
};

// Get bridge status
export const getBridgeStatus = async (pcId: string) => {
  const response = await axiosInstance.get(`/api/bridge/status/${pcId}`);
  return response.data;
};

// Register bridge PC
export const registerBridgePC = async (data: {
  pc_id: string;
  hostname: string;
  location: string;
  ip_address?: string;
}) => {
  const response = await axiosInstance.post('/api/bridge/register', data);
  return response.data;
};

// Get bridge config
export const getBridgeConfig = async (pcId: string) => {
  const response = await axiosInstance.get(`/api/bridge/config/${pcId}`);
  return response.data;
};

// Get bridge readings
export const getBridgeReadings = async (params?: {
  pc_id?: string;
  instrument_id?: string;
  limit?: number;
}) => {
  const response = await axiosInstance.get('/api/bridge/readings', { params });
  return response.data;
};

// Start entire bridge service
export const startBridge = async (pcId: string) => {
  const response = await axiosInstance.post(`/api/bridge/${pcId}/start`);
  return response.data;
};

// Stop entire bridge service (gracefully)
export const stopBridge = async (pcId: string) => {
  const response = await axiosInstance.post(`/api/bridge/${pcId}/stop`);
  return response.data;
};

// Restart entire bridge service
export const restartBridge = async (pcId: string) => {
  const response = await axiosInstance.post(`/api/bridge/${pcId}/restart`);
  return response.data;
};

// 🆕 Start instrument
export const startInstrument = async (pcId: string, instrumentId: number) => {
  const response = await axiosInstance.post(
    `/api/bridge/${pcId}/instrument/${instrumentId}/start`
  );
  return response.data;
};

// 🆕 Stop instrument
export const stopInstrument = async (pcId: string, instrumentId: number) => {
  const response = await axiosInstance.post(
    `/api/bridge/${pcId}/instrument/${instrumentId}/stop`
  );
  return response.data;
};

// 🆕 Restart instrument
export const restartInstrument = async (pcId: string, instrumentId: number) => {
  const response = await axiosInstance.post(
    `/api/bridge/${pcId}/instrument/${instrumentId}/restart`
  );
  return response.data;
};

// 🆕 Get instrument status
export const getInstrumentStatus = async (pcId: string, instrumentId: number) => {
  const response = await axiosInstance.get(
    `/api/bridge/${pcId}/instrument/${instrumentId}/status`
  );
  return response.data;
};