using Autigres.Core.Entities;

namespace Autigres.Core.Graph;

/// <summary>
/// Grafo vial en memoria. Singleton thread-safe cargado al boot desde la BD.
/// Usa ReaderWriterLockSlim para permitir lecturas concurrentes sin bloqueo.
/// </summary>
public class CityGraph
{
    private readonly ReaderWriterLockSlim _lock = new();
    private Dictionary<int, GraphNode> _nodes = new();
    private Dictionary<string, int> _keyToId = new();
    private bool _isLoaded;

    public bool IsLoaded
    {
        get
        {
            _lock.EnterReadLock();
            try { return _isLoaded; }
            finally { _lock.ExitReadLock(); }
        }
    }

    public int NodeCount
    {
        get
        {
            _lock.EnterReadLock();
            try { return _nodes.Count; }
            finally { _lock.ExitReadLock(); }
        }
    }

    public int EdgeCount
    {
        get
        {
            _lock.EnterReadLock();
            try { return _nodes.Values.Sum(n => n.OutgoingEdges.Count); }
            finally { _lock.ExitReadLock(); }
        }
    }

    /// <summary>
    /// Carga el grafo completo desde la base de datos.
    /// Si is_bidirectional=true, agrega la arista inversa además de la original.
    /// </summary>
    public void LoadGraph(IEnumerable<GraphNode> nodes, IEnumerable<GraphEdge> edges)
    {
        _lock.EnterWriteLock();
        try
        {
            _nodes = new Dictionary<int, GraphNode>();
            _keyToId = new Dictionary<string, int>(StringComparer.Ordinal);

            foreach (var node in nodes)
            {
                node.OutgoingEdges = new List<GraphEdge>();
                node.IncomingEdges = new List<GraphEdge>();
                _nodes[node.Id] = node;
                _keyToId[node.NodeKey] = node.Id;
            }

            foreach (var edge in edges)
            {
                if (!_nodes.TryGetValue(edge.FromNodeId, out var fromNode) ||
                    !_nodes.TryGetValue(edge.ToNodeId, out var toNode))
                    continue;

                edge.FromNode = fromNode;
                edge.ToNode = toNode;
                fromNode.OutgoingEdges.Add(edge);
                toNode.IncomingEdges.Add(edge);

                if (edge.IsBidirectional)
                {
                    var reverse = new GraphEdge
                    {
                        Id = -edge.Id,
                        FromNodeId = edge.ToNodeId,
                        ToNodeId = edge.FromNodeId,
                        DistanceMeters = edge.DistanceMeters,
                        TimeSecondsAvg = edge.TimeSecondsAvg,
                        RoadName = edge.RoadName,
                        IsBidirectional = true,
                        FromNode = toNode,
                        ToNode = fromNode
                    };
                    toNode.OutgoingEdges.Add(reverse);
                    fromNode.IncomingEdges.Add(reverse);
                }
            }

            _isLoaded = true;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
    }

    public GraphNode? GetNode(int id)
    {
        _lock.EnterReadLock();
        try { return _nodes.GetValueOrDefault(id); }
        finally { _lock.ExitReadLock(); }
    }

    public GraphNode? GetNodeByKey(string key)
    {
        _lock.EnterReadLock();
        try
        {
            return _keyToId.TryGetValue(key, out var id)
                ? _nodes.GetValueOrDefault(id)
                : null;
        }
        finally { _lock.ExitReadLock(); }
    }

    public IReadOnlyDictionary<int, GraphNode> GetAllNodes()
    {
        _lock.EnterReadLock();
        try { return _nodes; }
        finally { _lock.ExitReadLock(); }
    }
}
