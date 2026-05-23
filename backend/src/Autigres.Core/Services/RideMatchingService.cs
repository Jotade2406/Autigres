using Autigres.Core.Entities;
using Autigres.Core.Enums;
using Autigres.Core.Exceptions;
using Autigres.Core.Graph;
using Autigres.Core.Interfaces.Repositories;
using Autigres.Core.Interfaces.Services;
using Microsoft.Extensions.Logging;

namespace Autigres.Core.Services;

public class RideMatchingService : IMatchingService
{
    private readonly ITripRepository _tripRepository;
    private readonly IGraphService _graphService;
    private readonly PoolingEvaluator _poolingEvaluator;
    private readonly FareCalculatorService _fareCalculator;
    private readonly ILogger<RideMatchingService> _logger;

    public RideMatchingService(
        ITripRepository tripRepository,
        IGraphService graphService,
        PoolingEvaluator poolingEvaluator,
        FareCalculatorService fareCalculator,
        ILogger<RideMatchingService> logger)
    {
        _tripRepository   = tripRepository;
        _graphService     = graphService;
        _poolingEvaluator = poolingEvaluator;
        _fareCalculator   = fareCalculator;
        _logger           = logger;
    }

    // ── Public API ────────────────────────────────────────────────────────────────

    public async Task<PoolingResult?> TryMatchRequestsAsync(int requestIdA, int requestIdB)
    {
        var reqA = await _tripRepository.GetRequestByIdAsync(requestIdA)
            ?? throw new NotFoundException(nameof(requestIdA), requestIdA);
        var reqB = await _tripRepository.GetRequestByIdAsync(requestIdB)
            ?? throw new NotFoundException(nameof(requestIdB), requestIdB);

        return EvaluatePair(reqA, reqB);
    }

    /// <inheritdoc/>
    public async Task<Trip?> FindAndMatchAsync(int newRequestId)
    {
        _logger.LogInformation("[Pooling] FindAndMatchAsync START — newRequestId={Id}", newRequestId);

        var newReq = await _tripRepository.GetRequestByIdAsync(newRequestId);
        if (newReq is null)
        {
            _logger.LogWarning("[Pooling] Request {Id} not found in DB — aborting", newRequestId);
            return null;
        }

        // ── 1. Fetch pending candidates ──────────────────────────────────────────
        var allPending = (await _tripRepository.GetPendingRequestsAsync()).ToList();

        _logger.LogInformation(
            "[Pooling] Pending requests in DB: {Count} — IDs: [{Ids}]",
            allPending.Count,
            string.Join(", ", allPending.Select(r => r.Id)));

        // Only pool with requests that explicitly opted in — both passengers must consent.
        var candidates = allPending
            .Where(c => c.Id != newRequestId && c.IsPoolingAllowed && newReq.IsPoolingAllowed)
            .ToList();

        _logger.LogInformation(
            "[Pooling] Candidates to evaluate (excluding self): {Count} — IDs: [{Ids}]",
            candidates.Count,
            string.Join(", ", candidates.Select(r => r.Id)));

        if (candidates.Count == 0)
        {
            _logger.LogInformation("[Pooling] No candidates — returning null");
            return null;
        }

        // ── 2. Evaluate each candidate ───────────────────────────────────────────
        foreach (var candidate in candidates)
        {
            _logger.LogInformation(
                "[Pooling] Evaluating pair: requestId={NewId} vs candidateId={CandId}",
                newRequestId, candidate.Id);

            var pooling = EvaluatePairWithLogs(newReq, candidate);

            if (pooling is null)
            {
                _logger.LogInformation(
                    "[Pooling] Pair ({A},{B}) — NOT viable (null result from Evaluate)",
                    newRequestId, candidate.Id);
                continue;
            }

            _logger.LogInformation(
                "[Pooling] Pair ({A},{B}) — VIABLE: totalTime={T:F0}s totalDist={D:F0}m " +
                "detourA={DA:F0}s detourB={DB:F0}s savings={S:F1}%",
                newRequestId, candidate.Id,
                pooling.TotalRouteTimeSeconds, pooling.TotalRouteDistanceMeters,
                pooling.AddedDetourSecondsA,   pooling.AddedDetourSecondsB,
                pooling.EstimatedFareSavingsPercent);

            // ── 3. Create pooled trip ────────────────────────────────────────────
            _logger.LogInformation(
                "[Pooling] Calling CreatePooledTripAsync for requestIds ({A},{B})",
                newReq.Id, candidate.Id);

            var trip = await CreatePooledTripAsync(newReq, candidate, pooling);

            _logger.LogInformation(
                "[Pooling] Trip created: tripId={TripId} tripUuid={Uuid} status={Status}",
                trip.Id, trip.Uuid, trip.Status);

            return trip;
        }

        _logger.LogInformation("[Pooling] No viable match found for requestId={Id}", newRequestId);
        return null;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────────

    /// <summary>Same as EvaluatePair but emits Information-level logs at each failure point.</summary>
    private PoolingResult? EvaluatePairWithLogs(TripRequest reqA, TripRequest reqB)
    {
        var pickA = _graphService.ResolveNearestNode(reqA.OriginLat, reqA.OriginLng);
        var dropA = _graphService.ResolveNearestNode(reqA.DestinationLat, reqA.DestinationLng);
        var pickB = _graphService.ResolveNearestNode(reqB.OriginLat, reqB.OriginLng);
        var dropB = _graphService.ResolveNearestNode(reqB.DestinationLat, reqB.DestinationLng);

        _logger.LogInformation(
            "[Pooling] Node resolution — " +
            "reqA({Aid}): pickupNode={PA} dropoffNode={DA} " +
            "reqB({Bid}): pickupNode={PB} dropoffNode={DB}",
            reqA.Id, pickA, dropA,
            reqB.Id, pickB, dropB);

        if (pickA is null || dropA is null || pickB is null || dropB is null)
        {
            _logger.LogWarning(
                "[Pooling] ResolveNearestNode returned null — graph may not be loaded yet. " +
                "pickA={PA} dropA={DA} pickB={PB} dropB={DB}",
                pickA, dropA, pickB, dropB);
            return null;
        }

        var directA = _graphService.FindShortestPath(pickA.Value, dropA.Value);
        var directB = _graphService.FindShortestPath(pickB.Value, dropB.Value);

        _logger.LogInformation(
            "[Pooling] Direct routes — " +
            "reqA: reachable={RA} time={TA:F0}s dist={DA:F0}m | " +
            "reqB: reachable={RB} time={TB:F0}s dist={DB:F0}m",
            directA.IsReachable, directA.TotalTimeSeconds, directA.TotalDistanceMeters,
            directB.IsReachable, directB.TotalTimeSeconds, directB.TotalDistanceMeters);

        if (!directA.IsReachable || !directB.IsReachable)
        {
            _logger.LogWarning(
                "[Pooling] Direct route unreachable — reqA.reachable={RA} reqB.reachable={RB}",
                directA.IsReachable, directB.IsReachable);
            return null;
        }

        var poolReqA = new PoolingRequest
        {
            TripRequestId          = reqA.Id,
            PickupNodeId           = pickA.Value,
            DropoffNodeId          = dropA.Value,
            MaxDetourSeconds       = reqA.MaxDetourSeconds,
            DirectRouteTimeSeconds = directA.TotalTimeSeconds
        };
        var poolReqB = new PoolingRequest
        {
            TripRequestId          = reqB.Id,
            PickupNodeId           = pickB.Value,
            DropoffNodeId          = dropB.Value,
            MaxDetourSeconds       = reqB.MaxDetourSeconds,
            DirectRouteTimeSeconds = directB.TotalTimeSeconds
        };

        _logger.LogInformation(
            "[Pooling] Calling PoolingEvaluator.Evaluate — " +
            "reqA(maxDetour={MA}s direct={DA:F0}s) reqB(maxDetour={MB}s direct={DB:F0}s)",
            poolReqA.MaxDetourSeconds, poolReqA.DirectRouteTimeSeconds,
            poolReqB.MaxDetourSeconds, poolReqB.DirectRouteTimeSeconds);

        var result = _poolingEvaluator.Evaluate(poolReqA, poolReqB);

        _logger.LogInformation(
            "[Pooling] PoolingEvaluator.Evaluate returned: {Result}",
            result is null ? "null" : $"viable={result.IsViable}");

        return result;
    }

    private PoolingResult? EvaluatePair(TripRequest reqA, TripRequest reqB)
    {
        var pickA = _graphService.ResolveNearestNode(reqA.OriginLat, reqA.OriginLng);
        var dropA = _graphService.ResolveNearestNode(reqA.DestinationLat, reqA.DestinationLng);
        var pickB = _graphService.ResolveNearestNode(reqB.OriginLat, reqB.OriginLng);
        var dropB = _graphService.ResolveNearestNode(reqB.DestinationLat, reqB.DestinationLng);

        if (pickA is null || dropA is null || pickB is null || dropB is null) return null;

        var directA = _graphService.FindShortestPath(pickA.Value, dropA.Value);
        var directB = _graphService.FindShortestPath(pickB.Value, dropB.Value);

        if (!directA.IsReachable || !directB.IsReachable) return null;

        var poolReqA = new PoolingRequest
        {
            TripRequestId          = reqA.Id,
            PickupNodeId           = pickA.Value,
            DropoffNodeId          = dropA.Value,
            MaxDetourSeconds       = reqA.MaxDetourSeconds,
            DirectRouteTimeSeconds = directA.TotalTimeSeconds
        };
        var poolReqB = new PoolingRequest
        {
            TripRequestId          = reqB.Id,
            PickupNodeId           = pickB.Value,
            DropoffNodeId          = dropB.Value,
            MaxDetourSeconds       = reqB.MaxDetourSeconds,
            DirectRouteTimeSeconds = directB.TotalTimeSeconds
        };

        return _poolingEvaluator.Evaluate(poolReqA, poolReqB);
    }

    private static decimal TierMultiplier(string tier) => tier switch
    {
        "confort"  => 1.35m,
        "premium"  => 1.75m,
        _          => 1.00m,
    };

    private async Task<Trip> CreatePooledTripAsync(
        TripRequest reqA, TripRequest reqB, PoolingResult pooling)
    {
        var firstPickupReqId = pooling.PickupSequence[0];
        var lastDropoffReqId = pooling.DropoffSequence[1];

        var originReq      = firstPickupReqId == reqA.Id ? reqA : reqB;
        var destinationReq = lastDropoffReqId  == reqA.Id ? reqA : reqB;

        var baseFarePerPassenger = _fareCalculator.CalculatePoolingFare(
            pooling.TotalRouteDistanceMeters,
            pooling.TotalRouteTimeSeconds,
            passengerCount: 2);

        var fareA = Math.Round(baseFarePerPassenger * TierMultiplier(reqA.ServiceTier), 0);
        var fareB = Math.Round(baseFarePerPassenger * TierMultiplier(reqB.ServiceTier), 0);

        var trip = await _tripRepository.CreateAsync(new Trip
        {
            Status             = TripStatus.Scheduled,
            OriginLat          = originReq.OriginLat,
            OriginLng          = originReq.OriginLng,
            OriginAddress      = originReq.OriginAddress,
            DestinationLat     = destinationReq.DestinationLat,
            DestinationLng     = destinationReq.DestinationLng,
            DestinationAddress = destinationReq.DestinationAddress,
            TotalDistanceKm    = (decimal)(pooling.TotalRouteDistanceMeters / 1000.0),
            BaseFare           = fareA + fareB,
            IsPoolingAllowed   = true,
            ServiceTier        = originReq.ServiceTier,
            PaymentMethod      = originReq.PaymentMethod,
        });

        await AddTripPassengerAsync(trip, reqA, pooling, fareA, (int)pooling.AddedDetourSecondsA);
        await AddTripPassengerAsync(trip, reqB, pooling, fareB, (int)pooling.AddedDetourSecondsB);

        await _tripRepository.MatchRequestAsync(reqA.Id, fareA);
        await _tripRepository.MatchRequestAsync(reqB.Id, fareB);

        return trip;
    }

    private async Task AddTripPassengerAsync(
        Trip trip, TripRequest req, PoolingResult pooling,
        decimal fare, int addedDetourSeconds)
    {
        var pickupOrder  = (byte)Array.IndexOf(pooling.PickupSequence,  req.Id);
        var dropoffOrder = (byte)Array.IndexOf(pooling.DropoffSequence, req.Id);

        await _tripRepository.AddPassengerToTripAsync(new TripPassenger
        {
            TripId             = trip.Id,
            PassengerId        = req.PassengerId,
            RequestId          = req.Id,
            PickupLat          = req.OriginLat,
            PickupLng          = req.OriginLng,
            PickupAddress      = req.OriginAddress,
            DropoffLat         = req.DestinationLat,
            DropoffLng         = req.DestinationLng,
            DropoffAddress     = req.DestinationAddress,
            PickupOrder        = pickupOrder,
            DropoffOrder       = dropoffOrder,
            FareAmount         = fare,
            AddedDetourSeconds = addedDetourSeconds,
            Status             = TripPassengerStatus.Waiting
        });
    }
}
