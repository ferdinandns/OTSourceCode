import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

console.log('🔧 API Configuration:');
console.log('  - VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('  - API_BASE_URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? '';
    const status = error.response?.status;

    // Public endpoints — never redirect on 401, just reject
    const publicEndpoints = ['/api/login', '/api/register', '/api/lokasi'];
    const isPublicEndpoint = publicEndpoints.some((ep) => url.includes(ep));

    // Only redirect if:
    // 1. Got a 401
    // 2. It's not a public endpoint
    // 3. User actually had a token (i.e. was logged in and session expired)
    const hadToken = !!Cookies.get('token');

    if (status === 401 && !isPublicEndpoint && hadToken) {
      Cookies.remove('token');
      Cookies.remove('user');
      Cookies.remove('current_lokasi');
      _logout?.();
      _navigate?.('/', { replace: true, state: { reason: 'session_expired' } });
    }
    return Promise.reject(error);
  }
);

let _logout: (() => void) | null = null;
let _navigate: ((path: string, opts?: object) => void) | null = null;

export const setupInterceptors = (
  logout: () => void,
  navigate: (path: string, opts?: object) => void
) => {
  _logout = logout;
  _navigate = navigate;
};

// Types
export interface RegisterData {
  name: string;
  email: string;
  username: string;
  password: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
  };
}

export const authAPI = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<AuthResponse['user']> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
};



export default api;