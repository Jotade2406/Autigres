import { apiClient } from './client';
import type { AuthResponse, LoginDto, RegisterDto } from './types';

export const authApi = {
  login: (dto: LoginDto) =>
    apiClient.post<AuthResponse>('/auth/login', dto).then((r) => r.data),

  register: (dto: RegisterDto) =>
    apiClient.post<AuthResponse>('/auth/register', dto).then((r) => r.data),

  me: () =>
    apiClient.get<AuthResponse['user']>('/auth/me').then((r) => r.data),
};
