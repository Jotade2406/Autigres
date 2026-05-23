namespace Autigres.API.DTOs;

public record CreateTripRequestBody(
    double OriginLat,
    double OriginLng,
    string? OriginAddress,
    double DestinationLat,
    double DestinationLng,
    string? DestinationAddress,
    int MaxDetourSeconds = 300,
    bool IsPoolingAllowed = true,
    decimal? EstimatedFare = null,
    string? PaymentMethod = null);

public record TripRequestStatusResponse(
    string Uuid,
    string Status,
    decimal? EstimatedFare,
    DateTime ExpiresAt,
    TripResponse? AssignedTrip);

public record TripResponse(
    string TripUuid,
    string Status,
    bool IsPooled,
    bool IsPoolingAllowed,
    decimal FareAmount,
    int EstimatedArrivalSeconds,
    DriverSummaryDto? Driver,
    VehicleSummaryDto? Vehicle,
    List<WaypointDto> Route,
    int TotalPassengers,
    List<TripPassengerSummaryDto>? Passengers,
    double OriginLat = 0,
    double OriginLng = 0,
    double DestinationLat = 0,
    double DestinationLng = 0,
    string PaymentMethod = "cash",
    string? ArrivedAt = null);

public record DriverSummaryDto(
    string DriverUuid,
    string FullName,
    decimal RatingAverage,
    string? ProfilePictureUrl,
    string? Phone = null);

public record VehicleSummaryDto(
    string PlateNumber,
    string Brand,
    string Model,
    int Year,
    string Color);

public record WaypointDto(double Lat, double Lng, string WaypointType);

public record TripPassengerSummaryDto(
    string PassengerUuid,
    string FullName,
    string PickupAddress,
    string DropoffAddress,
    byte PickupOrder,
    byte DropoffOrder,
    string Status);

// ── Share request DTOs ────────────────────────────────────────────────────────

public record CreateShareRequestBody(string MyRequestUuid, string TargetRequestUuid);

public record NearbyPassengerDto(
    string RequestUuid,
    string PassengerName,
    string PickupAddress,
    string DestinationAddress,
    double PickupDistanceKm,
    double DestinationDistanceKm);

public record ShareRequestCreatedDto(string Uuid);

public record ShareRequestStatusDto(
    string Uuid,
    string Status,       // "pending" | "accepted" | "rejected"
    string PartnerName,
    string? CombinedTripUuid,
    string ExpiresAt);

public record IncomingShareRequestDto(
    string Uuid,
    string RequesterName,
    string RequesterPickupAddress,
    string RequesterDestinationAddress,
    string ExpiresAt);

public record AcceptShareResponseDto(string CombinedTripUuid);


public record TripHistoryItemDto(
    string TripUuid,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    string OriginAddress,
    string DestinationAddress,
    decimal FareAmount,
    bool IsPooled,
    string Status,
    string? SharedWith = null);
