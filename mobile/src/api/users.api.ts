import { apiClient } from './client';
import type { UserProfileDto } from './types';

export const usersApi = {
  getProfile: () =>
    apiClient.get<UserProfileDto>('/users/profile').then((r) => r.data),
};
