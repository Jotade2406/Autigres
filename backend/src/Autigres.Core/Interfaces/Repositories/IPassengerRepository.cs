using Autigres.Core.Entities;

namespace Autigres.Core.Interfaces.Repositories;

public interface IPassengerRepository
{
    Task<Passenger?> GetByIdAsync(int id);
    Task<Passenger?> GetByUserIdAsync(int userId);
    Task<Passenger?> GetByUserIdWithTripsAsync(int userId);
    Task<Passenger> CreateAsync(Passenger passenger);
    Task UpdateRatingAsync(int passengerId, decimal newAverage, int totalTrips);
}
