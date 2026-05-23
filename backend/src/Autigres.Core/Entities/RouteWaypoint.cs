namespace Autigres.Core.Entities;

public enum WaypointType { Route, Pickup, Dropoff }

public class RouteWaypoint
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public short SequenceOrder { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
    public string? NodeRef { get; set; }
    public WaypointType WaypointType { get; set; } = WaypointType.Route;
    public DateTime? ArrivedAt { get; set; }

    public Trip Trip { get; set; } = null!;
}
