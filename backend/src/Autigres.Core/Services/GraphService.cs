using Autigres.Core.Entities;
using Autigres.Core.Graph;
using Autigres.Core.Interfaces.Services;

namespace Autigres.Core.Services;

public class GraphService : IGraphService
{
    private readonly CityGraph _graph;
    private readonly DijkstraAlgorithm _dijkstra;

    public GraphService(CityGraph graph, DijkstraAlgorithm dijkstra)
    {
        _graph = graph;
        _dijkstra = dijkstra;
    }

    public ShortestPathResult FindShortestPath(
        int sourceNodeId, int targetNodeId, PathWeight weightType = PathWeight.Time)
        => _dijkstra.FindShortestPath(sourceNodeId, targetNodeId, weightType);

    /// <summary>
    /// Encuentra el nodo del grafo más cercano a las coordenadas dadas.
    /// Usa distancia euclidiana sobre lat/lng (suficiente para distancias cortas en ciudad).
    /// </summary>
    public GraphNode? GetNode(int nodeId) => _graph.GetNode(nodeId);

    public int? ResolveNearestNode(double lat, double lng)
    {
        var nodes = _graph.GetAllNodes();
        if (nodes.Count == 0) return null;

        return nodes.Values
            .OrderBy(n => Math.Pow(n.Lat - lat, 2) + Math.Pow(n.Lng - lng, 2))
            .First().Id;
    }
}
