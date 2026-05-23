using Autigres.Core.Enums;

namespace Autigres.Core.Entities;

public class ShareRequest
{
    public int    Id                  { get; set; }
    public Guid   Uuid                { get; set; } = Guid.NewGuid();
    public int    RequesterRequestId  { get; set; }
    public int    TargetRequestId     { get; set; }
    public ShareRequestStatus Status  { get; set; } = ShareRequestStatus.Pending;
    public int?   CombinedTripId      { get; set; }
    public DateTime CreatedAt         { get; set; }
    public DateTime ExpiresAt         { get; set; }

    public TripRequest RequesterRequest { get; set; } = null!;
    public TripRequest TargetRequest    { get; set; } = null!;
    public Trip?       CombinedTrip     { get; set; }
}
