using Autigres.Core.Enums;

namespace Autigres.Core.Entities;

public class User
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? ProfilePictureUrl { get; set; }
    public UserRole Role { get; set; } = UserRole.Passenger;
    public UserStatus Status { get; set; } = UserStatus.PendingVerification;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Passenger? Passenger { get; set; }
    public Driver? Driver { get; set; }
}
