using Autigres.Core.Entities;
using Autigres.Core.Enums;
using Autigres.Core.Interfaces.Repositories;
using Autigres.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Autigres.Infrastructure.Repositories;

public class TripRepository : ITripRepository
{
    private readonly AutigresDbContext _db;

    public TripRepository(AutigresDbContext db) => _db = db;

    // ── Full-graph query used by both passenger and driver screens ────────────────

    private IQueryable<Trip> FullTripQuery() =>
        _db.Trips
            .Include(t => t.Driver!).ThenInclude(d => d.User)
            .Include(t => t.Vehicle)
            .Include(t => t.RouteWaypoints)
            .Include(t => t.TripPassengers)
                .ThenInclude(tp => tp.Passenger!).ThenInclude(p => p.User);

    public Task<Trip?> GetByIdAsync(int id)
        => FullTripQuery().FirstOrDefaultAsync(t => t.Id == id);

    public Task<Trip?> GetByUuidAsync(Guid uuid)
        => FullTripQuery().FirstOrDefaultAsync(t => t.Uuid == uuid);

    /// <inheritdoc/>
    public Task<Trip?> GetScheduledUnassignedAsync()
        => _db.Trips
            .Include(t => t.TripPassengers)
                .ThenInclude(tp => tp.Passenger!).ThenInclude(p => p.User)
            .Where(t => t.Status == TripStatus.Scheduled
                     && t.DriverId == null
                     && t.CreatedAt >= DateTime.UtcNow.AddMinutes(-15))
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync();

    /// <inheritdoc/>
    public async Task<IEnumerable<Trip>> GetAllScheduledUnassignedAsync()
        => await _db.Trips
            .Include(t => t.TripPassengers)
                .ThenInclude(tp => tp.Passenger!).ThenInclude(p => p.User)
            .Where(t => t.Status == TripStatus.Scheduled
                     && t.DriverId == null
                     && t.CreatedAt >= DateTime.UtcNow.AddMinutes(-15))
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

    /// <inheritdoc/>
    public async Task CancelStaleTripsForPassengerAsync(int passengerId)
    {
        var staleTripIds = await _db.TripPassengers
            .Where(tp => tp.PassengerId == passengerId)
            .Select(tp => tp.TripId)
            .ToListAsync();

        if (staleTripIds.Count == 0) return;

        await _db.Trips
            .Where(t => staleTripIds.Contains(t.Id)
                     && t.Status == TripStatus.Scheduled
                     && t.DriverId == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TripStatus.Cancelled)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<IEnumerable<Trip>> GetActiveByDriverIdAsync(int driverId)
        => await FullTripQuery()
            .Where(t => t.DriverId == driverId &&
                (t.Status == TripStatus.DriverAssigned || t.Status == TripStatus.InProgress))
            .ToListAsync();

    public async Task<Trip> CreateAsync(Trip trip)
    {
        trip.CreatedAt = DateTime.UtcNow;
        trip.UpdatedAt = DateTime.UtcNow;
        _db.Trips.Add(trip);
        await _db.SaveChangesAsync();
        return trip;
    }

    public async Task<Trip> UpdateAsync(Trip trip)
    {
        trip.UpdatedAt = DateTime.UtcNow;
        _db.Trips.Update(trip);
        await _db.SaveChangesAsync();
        return trip;
    }

    public async Task UpdateStatusAsync(int tripId, TripStatus status)
    {
        await _db.Trips.Where(t => t.Id == tripId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, status)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
    }

    /// <inheritdoc/>
    public async Task ArriveAsync(int tripId)
    {
        await _db.Trips.Where(t => t.Id == tripId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.ArrivedAt, DateTime.UtcNow)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
    }

    /// <inheritdoc/>
    public async Task AssignDriverAsync(int tripId, int driverId, int vehicleId)
    {
        await _db.Trips.Where(t => t.Id == tripId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.DriverId, driverId)
                .SetProperty(t => t.VehicleId, vehicleId)
                .SetProperty(t => t.Status, TripStatus.DriverAssigned)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
    }

    // ── Requests ─────────────────────────────────────────────────────────────────

    public Task<TripRequest?> GetRequestByIdAsync(int id)
        => _db.TripRequests.FirstOrDefaultAsync(r => r.Id == id);

    public Task<TripRequest?> GetRequestByUuidAsync(Guid uuid)
        => _db.TripRequests
               .Include(r => r.TripPassenger)
               .FirstOrDefaultAsync(r => r.Uuid == uuid);

    public async Task<IEnumerable<TripRequest>> GetPendingRequestsAsync()
        => await _db.TripRequests
                    .Where(r => r.Status == TripRequestStatus.Pending
                             && r.ExpiresAt > DateTime.UtcNow)
                    .ToListAsync();

    public async Task<TripRequest> CreateRequestAsync(TripRequest request)
    {
        request.CreatedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        _db.TripRequests.Add(request);
        await _db.SaveChangesAsync();
        return request;
    }

    public async Task UpdateRequestStatusAsync(int requestId, TripRequestStatus status)
    {
        await _db.TripRequests.Where(r => r.Id == requestId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status, status)
                .SetProperty(r => r.UpdatedAt, DateTime.UtcNow));
    }

    public async Task MatchRequestAsync(int requestId, decimal estimatedFare)
    {
        await _db.TripRequests.Where(r => r.Id == requestId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Status,        TripRequestStatus.Matched)
                .SetProperty(r => r.EstimatedFare, estimatedFare)
                .SetProperty(r => r.UpdatedAt,     DateTime.UtcNow));
    }

    // ── TripPassengers ────────────────────────────────────────────────────────────

    public async Task<TripPassenger> AddPassengerToTripAsync(TripPassenger tripPassenger)
    {
        _db.TripPassengers.Add(tripPassenger);
        await _db.SaveChangesAsync();
        return tripPassenger;
    }

    public async Task UpdateTripPassengerStatusAsync(int tripPassengerId, TripPassengerStatus status)
    {
        var tp = await _db.TripPassengers.FindAsync(tripPassengerId);
        if (tp is null) return;
        tp.Status = status;
        await _db.SaveChangesAsync();
    }

    public Task<TripPassenger?> GetTripPassengerByRequestIdAsync(int requestId)
        => _db.TripPassengers.FirstOrDefaultAsync(tp => tp.RequestId == requestId);

    public async Task UpdateTripPassengerTripIdAsync(
        int tripPassengerId, int newTripId, decimal fareAmount, byte pickupOrder, byte dropoffOrder)
    {
        await _db.TripPassengers.Where(tp => tp.Id == tripPassengerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(tp => tp.TripId,      newTripId)
                .SetProperty(tp => tp.FareAmount,  fareAmount)
                .SetProperty(tp => tp.PickupOrder,  pickupOrder)
                .SetProperty(tp => tp.DropoffOrder, dropoffOrder));
    }

    // ── Share requests ────────────────────────────────────────────────────────────

    public async Task<IEnumerable<TripRequest>> GetActivePoolingRequestsAsync()
        => await _db.TripRequests
            .Include(r => r.Passenger).ThenInclude(p => p.User)
            .Where(r => r.IsPoolingAllowed
                     && r.Status == TripRequestStatus.Matched
                     && r.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();

    public async Task<ShareRequest> CreateShareRequestAsync(ShareRequest sr)
    {
        _db.ShareRequests.Add(sr);
        await _db.SaveChangesAsync();
        return sr;
    }

    public Task<ShareRequest?> GetShareRequestByUuidAsync(Guid uuid)
        => _db.ShareRequests
            .Include(s => s.RequesterRequest).ThenInclude(r => r.Passenger).ThenInclude(p => p.User)
            .Include(s => s.TargetRequest).ThenInclude(r => r.Passenger).ThenInclude(p => p.User)
            .Include(s => s.CombinedTrip)
            .FirstOrDefaultAsync(s => s.Uuid == uuid);

    public Task<ShareRequest?> GetPendingIncomingShareRequestAsync(int targetRequestId)
        => _db.ShareRequests
            .Include(s => s.RequesterRequest).ThenInclude(r => r.Passenger).ThenInclude(p => p.User)
            .Where(s => s.TargetRequestId == targetRequestId
                     && s.Status == ShareRequestStatus.Pending
                     && s.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

    public async Task UpdateShareRequestStatusAsync(
        int shareRequestId, ShareRequestStatus status, int? combinedTripId = null)
    {
        var sr = await _db.ShareRequests.FindAsync(shareRequestId);
        if (sr is null) return;
        sr.Status = status;
        if (combinedTripId.HasValue) sr.CombinedTripId = combinedTripId;
        await _db.SaveChangesAsync();
    }
}
