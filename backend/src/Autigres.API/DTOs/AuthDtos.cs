namespace Autigres.API.DTOs;

public record LoginRequest(string Email, string Password);

public record RegisterRequest(
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string Password,
    string Role);   // "passenger" | "driver"

public record AuthResponse(
    string AccessToken,
    string TokenType,
    int ExpiresIn,
    UserSummary User);

public record UserSummary(
    string Uuid,
    string Email,
    string FullName,
    string Role,
    string? ProfilePictureUrl);
