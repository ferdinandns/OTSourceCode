import { useQuery } from '@tanstack/react-query';
import Api from '../../services/api';

export interface Lokasi {
    id: number;
    nama: string;
    kode: string;
}

export const useLokasi = () => {
    return useQuery<Lokasi[], Error>({
        queryKey: ['lokasi'],
        queryFn: async () => {
            const response = await Api.get('/api/lokasi');
            return response.data.data as Lokasi[];
        }
    });
};