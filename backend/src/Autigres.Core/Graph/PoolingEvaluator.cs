namespace Autigres.Core.Graph;

/// <summary>
/// Evalúa si dos solicitudes de viaje pueden compartir un vehículo (ride-pooling).
/// Prueba las 4 permutaciones de pickup/dropoff y acepta la mejor que respete
/// el umbral de desvío de cada pasajero.
/// </summary>
public class PoolingEvaluator
{
    private readonly DijkstraAlgorithm _dijkstra;

    public PoolingEvaluator(DijkstraAlgorithm dijkstra)
    {
        _dijkstra = dijkstra;
    }

    /// <summary>
    /// Evalúa las 4 permutaciones y retorna el mejor resultado viable,
    /// o <c>null</c> si ninguna cumple los umbrales de desvío.
    /// </summary>
    public PoolingResult? Evaluate(PoolingRequest requestA, PoolingRequest requestB)
    {
        var permutations = new[]
        {
            new[] { requestA.PickupNodeId, requestB.PickupNodeId, requestA.DropoffNodeId, requestB.DropoffNodeId },
            new[] { requestA.PickupNodeId, requestB.PickupNodeId, requestB.DropoffNodeId, requestA.DropoffNodeId },
            new[] { requestB.PickupNodeId, requestA.PickupNodeId, requestA.DropoffNodeId, requestB.DropoffNodeId },
            new[] { requestB.PickupNodeId, requestA.PickupNodeId, requestB.DropoffNodeId, requestA.DropoffNodeId }
        };

        PoolingResult? best = null;

        foreach (var perm in permutations)
        {
            var result = EvaluatePermutation(perm, requestA, requestB);
            if (result is null) continue;

            if (best is null || result.TotalRouteTimeSeconds < best.TotalRouteTimeSeconds)
                best = result;
        }

        return best;
    }

    private PoolingResult? EvaluatePermutation(
        int[] waypoints, PoolingRequest reqA, PoolingRequest reqB)
    {
        // Pre-compute all 3 inter-waypoint segments once — no duplicate Dijkstra calls.
        var segs = new ShortestPathResult[3];
        for (var i = 0; i < 3; i++)
        {
            segs[i] = _dijkstra.FindShortestPath(waypoints[i], waypoints[i + 1]);
            if (!segs[i].IsReachable) return null;
        }

        var totalTime = segs[0].TotalTimeSeconds + segs[1].TotalTimeSeconds + segs[2].TotalTimeSeconds;
        var totalDist = segs[0].TotalDistanceMeters + segs[1].TotalDistanceMeters + segs[2].TotalDistanceMeters;

        // Passenger in-vehicle time = sum of segments between their pickup and dropoff indices.
        var timeForA = PassengerTime(segs, waypoints, reqA.PickupNodeId, reqA.DropoffNodeId);
        var timeForB = PassengerTime(segs, waypoints, reqB.PickupNodeId, reqB.DropoffNodeId);

        if (timeForA is null || timeForB is null) return null;

        var detourA = timeForA.Value - reqA.DirectRouteTimeSeconds;
        var detourB = timeForB.Value - reqB.DirectRouteTimeSeconds;

        if (detourA > reqA.MaxDetourSeconds || detourB > reqB.MaxDetourSeconds)
            return null;

        var pickupFirst  = waypoints[0] == reqA.PickupNodeId ? reqA.TripRequestId : reqB.TripRequestId;
        var pickupSecond = waypoints[1] == reqA.PickupNodeId ? reqA.TripRequestId : reqB.TripRequestId;
        var dropFirst    = waypoints[2] == reqA.DropoffNodeId ? reqA.TripRequestId : reqB.TripRequestId;
        var dropSecond   = waypoints[3] == reqA.DropoffNodeId ? reqA.TripRequestId : reqB.TripRequestId;

        var directTotal    = reqA.DirectRouteTimeSeconds + reqB.DirectRouteTimeSeconds;
        var savingsPct     = directTotal > 0
            ? Math.Max(0, (directTotal - totalTime) / directTotal * 100)
            : 0;

        return new PoolingResult
        {
            IsViable                  = true,
            PickupSequence            = [pickupFirst, pickupSecond],
            DropoffSequence           = [dropFirst, dropSecond],
            TotalRouteTimeSeconds     = totalTime,
            TotalRouteDistanceMeters  = totalDist,
            AddedDetourSecondsA       = Math.Max(0, detourA),
            AddedDetourSecondsB       = Math.Max(0, detourB),
            EstimatedFareSavingsPercent = savingsPct
        };
    }

    /// <summary>
    /// Suma los tiempos de los segmentos entre el pickup y el dropoff de un pasajero,
    /// usando los resultados de Dijkstra ya calculados para esta permutación.
    /// </summary>
    private static double? PassengerTime(
        ShortestPathResult[] segs, int[] waypoints, int pickupNodeId, int dropoffNodeId)
    {
        var from = Array.IndexOf(waypoints, pickupNodeId);
        var to   = Array.IndexOf(waypoints, dropoffNodeId);

        if (from < 0 || to < 0 || from >= to) return null;

        double time = 0;
        for (var i = from; i < to; i++)
            time += segs[i].TotalTimeSeconds;
        return time;
    }
}

/// <summary>Datos de entrada para evaluar una solicitud en el pooling.</summary>
public class PoolingRequest
{
    public int TripRequestId { get; set; }
    public int PickupNodeId { get; set; }
    public int DropoffNodeId { get; set; }
    public int MaxDetourSeconds { get; set; }
    public double DirectRouteTimeSeconds { get; set; }
}

/// <summary>Resultado de la evaluación de pooling entre dos solicitudes.</summary>
public class PoolingResult
{
    public bool IsViable { get; set; }

    /// <summary>IDs de TripRequest en orden de recogida.</summary>
    public int[] PickupSequence { get; set; } = [];

    /// <summary>IDs de TripRequest en orden de bajada.</summary>
    public int[] DropoffSequence { get; set; } = [];

    public double TotalRouteTimeSeconds     { get; set; }
    public double TotalRouteDistanceMeters  { get; set; }
    public double AddedDetourSecondsA       { get; set; }
    public double AddedDetourSecondsB       { get; set; }
    public double EstimatedFareSavingsPercent { get; set; }
}
