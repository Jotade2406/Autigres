import { apiClient } from './client';
import type {
  CreateTripRequestDto,
  TripRequestStatusDto,
  TripResponseDto,
  TripHistoryItemDto,
  CreateRatingDto,
  ShortestPathDto,
  NearbyPassengerDto,
  ShareRequestCreatedDto,
  ShareRequestStatusDto,
  IncomingShareRequestDto,
  AcceptShareResponseDto,
} from './types';

export const tripsApi = {
  createRequest: (dto: CreateTripRequestDto) =>
    apiClient.post<TripRequestStatusDto>('/trips/requests', dto).then((r) => r.data),

  getRequest: (uuid: string) =>
    apiClient.get<TripRequestStatusDto>(`/trips/requests/${uuid}`).then((r) => r.data),

  cancelRequest: (uuid: string) =>
    apiClient.delete(`/trips/requests/${uuid}`),

  getTrip: (uuid: string) =>
    apiClient.get<TripResponseDto>(`/trips/${uuid}`).then((r) => r.data),

  completeTrip: (uuid: string) =>
    apiClient.post(`/trips/${uuid}/complete`),

  cancelTrip: (uuid: string) =>
    apiClient.post(`/trips/${uuid}/cancel`),

  getHistory: () =>
    apiClient.get<TripHistoryItemDto[]>('/trips/history').then((r) => r.data),

  submitRating: (dto: CreateRatingDto) =>
    apiClient.post('/ratings', dto),

  getShortestPath: (
    originLat: number, originLng: number,
    destLat: number, destLng: number
  ) =>
    apiClient.post<ShortestPathDto>('/graph/shortest-path', {
      fromLat: originLat, fromLng: originLng,
      toLat: destLat,     toLng: destLng,
    }).then((r) => r.data),

  getTripRoute: (uuid: string) =>
    apiClient.get<ShortestPathDto>(`/trips/${uuid}/route`).then((r) => r.data),

  // ── Share requests ──────────────────────────────────────────────────────────
  getNearbyPartner: (requestUuid: string) =>
    apiClient.get<NearbyPassengerDto | null>(`/trips/requests/${requestUuid}/nearby`)
      .then((r) => r.data || null),

  createShareRequest: (myRequestUuid: string, targetRequestUuid: string) =>
    apiClient.post<ShareRequestCreatedDto>('/trips/share-requests', { myRequestUuid, targetRequestUuid })
      .then((r) => r.data),

  getShareRequest: (shareUuid: string) =>
    apiClient.get<ShareRequestStatusDto>(`/trips/share-requests/${shareUuid}`)
      .then((r) => r.data),

  getIncomingShareRequest: (requestUuid: string) =>
    apiClient.get<IncomingShareRequestDto | null>(`/trips/share-requests/incoming?requestUuid=${requestUuid}`)
      .then((r) => r.data || null),

  acceptShareRequest: (shareUuid: string) =>
    apiClient.post<AcceptShareResponseDto>(`/trips/share-requests/${shareUuid}/accept`)
      .then((r) => r.data),

  rejectShareRequest: (shareUuid: string) =>
    apiClient.post(`/trips/share-requests/${shareUuid}/reject`),

};
