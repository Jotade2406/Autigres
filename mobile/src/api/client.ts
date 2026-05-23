import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Android emulator → 10.0.2.2 mapea al localhost del host.
// iOS simulator / dispositivo físico → usar la IP local de la máquina.
const BASE_URL = 'https://autigres.fly.dev/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: inyecta JWT
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: maneja 401 → logout
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('auth_user');
      // El store de auth detectará la ausencia del token en el próximo render
    }
    return Promise.reject(error);
  }
);
