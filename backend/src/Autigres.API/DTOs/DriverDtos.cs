namespace Autigres.API.DTOs;

public record UpdateLocationRequest(double Lat, double Lng);

public record SetAvailabilityRequest(bool IsOnline);

public record AcceptTripRequest();

public record RegisterVehicleRequest(
    string PlateNumber,
    string Brand,
    string Model,
    int Year,
    string Color,
    byte Capacity);

public record UpdateVehicleRequest(
    string PlateNumber,
    string Brand,
    string Model,
    int Year,
    string Color,
    byte Capacity);

public record VehicleResponse(
    int Id,
    string PlateNumber,
    string Brand,
    string Model,
    int Year,
    string Color,
    byte Capacity,
    bool IsActive);

public record DriverTripHistoryItem(
    string TripUuid,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    string OriginAddress,
    string DestinationAddress,
    decimal FareAmount,
    bool IsPooled,
    int PassengerCount,
    string Status);
