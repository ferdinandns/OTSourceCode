import { useQuery } from '@tanstack/react-query';
import Api from '../../services/api';
import Cookies from 'js-cookie';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  roles: string[];
  user_group: number;
}

// Full user list — only call this for group <= 3 (supervisor and above).
// For group 4 (analysts), use useUserSupervisors() instead.
export const useUsers = (enabled = true) => {
  return useQuery<User[], Error>({
    queryKey: ['users'],
    enabled,  // pass false to skip the call entirely
    queryFn: async () => {
      const token = Cookies.get('token');
      const response = await Api.get('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data as User[];
    }
  });
};

// Supervisor list — safe for all authenticated users (group 1–5).
// Used in instrument create/edit forms when analyst is logged in.
export const useUserSupervisors = (lokasiId?: number) => {
  return useQuery<User[], Error>({
    queryKey: ['users', 'supervisors', lokasiId],
    queryFn: async () => {
      const token = Cookies.get('token');
      const params = lokasiId ? `?location=${lokasiId}` : '';
      const response = await Api.get(`/api/users/supervisors${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.data as User[];
    }
  });
};