import { useQuery, useMutation } from '@tanstack/react-query';
import Api from '../../services/api';
import Cookies from 'js-cookie';

export interface ProfileUpdateRequest {
    username: string;
    current_password: string;
    new_password?: string;
}

// Fetch the currently logged-in user's own profile
export const useProfile = () => {
    return useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const token = Cookies.get('token');
            const response = await Api.get('/api/profile', {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data.data;
        },
    });
};

// Self-service: update own username and/or password
export const useProfileUpdate = () => {
    return useMutation({
        mutationFn: async (data: ProfileUpdateRequest) => {
            const token = Cookies.get('token');
            const response = await Api.put('/api/profile', data, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return response.data;
        },
    });
};