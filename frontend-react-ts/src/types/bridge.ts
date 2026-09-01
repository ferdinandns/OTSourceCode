export interface BridgePC {
  id: number;
  pc_id: string;
  hostname: string;
  location: string;
  ip_address?: string;
  status: 'online' | 'offline';
  last_seen?: string;
  created_at: string;
  updated_at: string;
  instrument_count?: number;
}

export interface BridgeReading {
  id: number;
  pc_id: string;
  instrument_id: number;
  value: string;
  unit?: string;
  additional_data?: Record<string, any>;
  read_at: string;
  created_at: string;
  instrument?: {
    id: number;
    name: string;
    instrument_code: string;
  };
}

export interface BridgeInstrumentConfig {
  id: number;
  name: string;
  code: string;
  port: string;
  baudrate: number;
  data_bits: number;
  stop_bits: number;
  parity: string;
  read_command?: string;
  regex_pattern?: string;
  ip_address?: string;
  tcp_port?: number;
  timeout?: number;
}

export interface BridgeConfigResponse {
  status: string;
  data: {
    pc_id: string;
    instruments: BridgeInstrumentConfig[];
    count: number;
    fetched_at: string;
  };
}

export interface CreateBridgePCPayload {
  pc_id: string;
  hostname: string;
  location: string;
  ip_address?: string;
}

export interface BridgePCWithCount extends BridgePC {
  instrument_count: number;
}
