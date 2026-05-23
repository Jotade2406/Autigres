// ── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserDto;
}

export interface UserDto {
  uuid: string;
  email: string;
  fullName: string;
  role: 'passenger' | 'driver' | 'admin';
  profilePictureUrl?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: 'passenger' | 'driver';
}

// ── Trips ─────────────────────────────────────────────────────────────────────
export interface CreateTripRequestDto {
  originLat: number;
  originLng: number;
  originAddress?: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress?: string;
  maxDetourSeconds?: number;
  isPoolingAllowed: boolean;
  estimatedFare?: number;
  paymentMethod?: 'cash' | 'qr';
  serviceTier?: string;
}

export interface TripRequestStatusDto {
  uuid: string;
  status: 'pending' | 'matching' | 'matched' | 'assigned' | 'cancelled' | 'expired';
  estimatedFare: number;
  expiresAt: string;
  assignedTrip?: TripResponseDto;
}

export interface TripResponseDto {
  tripUuid: string;
  status: 'scheduled' | 'driver_assigned' | 'in_progress' | 'completed' | 'cancelled';
  isPooled: boolean;
  isPoolingAllowed: boolean;
  fareAmount: number;
  estimatedArrivalSeconds: number;
  driver?: DriverSummaryDto;
  vehicle?: VehicleSummaryDto;
  route: WaypointDto[];
  totalPassengers: number;
  passengers?: TripPassengerSummaryDto[];
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  paymentMethod?: 'cash' | 'qr';
  arrivedAt?: string;
  serviceTier?: string;
}

export interface WaypointDto {
  lat: number;
  lng: number;
  waypointType: 'route' | 'pickup' | 'dropoff';
}

// ── Driver ────────────────────────────────────────────────────────────────────
export interface DriverSummaryDto {
  driverUuid: string;
  fullName: string;
  ratingAverage: number;
  profilePictureUrl?: string;
  phone?: string;
}

export interface VehicleSummaryDto {
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  color: string;
}

export interface TripPassengerSummaryDto {
  passengerUuid: string;
  fullName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupOrder: number;
  dropoffOrder: number;
  status: 'waiting' | 'picked_up' | 'dropped_off' | 'cancelled' | 'no_show';
}

export interface UpdateLocationDto {
  lat: number;
  lng: number;
}

export interface ShortestPathDto {
  totalTimeSeconds: number;
  totalDistanceMeters: number;
  estimatedFare: number;
  polyline: { lat: number; lng: number }[];
}

// ── Vehicle ───────────────────────────────────────────────────────────────────
export interface VehicleDto {
  id: number;
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
  isActive: boolean;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export interface UserProfileDto {
  uuid: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'passenger' | 'driver' | 'admin';
  profilePictureUrl?: string;
  ratingAverage: number;
  totalTrips: number;
}

// ── Ratings ───────────────────────────────────────────────────────────────────
export interface CreateRatingDto {
  tripUuid: string;
  ratedUserUuid: string;
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
}

// ── Share requests ────────────────────────────────────────────────────────────
export interface NearbyPassengerDto {
  requestUuid: string;
  passengerName: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupDistanceKm: number;
  destinationDistanceKm: number;
}

export interface ShareRequestCreatedDto {
  uuid: string;
}

export interface ShareRequestStatusDto {
  uuid: string;
  status: 'pending' | 'accepted' | 'rejected';
  partnerName: string;
  combinedTripUuid?: string;
  expiresAt: string;
}

export interface IncomingShareRequestDto {
  uuid: string;
  requesterName: string;
  requesterPickupAddress: string;
  requesterDestinationAddress: string;
  expiresAt: string;
}

export interface AcceptShareResponseDto {
  combinedTripUuid: string;
}

// ── History ───────────────────────────────────────────────────────────────────
export interface TripHistoryItemDto {
  tripUuid: string;
  createdAt: string;
  completedAt?: string;
  originAddress: string;
  destinationAddress: string;
  fareAmount: number;
  isPooled: boolean;
  status: string;
  sharedWith?: string;
}

export interface DriverTripHistoryItemDto {
  tripUuid: string;
  createdAt: string;
  completedAt?: string;
  originAddress: string;
  destinationAddress: string;
  fareAmount: number;
  isPooled: boolean;
  passengerCount: number;
  status: string;
}
