namespace Autigres.Core.Graph;

/// <summary>
/// Implementación de Dijkstra sobre <see cref="CityGraph"/>.
/// Usa <see cref="PriorityQueue{TElement,TPriority}"/> de .NET 6+ para O((V+E) log V).
/// Mantiene acumuladores paralelos de tiempo Y distancia para devolver ambas métricas
/// aunque la búsqueda se optimice sólo por una de ellas.
/// </summary>
public class DijkstraAlgorithm
{
    private readonly CityGraph _graph;

    public DijkstraAlgorithm(CityGraph graph)
    {
        _graph = graph;
    }

    public ShortestPathResult FindShortestPath(
        int sourceNodeId,
        int targetNodeId,
        PathWeight weightType = PathWeight.Time)
    {
        var allNodes = _graph.GetAllNodes();

        if (!allNodes.ContainsKey(sourceNodeId) || !allNodes.ContainsKey(targetNodeId))
            return ShortestPathResult.Unreachable;

        if (sourceNodeId == targetNodeId)
            return new ShortestPathResult { IsReachable = true, NodePath = [sourceNodeId] };

        // Acumuladores paralelos: optimizamos por 'weightType', pero siempre rastreamos ambos.
        var distTime = new Dictionary<int, double>(allNodes.Count);
        var distDist = new Dictionary<int, double>(allNodes.Count);
        var prev     = new Dictionary<int, int>();   // nodeId → predecessor nodeId
        var prevEdge = new Dictionary<int, int>();   // nodeId → edge ID used to reach it

        foreach (var id in allNodes.Keys)
        {
            distTime[id] = double.PositiveInfinity;
            distDist[id] = double.PositiveInfinity;
        }
        distTime[sourceNodeId] = 0;
        distDist[sourceNodeId] = 0;

        var pq = new PriorityQueue<int, double>();
        pq.Enqueue(sourceNodeId, 0);

        while (pq.TryDequeue(out var currentId, out var currentPri))
        {
            var settled = weightType == PathWeight.Time ? distTime[currentId] : distDist[currentId];
            if (currentPri > settled)
                continue;

            if (currentId == targetNodeId)
                break;

            var node = allNodes[currentId];
            foreach (var edge in node.OutgoingEdges)
            {
                var neighborId = edge.ToNodeId;
                if (!distTime.ContainsKey(neighborId))
                    continue;

                var newTime = distTime[currentId] + edge.TimeSecondsAvg;
                var newDist = distDist[currentId] + edge.DistanceMeters;

                var newPri    = weightType == PathWeight.Time ? newTime : newDist;
                var oldPri    = weightType == PathWeight.Time ? distTime[neighborId] : distDist[neighborId];

                if (newPri < oldPri)
                {
                    distTime[neighborId] = newTime;
                    distDist[neighborId] = newDist;
                    prev[neighborId]     = currentId;
                    prevEdge[neighborId] = edge.Id;
                    pq.Enqueue(neighborId, newPri);
                }
            }
        }

        if (double.IsPositiveInfinity(distTime[targetNodeId]))
            return ShortestPathResult.Unreachable;

        var nodePath = ReconstructNodePath(prev, sourceNodeId, targetNodeId);
        var edgePath = ReconstructEdgePath(prev, prevEdge, targetNodeId);

        return new ShortestPathResult
        {
            IsReachable         = true,
            TotalTimeSeconds    = distTime[targetNodeId],
            TotalDistanceMeters = distDist[targetNodeId],
            NodePath            = nodePath,
            EdgePath            = edgePath
        };
    }

    private static List<int> ReconstructNodePath(
        Dictionary<int, int> prev, int source, int target)
    {
        var path    = new List<int>();
        var current = target;
        while (prev.TryGetValue(current, out var parent))
        {
            path.Add(current);
            current = parent;
        }
        path.Add(source);
        path.Reverse();
        return path;
    }

    private static List<int> ReconstructEdgePath(
        Dictionary<int, int> prev, Dictionary<int, int> prevEdge, int target)
    {
        var edges   = new List<int>();
        var current = target;
        while (prevEdge.TryGetValue(current, out var edgeId))
        {
            edges.Add(edgeId);
            current = prev[current];   // walk back along node predecessors
        }
        edges.Reverse();
        return edges;
    }
}
