namespace Autigres.API.DTOs;

public record ShortestPathRequest(
    double FromLat,
    double FromLng,
    double ToLat,
    double ToLng);

public record RouteCoordDto(double Lat, double Lng);

public record ShortestPathResponse(
    double TotalTimeSeconds,
    double TotalDistanceMeters,
    decimal EstimatedFare,
    IReadOnlyList<RouteCoordDto> Polyline);
