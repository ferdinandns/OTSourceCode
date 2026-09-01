import { useQuery } from '@tanstack/react-query';
import Api from '../../services/api';
import Cookies from 'js-cookie';

export interface Lokasi {
    id: number;
    nama: string;
    kode: string;
}

export interface User {
    id: number;
    name: string;
    username: string;
    email: string;
    role: string;
    user_group: number;
    lokasi_utama_id?: number | null;
    lokasi_aktif_id?: number | null;
    lokasi_utama?: Lokasi;
    lokasi_aktif?: Lokasi;
    lokasi_tambahan: Lokasi[]; // non-optional, defaults to []
}

export const useUserById = (id: number) => {
    return useQuery<User, Error>({
        queryKey: ['user', id],
        queryFn: async () => {
            const token = Cookies.get('token');
            const response = await Api.get(`/api/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = response.data.data;
            // Ensure lokasi_tambahan is always an array
            return { ...data, lokasi_tambahan: data.lokasi_tambahan ?? [] } as User;
        },
    });
};