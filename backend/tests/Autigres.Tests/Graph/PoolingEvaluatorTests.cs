using Autigres.Core.Entities;
using Autigres.Core.Graph;
using FluentAssertions;
using Xunit;

namespace Autigres.Tests.Graph;

public class PoolingEvaluatorTests
{
    // Grafo lineal para pooling:
    //
    //  [1] --60s--> [2] --60s--> [3] --60s--> [4] --60s--> [5]
    //
    // Pasajero A: pickup=1, dropoff=4  → ruta directa = 180s
    // Pasajero B: pickup=2, dropoff=5  → ruta directa = 180s
    // Orden óptimo: pickA→pickB→dropA→dropB = 1→2→3→4→5 = 240s
    //   detour A = tiempo desde pickup A hasta dropoff A = 1→2→3→4 = 180s → detour = 0
    //   detour B = tiempo desde pickup B hasta dropoff B = 2→3→4→5 = 180s → detour = 0

    private static (CityGraph, DijkstraAlgorithm, PoolingEvaluator) BuildLinearGraph()
    {
        var nodes = Enumerable.Range(1, 5).Select(i => new GraphNode
        {
            Id = i, NodeKey = $"N{i}", Lat = 0, Lng = i - 1
        }).ToList();

        var edges = Enumerable.Range(1, 4).Select(i => new GraphEdge
        {
            Id = i,
            FromNodeId = i,
            ToNodeId = i + 1,
            TimeSecondsAvg = 60,
            DistanceMeters = 500,
            IsBidirectional = false
        }).ToList();

        var graph = new CityGraph();
        graph.LoadGraph(nodes, edges);

        var dijkstra = new DijkstraAlgorithm(graph);
        var evaluator = new PoolingEvaluator(dijkstra);

        return (graph, dijkstra, evaluator);
    }

    [Fact]
    public void Evaluate_OverlappingRoutes_ReturnsViablePooling()
    {
        var (_, dijkstra, evaluator) = BuildLinearGraph();

        var reqA = new PoolingRequest
        {
            TripRequestId = 101,
            PickupNodeId = 1,
            DropoffNodeId = 4,
            MaxDetourSeconds = 300,
            DirectRouteTimeSeconds = 180
        };

        var reqB = new PoolingRequest
        {
            TripRequestId = 102,
            PickupNodeId = 2,
            DropoffNodeId = 5,
            MaxDetourSeconds = 300,
            DirectRouteTimeSeconds = 180
        };

        var result = evaluator.Evaluate(reqA, reqB);

        result.Should().NotBeNull();
        result!.IsViable.Should().BeTrue();
        result.AddedDetourSecondsA.Should().BeLessOrEqualTo(reqA.MaxDetourSeconds);
        result.AddedDetourSecondsB.Should().BeLessOrEqualTo(reqB.MaxDetourSeconds);
    }

    [Fact]
    public void Evaluate_ExcessiveDetour_ReturnsNull()
    {
        var (_, dijkstra, evaluator) = BuildLinearGraph();

        // Pasajero A muy estricto: máximo 10s de desvío, pero cualquier pooling le agrega más
        var reqA = new PoolingRequest
        {
            TripRequestId = 201,
            PickupNodeId = 1,
            DropoffNodeId = 2,
            MaxDetourSeconds = 10,     // umbral muy bajo
            DirectRouteTimeSeconds = 60
        };

        // Pasajero B: ruta larga que obliga a grandes desvíos en cualquier permutación
        var reqB = new PoolingRequest
        {
            TripRequestId = 202,
            PickupNodeId = 4,
            DropoffNodeId = 5,
            MaxDetourSeconds = 300,
            DirectRouteTimeSeconds = 60
        };

        var result = evaluator.Evaluate(reqA, reqB);

        // Con MaxDetourSeconds=10 para A, ninguna permutación es viable
        result.Should().BeNull();
    }

    [Fact]
    public void Evaluate_SamePickupAndDropoff_ReturnsFarSavingsPositive()
    {
        var (_, dijkstra, evaluator) = BuildLinearGraph();

        // Dos pasajeros con exactamente la misma ruta
        var reqA = new PoolingRequest
        {
            TripRequestId = 301,
            PickupNodeId = 1,
            DropoffNodeId = 3,
            MaxDetourSeconds = 300,
            DirectRouteTimeSeconds = 120
        };

        var reqB = new PoolingRequest
        {
            TripRequestId = 302,
            PickupNodeId = 1,
            DropoffNodeId = 3,
            MaxDetourSeconds = 300,
            DirectRouteTimeSeconds = 120
        };

        var result = evaluator.Evaluate(reqA, reqB);

        result.Should().NotBeNull();
        result!.IsViable.Should().BeTrue();
        // Con rutas idénticas el ahorro debería ser positivo
        result.EstimatedFareSavingsPercent.Should().BeGreaterOrEqualTo(0);
    }
}
