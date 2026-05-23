using Autigres.Core.Entities;
using Autigres.Core.Enums;

namespace Autigres.Core.Interfaces.Repositories;

public interface ITripRepository
{
    Task<Trip?> GetByIdAsync(int id);
    Task<Trip?> GetByUuidAsync(Guid uuid);

    /// <summary>Returns the newest Scheduled trip with no driver assigned, created within the last 15 minutes.</summary>
    Task<Trip?> GetScheduledUnassignedAsync();

    /// <summary>Returns ALL Scheduled trips with no driver assigned, created within the last 15 minutes.</summary>
    Task<IEnumerable<Trip>> GetAllScheduledUnassignedAsync();

    /// <summary>Cancels all Scheduled, driver-unassigned trips for the given passenger so a fresh request surfaces immediately.</summary>
    Task CancelStaleTripsForPassengerAsync(int passengerId);

    Task<IEnumerable<Trip>> GetActiveByDriverIdAsync(int driverId);
    Task<Trip> CreateAsync(Trip trip);
    Task<Trip> UpdateAsync(Trip trip);
    Task UpdateStatusAsync(int tripId, TripStatus status);

    /// <summary>Sets driver_id, vehicle_id and advances status to DriverAssigned atomically.</summary>
    Task AssignDriverAsync(int tripId, int driverId, int vehicleId);

    /// <summary>Records the moment the driver arrives at a passenger stop.</summary>
    Task ArriveAsync(int tripId);

    Task<TripRequest?> GetRequestByIdAsync(int id);
    Task<TripRequest?> GetRequestByUuidAsync(Guid uuid);
    Task<IEnumerable<TripRequest>> GetPendingRequestsAsync();
    Task<TripRequest> CreateRequestAsync(TripRequest request);
    Task UpdateRequestStatusAsync(int requestId, TripRequestStatus status);

    /// <summary>Marks the request as Matched and saves the estimated fare.</summary>
    Task MatchRequestAsync(int requestId, decimal estimatedFare);

    Task<TripPassenger> AddPassengerToTripAsync(TripPassenger tripPassenger);
    Task UpdateTripPassengerStatusAsync(int tripPassengerId, TripPassengerStatus status);
    Task<TripPassenger?> GetTripPassengerByRequestIdAsync(int requestId);
    Task UpdateTripPassengerTripIdAsync(int tripPassengerId, int newTripId, decimal fareAmount, byte pickupOrder, byte dropoffOrder);

    // ── Share requests ────────────────────────────────────────────────────────────
    Task<IEnumerable<TripRequest>> GetActivePoolingRequestsAsync();
    Task<ShareRequest> CreateShareRequestAsync(ShareRequest sr);
    Task<ShareRequest?> GetShareRequestByUuidAsync(Guid uuid);
    Task<ShareRequest?> GetPendingIncomingShareRequestAsync(int targetRequestId);
    Task UpdateShareRequestStatusAsync(int shareRequestId, ShareRequestStatus status, int? combinedTripId = null);
}
