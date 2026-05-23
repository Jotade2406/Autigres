using System.Security.Claims;
using Autigres.API.DTOs;
using Autigres.Core.Entities;
using Autigres.Core.Enums;
using Autigres.Core.Exceptions;
using Autigres.Core.Interfaces.Repositories;
using Autigres.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Autigres.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TripsController : ControllerBase
{
    private readonly ITripRepository _tripRepo;
    private readonly IPassengerRepository _passengerRepo;
    private readonly IUserRepository _userRepo;
    private readonly IMatchingService _matchingService;
    private readonly IConfiguration _config;
    private readonly ILogger<TripsController> _logger;

    public TripsController(
        ITripRepository tripRepo,
        IPassengerRepository passengerRepo,
        IUserRepository userRepo,
        IMatchingService matchingService,
        IConfiguration config,
        ILogger<TripsController> logger)
    {
        _tripRepo = tripRepo;
        _passengerRepo = passengerRepo;
        _userRepo = userRepo;
        _matchingService = matchingService;
        _config = config;
        _logger = logger;
    }

    /// <summary>POST /api/trips/requests — passenger creates a ride request</summary>
    [HttpPost("requests")]
    public async Task<ActionResult<TripRequestStatusResponse>> CreateRequest(
        [FromBody] CreateTripRequestBody body)
    {
        var passenger = await GetCurrentPassengerAsync();

        // Cancel any stale solo trips left behind so the driver queue isn't clogged.
        await _tripRepo.CancelStaleTripsForPassengerAsync(passenger.Id);

        var expirationMinutes = int.Parse(
            _config["PoolingSettings:RequestExpirationMinutes"] ?? "5");

        var request = new TripRequest
        {
            PassengerId = passenger.Id,
            OriginLat = body.OriginLat,
            OriginLng = body.OriginLng,
            OriginAddress = body.OriginAddress ?? $"{body.OriginLat:F6},{body.OriginLng:F6}",
            DestinationLat = body.DestinationLat,
            DestinationLng = body.DestinationLng,
            DestinationAddress = body.DestinationAddress ?? $"{body.DestinationLat:F6},{body.DestinationLng:F6}",
            MaxDetourSeconds = body.MaxDetourSeconds,
            IsPoolingAllowed = body.IsPoolingAllowed,
            PaymentMethod = body.PaymentMethod ?? "cash",
            ServiceTier = body.ServiceTier ?? "economico",
            ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        request = await _tripRepo.CreateRequestAsync(request);

        // Trigger pooling scan — graph is in RAM so this is fast.
        _logger.LogInformation("Triggering pooling scan for requestId={Id}", request.Id);
        try
        {
            await _matchingService.FindAndMatchAsync(request.Id);
            // Reload to pick up status=matched if a pool was found.
            request = await _tripRepo.GetRequestByIdAsync(request.Id) ?? request;
        }
        catch (Exception ex)
        {
            // Logged as Warning so it's visible at the default log level.
            _logger.LogWarning(ex, "Pooling scan threw an exception for requestId={Id}. " +
                "Check migration V008 has been run (driver_id/vehicle_id must allow NULL in trips table).",
                request.Id);
        }

        // No pool match (or pooling disabled) — create a solo Scheduled trip immediately
        // so the driver can see and accept it, and the passenger's MatchingScreen stops polling.
        if (request.Status == TripRequestStatus.Pending)
        {
            var soloFare = body.EstimatedFare ?? FallbackFare(body.OriginLat, body.OriginLng, body.DestinationLat, body.DestinationLng);
            var soloTrip = await _tripRepo.CreateAsync(new Trip
            {
                Status             = TripStatus.Scheduled,
                OriginLat          = request.OriginLat,
                OriginLng          = request.OriginLng,
                OriginAddress      = request.OriginAddress,
                DestinationLat     = request.DestinationLat,
                DestinationLng     = request.DestinationLng,
                DestinationAddress = request.DestinationAddress,
                BaseFare           = soloFare,
                IsPoolingAllowed   = request.IsPoolingAllowed,
                PaymentMethod      = request.PaymentMethod,
                ServiceTier        = body.ServiceTier ?? "economico",
            });
            await _tripRepo.AddPassengerToTripAsync(new TripPassenger
            {
                TripId         = soloTrip.Id,
                PassengerId    = passenger.Id,
                RequestId      = request.Id,
                PickupLat      = request.OriginLat,
                PickupLng      = request.OriginLng,
                PickupAddress  = request.OriginAddress,
                DropoffLat     = request.DestinationLat,
                DropoffLng     = request.DestinationLng,
                DropoffAddress = request.DestinationAddress,
                PickupOrder    = 0,
                DropoffOrder   = 0,
                FareAmount     = soloFare,
                Status         = TripPassengerStatus.Waiting,
            });
            await _tripRepo.MatchRequestAsync(request.Id, soloFare);
            _logger.LogInformation(
                "Solo trip created: tripId={TripId} fare={Fare} for requestId={ReqId}",
                soloTrip.Id, soloFare, request.Id);
            request = await _tripRepo.GetRequestByIdAsync(request.Id) ?? request;
        }

        return CreatedAtAction(nameof(GetRequest), new { uuid = request.Uuid },
            ToRequestStatusResponse(request));
    }

    /// <summary>GET /api/trips/requests/{uuid} — poll request status</summary>
    [HttpGet("requests/{uuid}")]
    public async Task<ActionResult<TripRequestStatusResponse>> GetRequest(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var request = await _tripRepo.GetRequestByUuidAsync(guid)
                      ?? throw new NotFoundException("TripRequest", guid);

        TripResponse? assignedTrip = null;
        if (request.TripPassenger?.TripId is int tripId)
        {
            var trip = await _tripRepo.GetByIdAsync(tripId);
            if (trip is not null)
                assignedTrip = ToTripResponse(trip);
        }

        return Ok(ToRequestStatusResponse(request, assignedTrip));
    }

    /// <summary>DELETE /api/trips/requests/{uuid} — passenger cancels a pending request</summary>
    [HttpDelete("requests/{uuid}")]
    public async Task<IActionResult> CancelRequest(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var request = await _tripRepo.GetRequestByUuidAsync(guid)
                      ?? throw new NotFoundException("TripRequest", guid);

        if (request.Status is not (TripRequestStatus.Pending or TripRequestStatus.Matching or TripRequestStatus.Matched))
            throw new DomainException("Solo se pueden cancelar solicitudes activas.");

        await _tripRepo.UpdateRequestStatusAsync(request.Id, TripRequestStatus.Cancelled);

        // Also cancel the associated solo trip if it hasn't been accepted by a driver yet.
        if (request.TripPassenger?.TripId is int tripId)
        {
            var trip = await _tripRepo.GetByIdAsync(tripId);
            if (trip is { Status: TripStatus.Scheduled, DriverId: null })
                await _tripRepo.UpdateStatusAsync(tripId, TripStatus.Cancelled);
        }

        return NoContent();
    }

    /// <summary>POST /api/trips/{uuid}/cancel — passenger cancels an active trip</summary>
    [HttpPost("{uuid}/cancel")]
    public async Task<IActionResult> CancelTrip(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var passenger = await GetCurrentPassengerAsync();
        var trip      = await _tripRepo.GetByUuidAsync(guid)
                        ?? throw new NotFoundException("Trip", guid);

        var isPassengerOnTrip = trip.TripPassengers.Any(tp => tp.PassengerId == passenger.Id);
        if (!isPassengerOnTrip)
            return Forbid();

        if (trip.Status == TripStatus.InProgress || trip.Status == TripStatus.Completed)
            throw new DomainException("No podés cancelar un viaje que ya inició o finalizó.");

        if (trip.Status == TripStatus.Cancelled)
            return NoContent();

        await _tripRepo.UpdateStatusAsync(trip.Id, TripStatus.Cancelled);
        return NoContent();
    }

    /// <summary>GET /api/trips/{uuid} — get full trip details</summary>
    [HttpGet("{uuid}")]
    public async Task<ActionResult<TripResponse>> GetTrip(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var trip = await _tripRepo.GetByUuidAsync(guid)
                   ?? throw new NotFoundException("Trip", guid);

        return Ok(ToTripResponse(trip));
    }

    /// <summary>GET /api/trips/history — passenger trip history</summary>
    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<TripHistoryItemDto>>> GetHistory()
    {
        var uuid      = GetCurrentUserUuid();
        var user      = await _userRepo.GetByUuidAsync(uuid)
                        ?? throw new NotFoundException("User", uuid);
        var passenger = await _passengerRepo.GetByUserIdWithTripsAsync(user.Id)
                        ?? throw new DomainException("El usuario no es pasajero.");

        var items = passenger.TripPassengers
            .Where(tp => tp.Trip is not null)
            .Select(tp =>
            {
                var others = tp.Trip.TripPassengers
                    .Where(o => o.PassengerId != passenger.Id && o.Passenger?.User is not null)
                    .Select(o => $"{o.Passenger!.User.FirstName} {o.Passenger.User.LastName}")
                    .ToList();
                var sharedWith = others.Count > 0 ? string.Join(", ", others) : null;

                return new TripHistoryItemDto(
                    tp.Trip.Uuid.ToString(),
                    tp.Trip.CreatedAt,
                    tp.Trip.CompletedAt,
                    tp.PickupAddress,
                    tp.DropoffAddress,
                    tp.FareAmount ?? 0m,
                    tp.Trip.TripPassengers.Count > 1,
                    tp.Trip.Status.ToString().ToLower(),
                    sharedWith);
            })
            .OrderByDescending(h => h.CreatedAt)
            .ToList();

        return Ok(items);
    }

    // ── Share requests ────────────────────────────────────────────────────────────

    /// <summary>GET /api/trips/requests/{uuid}/nearby — find a compatible pooling partner</summary>
    [HttpGet("requests/{uuid}/nearby")]
    public async Task<ActionResult<NearbyPassengerDto?>> GetNearbyPartner(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var myRequest = await _tripRepo.GetRequestByUuidAsync(guid)
                        ?? throw new NotFoundException("TripRequest", guid);

        if (!myRequest.IsPoolingAllowed || myRequest.Status != TripRequestStatus.Matched)
            return Ok((NearbyPassengerDto?)null);

        var candidates = await _tripRepo.GetActivePoolingRequestsAsync();

        var best = candidates
            .Where(r => r.Id != myRequest.Id && r.PassengerId != myRequest.PassengerId)
            .Select(r => new
            {
                Request    = r,
                PickupDist = HaversineKm(myRequest.OriginLat, myRequest.OriginLng, r.OriginLat, r.OriginLng),
                DestDist   = HaversineKm(myRequest.DestinationLat, myRequest.DestinationLng, r.DestinationLat, r.DestinationLng),
            })
            .Where(x => x.PickupDist < 1.5 && x.DestDist < 3.0)
            .OrderBy(x => x.PickupDist + x.DestDist)
            .FirstOrDefault();

        if (best is null) return Ok((NearbyPassengerDto?)null);

        var name = $"{best.Request.Passenger.User.FirstName} {best.Request.Passenger.User.LastName}";
        return Ok(new NearbyPassengerDto(
            best.Request.Uuid.ToString(),
            name,
            best.Request.OriginAddress,
            best.Request.DestinationAddress,
            Math.Round(best.PickupDist, 2),
            Math.Round(best.DestDist, 2)));
    }

    /// <summary>POST /api/trips/share-requests — passenger A invites passenger B</summary>
    [HttpPost("share-requests")]
    public async Task<ActionResult<ShareRequestCreatedDto>> CreateShareRequest(
        [FromBody] CreateShareRequestBody body)
    {
        if (!Guid.TryParse(body.MyRequestUuid, out var myGuid))
            return BadRequest(new { message = "UUID inválido." });
        if (!Guid.TryParse(body.TargetRequestUuid, out var targetGuid))
            return BadRequest(new { message = "UUID de destino inválido." });

        var myRequest     = await _tripRepo.GetRequestByUuidAsync(myGuid)
                            ?? throw new NotFoundException("TripRequest", myGuid);
        var targetRequest = await _tripRepo.GetRequestByUuidAsync(targetGuid)
                            ?? throw new NotFoundException("TripRequest", targetGuid);

        var sr = await _tripRepo.CreateShareRequestAsync(new ShareRequest
        {
            RequesterRequestId = myRequest.Id,
            TargetRequestId    = targetRequest.Id,
            CreatedAt          = DateTime.UtcNow,
            ExpiresAt          = DateTime.UtcNow.AddSeconds(60),
        });

        return Ok(new ShareRequestCreatedDto(sr.Uuid.ToString()));
    }

    /// <summary>GET /api/trips/share-requests/incoming?requestUuid={uuid} — poll for an incoming share request</summary>
    [HttpGet("share-requests/incoming")]
    public async Task<ActionResult<IncomingShareRequestDto?>> GetIncomingShareRequest(
        [FromQuery] string requestUuid)
    {
        if (!Guid.TryParse(requestUuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var myRequest = await _tripRepo.GetRequestByUuidAsync(guid)
                        ?? throw new NotFoundException("TripRequest", guid);

        var sr = await _tripRepo.GetPendingIncomingShareRequestAsync(myRequest.Id);
        if (sr is null) return Ok((IncomingShareRequestDto?)null);

        var name = $"{sr.RequesterRequest.Passenger.User.FirstName} {sr.RequesterRequest.Passenger.User.LastName}";
        return Ok(new IncomingShareRequestDto(
            sr.Uuid.ToString(),
            name,
            sr.RequesterRequest.OriginAddress,
            sr.RequesterRequest.DestinationAddress,
            sr.ExpiresAt.ToString("O")));
    }

    /// <summary>GET /api/trips/share-requests/{uuid} — poll share request status</summary>
    [HttpGet("share-requests/{uuid}")]
    public async Task<ActionResult<ShareRequestStatusDto>> GetShareRequest(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var sr = await _tripRepo.GetShareRequestByUuidAsync(guid)
                 ?? throw new NotFoundException("ShareRequest", guid);

        var passenger    = await GetCurrentPassengerAsync();
        var isRequester  = sr.RequesterRequest.PassengerId == passenger.Id;
        var partnerReq   = isRequester ? sr.TargetRequest : sr.RequesterRequest;
        var partnerName  = $"{partnerReq.Passenger.User.FirstName} {partnerReq.Passenger.User.LastName}";

        return Ok(new ShareRequestStatusDto(
            sr.Uuid.ToString(),
            sr.Status.ToString().ToLower(),
            partnerName,
            sr.CombinedTrip?.Uuid.ToString(),
            sr.ExpiresAt.ToString("O")));
    }

    /// <summary>POST /api/trips/share-requests/{uuid}/accept — target passenger accepts</summary>
    [HttpPost("share-requests/{uuid}/accept")]
    public async Task<ActionResult<AcceptShareResponseDto>> AcceptShareRequest(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var sr = await _tripRepo.GetShareRequestByUuidAsync(guid)
                 ?? throw new NotFoundException("ShareRequest", guid);

        if (sr.Status != ShareRequestStatus.Pending)
            throw new DomainException("Esta solicitud ya fue procesada.");
        if (sr.ExpiresAt < DateTime.UtcNow)
            throw new DomainException("La solicitud ha expirado.");

        var requesterTp = await _tripRepo.GetTripPassengerByRequestIdAsync(sr.RequesterRequestId)
                          ?? throw new DomainException("TripPassenger del solicitante no encontrado.");
        var targetTp    = await _tripRepo.GetTripPassengerByRequestIdAsync(sr.TargetRequestId)
                          ?? throw new DomainException("TripPassenger del destinatario no encontrado.");

        int oldRequesterTripId = requesterTp.TripId;
        int oldTargetTripId    = targetTp.TripId;

        static decimal TierMultiplier(string tier) => tier switch
        {
            "confort" => 1.35m,
            "premium" => 1.75m,
            _         => 1.00m,
        };

        var requesterFare = Math.Round((requesterTp.FareAmount ?? 0m) * 0.8m * TierMultiplier(sr.RequesterRequest.ServiceTier), 0);
        var targetFare    = Math.Round((targetTp.FareAmount    ?? 0m) * 0.8m * TierMultiplier(sr.TargetRequest.ServiceTier),    0);

        var combinedTrip = await _tripRepo.CreateAsync(new Trip
        {
            Status             = TripStatus.Scheduled,
            OriginLat          = sr.RequesterRequest.OriginLat,
            OriginLng          = sr.RequesterRequest.OriginLng,
            OriginAddress      = sr.RequesterRequest.OriginAddress,
            DestinationLat     = sr.TargetRequest.DestinationLat,
            DestinationLng     = sr.TargetRequest.DestinationLng,
            DestinationAddress = sr.TargetRequest.DestinationAddress,
            BaseFare           = requesterFare + targetFare,
            IsPoolingAllowed   = true,
            PaymentMethod      = sr.RequesterRequest.PaymentMethod,
            ServiceTier        = sr.RequesterRequest.ServiceTier,
        });

        await _tripRepo.UpdateTripPassengerTripIdAsync(requesterTp.Id, combinedTrip.Id, requesterFare, 0, 1);
        await _tripRepo.UpdateTripPassengerTripIdAsync(targetTp.Id,    combinedTrip.Id, targetFare,    1, 0);

        if (oldRequesterTripId != combinedTrip.Id)
            await _tripRepo.UpdateStatusAsync(oldRequesterTripId, TripStatus.Cancelled);
        if (oldTargetTripId != combinedTrip.Id && oldTargetTripId != oldRequesterTripId)
            await _tripRepo.UpdateStatusAsync(oldTargetTripId, TripStatus.Cancelled);

        await _tripRepo.UpdateShareRequestStatusAsync(sr.Id, ShareRequestStatus.Accepted, combinedTrip.Id);

        return Ok(new AcceptShareResponseDto(combinedTrip.Uuid.ToString()));
    }

    /// <summary>POST /api/trips/share-requests/{uuid}/reject — target passenger rejects</summary>
    [HttpPost("share-requests/{uuid}/reject")]
    public async Task<IActionResult> RejectShareRequest(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var sr = await _tripRepo.GetShareRequestByUuidAsync(guid)
                 ?? throw new NotFoundException("ShareRequest", guid);

        if (sr.Status == ShareRequestStatus.Pending)
            await _tripRepo.UpdateShareRequestStatusAsync(sr.Id, ShareRequestStatus.Rejected);

        return NoContent();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async Task<Passenger> GetCurrentPassengerAsync()
    {
        var uuid = GetCurrentUserUuid();
        var user = await _userRepo.GetByUuidAsync(uuid)
                   ?? throw new NotFoundException("User", uuid);
        var passenger = await _passengerRepo.GetByUserIdAsync(user.Id)
                        ?? throw new DomainException("El usuario no es pasajero.");
        return passenger;
    }

    private Guid GetCurrentUserUuid()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub")
                  ?? throw new UnauthorizedAccessException();
        return Guid.Parse(raw);
    }

    private static TripRequestStatusResponse ToRequestStatusResponse(
        TripRequest req, TripResponse? assignedTrip = null) =>
        new(req.Uuid.ToString(),
            req.Status.ToString().ToLower(),
            req.EstimatedFare,
            req.ExpiresAt,
            assignedTrip);

    private static TripResponse ToTripResponse(Trip trip)
    {
        var driver = trip.Driver is null ? null : new DriverSummaryDto(
            trip.Driver.User?.Uuid.ToString() ?? string.Empty,
            $"{trip.Driver.User?.FirstName} {trip.Driver.User?.LastName}",
            trip.Driver.RatingAverage,
            trip.Driver.User?.ProfilePictureUrl,
            trip.Driver.User?.Phone);

        var vehicle = trip.Vehicle is null ? null : new VehicleSummaryDto(
            trip.Vehicle.PlateNumber,
            trip.Vehicle.Brand,
            trip.Vehicle.Model,
            trip.Vehicle.Year,
            trip.Vehicle.Color);

        var waypoints = trip.RouteWaypoints
            .OrderBy(w => w.SequenceOrder)
            .Select(w => new WaypointDto(w.Lat, w.Lng, w.WaypointType.ToString().ToLower()))
            .ToList();

        var passengers = trip.TripPassengers
            .Select(tp => new TripPassengerSummaryDto(
                tp.Passenger?.User?.Uuid.ToString() ?? string.Empty,
                $"{tp.Passenger?.User?.FirstName} {tp.Passenger?.User?.LastName}",
                tp.PickupAddress,
                tp.DropoffAddress,
                tp.PickupOrder,
                tp.DropoffOrder,
                PassengerStatusStr(tp.Status)))
            .ToList();

        return new TripResponse(
            trip.Uuid.ToString(),
            TripStatusStr(trip.Status),
            trip.TripPassengers.Count > 1,
            trip.IsPoolingAllowed,
            trip.BaseFare ?? 0m,
            0,
            driver,
            vehicle,
            waypoints,
            trip.TripPassengers.Count,
            passengers,
            trip.OriginLat,
            trip.OriginLng,
            trip.DestinationLat,
            trip.DestinationLng,
            trip.PaymentMethod,
            trip.ArrivedAt?.ToString("O"),
            trip.ServiceTier);
    }

    // Mirrors mobile estimateFare: Bs.5 base + Bs.2.50/km + Bs.0.50/min (30 km/h urban avg)
    private static decimal FallbackFare(double oLat, double oLng, double dLat, double dLng)
    {
        var distKm   = HaversineKm(oLat, oLng, dLat, dLng) * 1.3;   // road ≈ 1.3× straight
        var durMin   = distKm / 30.0 * 60.0;                          // ~30 km/h urban
        var fare     = 5m + (decimal)distKm * 2.50m + (decimal)durMin * 0.50m;
        return Math.Max(5m, Math.Round(fare, 0));
    }

    private static double HaversineKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
              * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static string TripStatusStr(TripStatus s) => s switch
    {
        TripStatus.DriverAssigned => "driver_assigned",
        TripStatus.InProgress     => "in_progress",
        _                         => s.ToString().ToLower(),
    };

    private static string PassengerStatusStr(TripPassengerStatus s)
    {
        if (s == TripPassengerStatus.PickedUp)   return "picked_up";
        if (s == TripPassengerStatus.DroppedOff) return "dropped_off";
        if (s == TripPassengerStatus.NoShow)     return "no_show";
        return s.ToString().ToLower();
    }
}
