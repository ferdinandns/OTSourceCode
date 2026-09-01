import { useMutation } from '@tanstack/react-query';
import Api from '../../services/api';
import Cookies from 'js-cookie';

interface UserRequest {
    name: string;
    username: string;
    email: string;
    password: string;
    role: string;
    lokasi_utama_id: number;
    lokasi_tambahan_ids?: number[];
}

export const useUserCreate = () => {
    return useMutation({
        mutationFn: async (data: UserRequest) => {
            const token = Cookies.get('token');
            const response = await Api.post('/api/users', data, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data;
        }
    });
};