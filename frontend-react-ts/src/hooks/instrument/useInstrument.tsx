import { useQuery } from "@tanstack/react-query";
import { getInstruments } from "../../api/instrument";

interface InstrumentData {
  Id: number;
  NamaInstrument: string;
  NomorKontrol: string;
  PICInstrument: string;
  LokasiInstrument: string;
  LokasiSite: string;
  TanggalKalibrasi: string;
  EDKalibrasi: string;
  Status: string;
  TanggalStockOpname?: string;
  PICStockOpname?: string;
  KalibrasiColorCode?: string;
  bridge_pc_id?: string;
  bridge_port?: string;
  bridge_baudrate?: number;
  bridge_status?: string;
  last_bridge_seen?: string;
}

interface PaginatedResponse {
  data: InstrumentData[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

//Wrapper untuk response backend
interface BackendResponse {
  status: string;
  message: string;
  data: PaginatedResponse;
}

export const useInstruments = () => {
  return useQuery<BackendResponse>({
    queryKey: ["instruments"],
    queryFn: () => getInstruments({ limit: 9999, page: 1 }),
  });
};