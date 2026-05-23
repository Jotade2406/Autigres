namespace Autigres.API.DTOs;

public record UserProfileResponse(
    string Uuid,
    string FullName,
    string Email,
    string Phone,
    string Role,
    string? ProfilePictureUrl,
    decimal RatingAverage,
    int TotalTrips);
