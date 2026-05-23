using Autigres.Core.Enums;

namespace Autigres.Core.Entities;

public class TripPassenger
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public int PassengerId { get; set; }
    public int RequestId { get; set; }
    public double PickupLat { get; set; }
    public double PickupLng { get; set; }
    public string PickupAddress { get; set; } = string.Empty;
    public double DropoffLat { get; set; }
    public double DropoffLng { get; set; }
    public string DropoffAddress { get; set; } = string.Empty;
    public byte PickupOrder { get; set; }
    public byte DropoffOrder { get; set; }
    public decimal? FareAmount { get; set; }
    public TripPassengerStatus Status { get; set; } = TripPassengerStatus.Waiting;
    public int AddedDetourSeconds { get; set; }
    public DateTime? PickedUpAt { get; set; }
    public DateTime? DroppedOffAt { get; set; }

    public Trip Trip { get; set; } = null!;
    public Passenger Passenger { get; set; } = null!;
    public TripRequest Request { get; set; } = null!;
    public Payment? Payment { get; set; }
}
