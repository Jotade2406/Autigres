namespace Autigres.API.DTOs;

public record CreateRatingRequest(
    string TripUuid,
    string RatedUserUuid,
    byte Score,
    string? Comment);
