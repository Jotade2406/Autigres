using Autigres.Core.Enums;

namespace Autigres.Core.Entities;

public class TripRequest
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public int PassengerId { get; set; }
    public double OriginLat { get; set; }
    public double OriginLng { get; set; }
    public string OriginAddress { get; set; } = string.Empty;
    public double DestinationLat { get; set; }
    public double DestinationLng { get; set; }
    public string DestinationAddress { get; set; } = string.Empty;
    public TripRequestStatus Status { get; set; } = TripRequestStatus.Pending;
    public decimal? EstimatedFare { get; set; }
    public string PaymentMethod { get; set; } = "cash";
    public string ServiceTier { get; set; } = "economico";
    public int MaxDetourSeconds { get; set; } = 300;
    public bool IsPoolingAllowed { get; set; } = true;
    public DateTime ExpiresAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Passenger Passenger { get; set; } = null!;
    public TripPassenger? TripPassenger { get; set; }
}
