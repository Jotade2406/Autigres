namespace Autigres.Core.Entities;

public class Driver
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? LicenseNumber { get; set; }
    public DateOnly? LicenseExpiry { get; set; }
    public decimal RatingAverage { get; set; } = 5.00m;
    public int TotalTrips { get; set; }
    public bool IsAvailable { get; set; }
    public bool IsOnline { get; set; }
    public double? CurrentLat { get; set; }
    public double? CurrentLng { get; set; }
    public DateTime? LastLocationUpdate { get; set; }
    public DateTime? VerifiedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
}
