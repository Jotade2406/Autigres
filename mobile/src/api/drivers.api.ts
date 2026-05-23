import { apiClient } from './client';
import type { TripResponseDto, UpdateLocationDto, VehicleDto, DriverTripHistoryItemDto } from './types';

export interface RegisterVehicleDto {
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
}

export const driversApi = {
  setOnline: (isOnline: boolean) =>
    apiClient.put('/drivers/availability', { isOnline }),

  updateLocation: (dto: UpdateLocationDto) =>
    apiClient.put('/drivers/location', dto),

  getPendingTrip: (): Promise<TripResponseDto | null> =>
    apiClient
      .get<TripResponseDto | null>('/drivers/pending-trip')
      .then((r) => r.data ?? null),

  getPendingTrips: (): Promise<TripResponseDto[]> =>
    apiClient
      .get<TripResponseDto[]>('/drivers/pending-trips')
      .then((r) => r.data ?? []),

  acceptTrip: (tripUuid: string) =>
    apiClient.post(`/drivers/trips/${tripUuid}/accept`),

  arriveTrip: (tripUuid: string) =>
    apiClient.post(`/drivers/trips/${tripUuid}/arrive`),

  startTrip: (tripUuid: string) =>
    apiClient.post(`/drivers/trips/${tripUuid}/start`),

  pickupPassenger: (tripUuid: string, passengerUuid: string) =>
    apiClient.post(`/drivers/trips/${tripUuid}/passengers/${passengerUuid}/pickup`),

  dropoffPassenger: (tripUuid: string, passengerUuid: string) =>
    apiClient.post(`/drivers/trips/${tripUuid}/passengers/${passengerUuid}/dropoff`),

  completeTrip: (tripUuid: string) =>
    apiClient.post(`/drivers/trips/${tripUuid}/complete`),

  registerVehicle: (dto: RegisterVehicleDto) =>
    apiClient.post('/drivers/vehicle', dto),

  getVehicle: (): Promise<VehicleDto | null> =>
    apiClient
      .get<VehicleDto | null>('/drivers/vehicle')
      .then((r) => r.data ?? null),

  updateVehicle: (id: number, dto: RegisterVehicleDto): Promise<VehicleDto> =>
    apiClient
      .put<VehicleDto>(`/drivers/vehicle/${id}`, dto)
      .then((r) => r.data),

  deleteVehicle: (id: number) =>
    apiClient.delete(`/drivers/vehicle/${id}`),

  getHistory: (): Promise<DriverTripHistoryItemDto[]> =>
    apiClient
      .get<DriverTripHistoryItemDto[]>('/drivers/trips/history')
      .then((r) => r.data),
};
