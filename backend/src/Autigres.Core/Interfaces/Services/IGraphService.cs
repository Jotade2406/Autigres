using Autigres.Core.Entities;
using Autigres.Core.Graph;

namespace Autigres.Core.Interfaces.Services;

public interface IGraphService
{
    ShortestPathResult FindShortestPath(int sourceNodeId, int targetNodeId, PathWeight weightType = PathWeight.Time);
    int? ResolveNearestNode(double lat, double lng);
    GraphNode? GetNode(int nodeId);
}
