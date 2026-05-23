using Autigres.Core.Enums;

namespace Autigres.Core.Entities;

public class Trip
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public int? DriverId { get; set; }
    public int? VehicleId { get; set; }
    public TripStatus Status { get; set; } = TripStatus.Scheduled;
    public double OriginLat { get; set; }
    public double OriginLng { get; set; }
    public string OriginAddress { get; set; } = string.Empty;
    public double DestinationLat { get; set; }
    public double DestinationLng { get; set; }
    public string DestinationAddress { get; set; } = string.Empty;
    public decimal? TotalDistanceKm { get; set; }
    public decimal? BaseFare { get; set; }
    public bool IsPoolingAllowed { get; set; } = false;
    public string PaymentMethod { get; set; } = "cash";
    public string ServiceTier { get; set; } = "economico";
    public DateTime? ArrivedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Driver? Driver { get; set; }
    public Vehicle? Vehicle { get; set; }
    public ICollection<TripPassenger> TripPassengers { get; set; } = new List<TripPassenger>();
    public ICollection<RouteWaypoint> RouteWaypoints { get; set; } = new List<RouteWaypoint>();
    public ICollection<Rating> Ratings { get; set; } = new List<Rating>();
}
