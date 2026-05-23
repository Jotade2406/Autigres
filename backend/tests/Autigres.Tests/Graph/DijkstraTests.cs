using Autigres.Core.Entities;
using Autigres.Core.Graph;
using FluentAssertions;
using Xunit;

namespace Autigres.Tests.Graph;

public class DijkstraTests
{
    // Grafo de prueba:
    //
    //   1 --10s--> 2 --20s--> 3
    //   |                     |
    //  30s                   10s
    //   |                     |
    //   4 --------5s-------> 5
    //
    // Ruta mínima 1→5 por tiempo: 1→2→3→5 = 40s
    // Ruta alternativa: 1→4→5 = 35s  ← debería ser la elegida

    private static CityGraph BuildTestGraph()
    {
        var nodes = new List<GraphNode>
        {
            new() { Id = 1, NodeKey = "N1", Lat = 0, Lng = 0 },
            new() { Id = 2, NodeKey = "N2", Lat = 0, Lng = 1 },
            new() { Id = 3, NodeKey = "N3", Lat = 0, Lng = 2 },
            new() { Id = 4, NodeKey = "N4", Lat = 1, Lng = 0 },
            new() { Id = 5, NodeKey = "N5", Lat = 1, Lng = 2 }
        };

        var edges = new List<GraphEdge>
        {
            new() { Id = 1, FromNodeId = 1, ToNodeId = 2, TimeSecondsAvg = 10, DistanceMeters = 100, IsBidirectional = false },
            new() { Id = 2, FromNodeId = 2, ToNodeId = 3, TimeSecondsAvg = 20, DistanceMeters = 200, IsBidirectional = false },
            new() { Id = 3, FromNodeId = 3, ToNodeId = 5, TimeSecondsAvg = 10, DistanceMeters = 100, IsBidirectional = false },
            new() { Id = 4, FromNodeId = 1, ToNodeId = 4, TimeSecondsAvg = 30, DistanceMeters = 300, IsBidirectional = false },
            new() { Id = 5, FromNodeId = 4, ToNodeId = 5, TimeSecondsAvg =  5, DistanceMeters =  50, IsBidirectional = false },
            new() { Id = 6, FromNodeId = 2, ToNodeId = 4, TimeSecondsAvg = 99, DistanceMeters = 999, IsBidirectional = false }
        };

        var graph = new CityGraph();
        graph.LoadGraph(nodes, edges);
        return graph;
    }

    [Fact]
    public void FindShortestPath_ByTime_ReturnsOptimalRoute()
    {
        var graph = BuildTestGraph();
        var dijkstra = new DijkstraAlgorithm(graph);

        var result = dijkstra.FindShortestPath(1, 5, PathWeight.Time);

        result.IsReachable.Should().BeTrue();
        // 1→4→5 = 35s es más rápido que 1→2→3→5 = 40s
        result.TotalTimeSeconds.Should().Be(35);
        result.NodePath.Should().Equal(1, 4, 5);
    }

    [Fact]
    public void FindShortestPath_ByDistance_ReturnsShortestDistance()
    {
        var graph = BuildTestGraph();
        var dijkstra = new DijkstraAlgorithm(graph);

        var result = dijkstra.FindShortestPath(1, 5, PathWeight.Distance);

        result.IsReachable.Should().BeTrue();
        // 1→4→5 = 350m  vs  1→2→3→5 = 400m
        result.TotalDistanceMeters.Should().Be(350);
    }

    [Fact]
    public void FindShortestPath_SameNode_ReturnsZeroCost()
    {
        var graph = BuildTestGraph();
        var dijkstra = new DijkstraAlgorithm(graph);

        var result = dijkstra.FindShortestPath(1, 1);

        result.IsReachable.Should().BeTrue();
        result.TotalTimeSeconds.Should().Be(0);
        result.NodePath.Should().Equal(1);
    }

    [Fact]
    public void FindShortestPath_UnreachableNode_ReturnsNotReachable()
    {
        var graph = BuildTestGraph();
        var dijkstra = new DijkstraAlgorithm(graph);

        // Ninguna arista llega al nodo 1 desde otros (todas son unidireccionales saliendo de 1)
        // Intentar llegar a 1 desde 5 debe ser inalcanzable
        var result = dijkstra.FindShortestPath(5, 1);

        result.IsReachable.Should().BeFalse();
    }

    [Fact]
    public void FindShortestPath_NonExistentNode_ReturnsNotReachable()
    {
        var graph = BuildTestGraph();
        var dijkstra = new DijkstraAlgorithm(graph);

        var result = dijkstra.FindShortestPath(1, 999);

        result.IsReachable.Should().BeFalse();
    }

    [Fact]
    public void CityGraph_LoadGraph_BidirectionalEdgesExpandCorrectly()
    {
        var nodes = new List<GraphNode>
        {
            new() { Id = 1, NodeKey = "A", Lat = 0, Lng = 0 },
            new() { Id = 2, NodeKey = "B", Lat = 0, Lng = 1 }
        };
        var edges = new List<GraphEdge>
        {
            new() { Id = 1, FromNodeId = 1, ToNodeId = 2, TimeSecondsAvg = 60, DistanceMeters = 200, IsBidirectional = true }
        };

        var graph = new CityGraph();
        graph.LoadGraph(nodes, edges);

        // Bidireccional: debe poder ir en ambas direcciones
        var dijkstra = new DijkstraAlgorithm(graph);
        dijkstra.FindShortestPath(1, 2).IsReachable.Should().BeTrue();
        dijkstra.FindShortestPath(2, 1).IsReachable.Should().BeTrue();
    }
}
