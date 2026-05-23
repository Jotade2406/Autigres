namespace Autigres.Core.Entities;

public class GraphEdge
{
    public int Id { get; set; }
    public int FromNodeId { get; set; }
    public int ToNodeId { get; set; }
    public double DistanceMeters { get; set; }
    public int TimeSecondsAvg { get; set; }
    public string? RoadName { get; set; }
    public bool IsBidirectional { get; set; } = true;

    public GraphNode FromNode { get; set; } = null!;
    public GraphNode ToNode { get; set; } = null!;
}
