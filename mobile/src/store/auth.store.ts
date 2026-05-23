import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResponse, UserDto } from '../api/types';

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_user';

interface AuthState {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  login: (response: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isRestoring: true,

  login: async (response: AuthResponse) => {
    await AsyncStorage.setItem(TOKEN_KEY, response.accessToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
    set({ user: response.user, token: response.accessToken, isAuthenticated: true });
  },

  logout: async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      const [token, userRaw] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      if (token && userRaw) {
        const user: UserDto = JSON.parse(userRaw);
        set({ user, token, isAuthenticated: true });
      }
    } catch {
      // sesión inválida, ignorar
    } finally {
      set({ isRestoring: false });
    }
  },
}));
