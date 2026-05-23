namespace Autigres.Core.Entities;

public class GraphNode
{
    public int Id { get; set; }
    public string NodeKey { get; set; } = string.Empty;
    public double Lat { get; set; }
    public double Lng { get; set; }
    public string City { get; set; } = "Santa Cruz de la Sierra";
    public string? AddressReference { get; set; }

    public ICollection<GraphEdge> OutgoingEdges { get; set; } = new List<GraphEdge>();
    public ICollection<GraphEdge> IncomingEdges { get; set; } = new List<GraphEdge>();
}
