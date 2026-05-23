using System.Security.Claims;
using Autigres.API.DTOs;
using Autigres.Core.Entities;
using Autigres.Core.Enums;
using Autigres.Core.Exceptions;
using Autigres.Core.Interfaces.Repositories;
using Autigres.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Autigres.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Driver")]
public class DriversController : ControllerBase
{
    private readonly IDriverRepository _driverRepo;
    private readonly IUserRepository _userRepo;
    private readonly ITripRepository _tripRepo;
    private readonly AutigresDbContext _db;
    private readonly ILogger<DriversController> _logger;

    public DriversController(
        IDriverRepository driverRepo,
        IUserRepository userRepo,
        ITripRepository tripRepo,
        AutigresDbContext db,
        ILogger<DriversController> logger)
    {
        _driverRepo = driverRepo;
        _userRepo = userRepo;
        _tripRepo = tripRepo;
        _db = db;
        _logger = logger;
    }

    /// <summary>PUT /api/drivers/availability — go online or offline</summary>
    [HttpPut("availability")]
    public async Task<IActionResult> SetAvailability([FromBody] SetAvailabilityRequest request)
    {
        var driver = await GetCurrentDriverAsync();
        await _driverRepo.UpdateAvailabilityAsync(driver.Id, request.IsOnline, request.IsOnline);
        return NoContent();
    }

    /// <summary>PUT /api/drivers/location — update GPS position</summary>
    [HttpPut("location")]
    public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationRequest request)
    {
        var driver = await GetCurrentDriverAsync();
        await _driverRepo.UpdateLocationAsync(driver.Id, request.Lat, request.Lng);
        return NoContent();
    }

    /// <summary>
    /// GET /api/drivers/pending-trip — first Scheduled trip awaiting driver acceptance.
    /// Returns null (200 OK with JSON null) when no trip is pending.
    /// </summary>
    [HttpGet("pending-trip")]
    public async Task<ActionResult<TripResponse?>> GetPendingTrip()
    {
        var trip = await _tripRepo.GetScheduledUnassignedAsync();
        if (trip is null)
        {
            _logger.LogDebug("[PendingTrip] No Scheduled unassigned trip found in the last 15 min");
            return Ok((TripResponse?)null);
        }
        _logger.LogInformation(
            "[PendingTrip] Found trip: id={Id} uuid={Uuid} fare={Fare} createdAt={CreatedAt:HH:mm:ss}",
            trip.Id, trip.Uuid, trip.BaseFare, trip.CreatedAt);
        return Ok(ToTripResponse(trip));
    }

    /// <summary>
    /// GET /api/drivers/pending-trips — all Scheduled trips awaiting driver acceptance.
    /// </summary>
    [HttpGet("pending-trips")]
    public async Task<ActionResult<IEnumerable<TripResponse>>> GetPendingTrips()
    {
        var trips = await _tripRepo.GetAllScheduledUnassignedAsync();
        return Ok(trips.Select(ToTripResponse));
    }

    /// <summary>POST /api/drivers/trips/{tripUuid}/accept</summary>
    [HttpPost("trips/{tripUuid}/accept")]
    public async Task<IActionResult> AcceptTrip(string tripUuid)
    {
        _logger.LogInformation("AcceptTrip called — tripUuid={TripUuid}", tripUuid);

        if (!Guid.TryParse(tripUuid, out var guid))
        {
            _logger.LogWarning("AcceptTrip — UUID inválido: {TripUuid}", tripUuid);
            return BadRequest(new { message = "UUID inválido." });
        }

        var trip = await _tripRepo.GetByUuidAsync(guid);
        if (trip is null)
        {
            _logger.LogWarning("AcceptTrip — trip not found: {TripUuid}", tripUuid);
            throw new NotFoundException("Trip", guid);
        }
        _logger.LogInformation("AcceptTrip — trip found: status={Status}, driverId={DriverId}",
            trip.Status, trip.DriverId?.ToString() ?? "null");

        if (trip.Status != TripStatus.Scheduled)
            throw new DomainException($"El viaje ya no está disponible para aceptar (estado actual: {trip.Status}).");

        var driver = await GetCurrentDriverAsync();
        _logger.LogInformation("AcceptTrip — driver found: driverId={DriverId}, vehicles={VehicleCount}",
            driver.Id, driver.Vehicles.Count);

        var vehicle = driver.Vehicles.FirstOrDefault(v => v.IsActive);
        if (vehicle is null)
        {
            _logger.LogWarning("AcceptTrip — driver {DriverId} has no active vehicle", driver.Id);
            throw new DomainException("El conductor no tiene vehículo activo registrado. Registrá un vehículo antes de aceptar viajes.");
        }
        _logger.LogInformation("AcceptTrip — assigning vehicle {VehicleId} ({Plate}) to trip {TripId}",
            vehicle.Id, vehicle.PlateNumber, trip.Id);

        await _tripRepo.AssignDriverAsync(trip.Id, driver.Id, vehicle.Id);
        _logger.LogInformation("AcceptTrip — success: trip {TripId} assigned to driver {DriverId}", trip.Id, driver.Id);
        return NoContent();
    }

    /// <summary>GET /api/drivers/vehicle — get current driver's active vehicle (null if none)</summary>
    [HttpGet("vehicle")]
    public async Task<ActionResult<VehicleResponse?>> GetVehicle()
    {
        var driver  = await GetCurrentDriverAsync();
        var vehicle = driver.Vehicles.FirstOrDefault(v => v.IsActive);
        if (vehicle is null) return Ok((VehicleResponse?)null);
        return Ok(ToVehicleResponse(vehicle));
    }

    /// <summary>PUT /api/drivers/vehicle/{id} — update an existing vehicle</summary>
    [HttpPut("vehicle/{id:int}")]
    public async Task<ActionResult<VehicleResponse>> UpdateVehicle(int id, [FromBody] UpdateVehicleRequest request)
    {
        var driver  = await GetCurrentDriverAsync();
        var vehicle = driver.Vehicles.FirstOrDefault(v => v.Id == id)
                      ?? throw new NotFoundException("Vehicle", id);

        vehicle.PlateNumber = request.PlateNumber.Trim().ToUpperInvariant();
        vehicle.Brand       = request.Brand.Trim();
        vehicle.Model       = request.Model.Trim();
        vehicle.Year        = request.Year;
        vehicle.Color       = request.Color.Trim();
        vehicle.Capacity    = request.Capacity;

        await _db.SaveChangesAsync();
        _logger.LogInformation("Vehicle {VehicleId} updated by driverId={DriverId}", id, driver.Id);
        return Ok(ToVehicleResponse(vehicle));
    }

    /// <summary>DELETE /api/drivers/vehicle/{id} — soft-delete (deactivate) a vehicle</summary>
    [HttpDelete("vehicle/{id:int}")]
    public async Task<IActionResult> DeleteVehicle(int id)
    {
        var driver  = await GetCurrentDriverAsync();
        var vehicle = driver.Vehicles.FirstOrDefault(v => v.Id == id)
                      ?? throw new NotFoundException("Vehicle", id);

        vehicle.IsActive = false;
        await _db.SaveChangesAsync();
        _logger.LogInformation("Vehicle {VehicleId} deactivated by driverId={DriverId}", id, driver.Id);
        return NoContent();
    }

    /// <summary>POST /api/drivers/vehicle — register a vehicle for the current driver</summary>
    [HttpPost("vehicle")]
    public async Task<IActionResult> RegisterVehicle([FromBody] RegisterVehicleRequest request)
    {
        var driver = await GetCurrentDriverAsync();
        _logger.LogInformation("RegisterVehicle — driverId={DriverId}, plate={Plate}", driver.Id, request.PlateNumber);

        var vehicle = new Vehicle
        {
            PlateNumber = request.PlateNumber.Trim().ToUpperInvariant(),
            Brand       = request.Brand.Trim(),
            Model       = request.Model.Trim(),
            Year        = request.Year,
            Color       = request.Color.Trim(),
            Capacity    = request.Capacity,
            IsActive    = true,
        };

        await _driverRepo.AddVehicleAsync(driver.Id, vehicle);
        _logger.LogInformation("RegisterVehicle — created vehicleId={VehicleId} for driverId={DriverId}", vehicle.Id, driver.Id);
        return Created($"/api/drivers/vehicle/{vehicle.Id}", new { vehicleId = vehicle.Id });
    }

    /// <summary>POST /api/drivers/trips/{tripUuid}/passengers/{passengerUuid}/pickup</summary>
    [HttpPost("trips/{tripUuid}/passengers/{passengerUuid}/pickup")]
    public async Task<IActionResult> PickupPassenger(string tripUuid, string passengerUuid)
    {
        var (_, tp) = await GetTripPassengerAsync(tripUuid, passengerUuid);
        await _tripRepo.UpdateTripPassengerStatusAsync(tp.Id, TripPassengerStatus.PickedUp);
        return NoContent();
    }

    /// <summary>POST /api/drivers/trips/{tripUuid}/start — all passengers aboard, begin driving</summary>
    [HttpPost("trips/{tripUuid}/start")]
    public async Task<IActionResult> StartTrip(string tripUuid)
    {
        if (!Guid.TryParse(tripUuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var trip = await _tripRepo.GetByUuidAsync(guid)
                   ?? throw new NotFoundException("Trip", guid);

        if (trip.Status != TripStatus.DriverAssigned)
            throw new DomainException("El viaje debe estar en estado driver_assigned para iniciar.");

        await _tripRepo.UpdateStatusAsync(trip.Id, TripStatus.InProgress);
        return NoContent();
    }

    /// <summary>POST /api/drivers/trips/{tripUuid}/passengers/{passengerUuid}/dropoff</summary>
    [HttpPost("trips/{tripUuid}/passengers/{passengerUuid}/dropoff")]
    public async Task<IActionResult> DropoffPassenger(string tripUuid, string passengerUuid)
    {
        var (_, tp) = await GetTripPassengerAsync(tripUuid, passengerUuid);
        await _tripRepo.UpdateTripPassengerStatusAsync(tp.Id, TripPassengerStatus.DroppedOff);
        return NoContent();
    }

    /// <summary>POST /api/drivers/trips/{tripUuid}/arrive — driver reached passenger stop</summary>
    [HttpPost("trips/{tripUuid}/arrive")]
    public async Task<IActionResult> ArriveAtPassenger(string tripUuid)
    {
        if (!Guid.TryParse(tripUuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var trip = await _tripRepo.GetByUuidAsync(guid)
                   ?? throw new NotFoundException("Trip", guid);

        if (trip.Status != TripStatus.DriverAssigned)
            throw new DomainException("El viaje debe estar en estado driver_assigned.");

        await _tripRepo.ArriveAsync(trip.Id);
        return NoContent();
    }

    /// <summary>POST /api/drivers/trips/{tripUuid}/complete</summary>
    [HttpPost("trips/{tripUuid}/complete")]
    public async Task<IActionResult> CompleteTrip(string tripUuid)
    {
        if (!Guid.TryParse(tripUuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var trip = await _tripRepo.GetByUuidAsync(guid)
                   ?? throw new NotFoundException("Trip", guid);

        if (trip.Status != TripStatus.InProgress)
            throw new DomainException("El viaje no está en progreso.");

        await _tripRepo.UpdateStatusAsync(trip.Id, TripStatus.Completed);

        // Increment TotalTrips for driver and all passengers
        if (trip.DriverId.HasValue)
        {
            var driver = await _db.Drivers.FindAsync(trip.DriverId.Value);
            if (driver is not null)
                driver.TotalTrips++;
        }

        foreach (var tp in trip.TripPassengers)
        {
            if (tp.Passenger is not null)
                tp.Passenger.TotalTrips++;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>GET /api/drivers/trips/history — driver's trip history</summary>
    [HttpGet("trips/history")]
    public async Task<ActionResult<IEnumerable<DriverTripHistoryItem>>> GetTripHistory()
    {
        var driver = await GetCurrentDriverAsync();

        var trips = await _db.Trips
            .Where(t => t.DriverId == driver.Id)
            .Include(t => t.TripPassengers)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        var items = trips.Select(t => new DriverTripHistoryItem(
            t.Uuid.ToString(),
            t.CreatedAt,
            t.CompletedAt,
            t.OriginAddress,
            t.DestinationAddress,
            t.BaseFare ?? 0m,
            t.TripPassengers.Count > 1,
            t.TripPassengers.Count,
            t.Status.ToString().ToLower()
        )).ToList();

        return Ok(items);
    }

    private static VehicleResponse ToVehicleResponse(Vehicle v) =>
        new(v.Id, v.PlateNumber, v.Brand, v.Model, v.Year, v.Color, v.Capacity, v.IsActive);

    // ── DTO mapping (mirrors TripsController.ToTripResponse) ─────────────────────

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
            trip.ArrivedAt?.ToString("O"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async Task<Driver> GetCurrentDriverAsync()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub")
                  ?? throw new UnauthorizedAccessException();
        var uuid = Guid.Parse(raw);
        var user = await _userRepo.GetByUuidAsync(uuid)
                   ?? throw new NotFoundException("User", uuid);
        var driver = await _driverRepo.GetByUserIdAsync(user.Id)
                     ?? throw new DomainException("El usuario no es conductor.");
        return driver;
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

    private async Task<(Trip trip, TripPassenger tp)> GetTripPassengerAsync(
        string tripUuid, string passengerUuid)
    {
        if (!Guid.TryParse(tripUuid, out var tGuid))
            throw new DomainException("UUID de viaje inválido.");

        var trip = await _tripRepo.GetByUuidAsync(tGuid)
                   ?? throw new NotFoundException("Trip", tGuid);

        if (!Guid.TryParse(passengerUuid, out var pGuid))
            throw new DomainException("UUID de pasajero inválido.");

        var tp = trip.TripPassengers
            .FirstOrDefault(x => x.Passenger?.User?.Uuid == pGuid)
            ?? throw new NotFoundException("TripPassenger", pGuid);

        return (trip, tp);
    }
}
