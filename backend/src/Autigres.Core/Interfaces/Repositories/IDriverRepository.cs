using Autigres.Core.Entities;

namespace Autigres.Core.Interfaces.Repositories;

public interface IDriverRepository
{
    Task<Driver?> GetByIdAsync(int id);
    Task<Driver?> GetByUserIdAsync(int userId);
    Task<IEnumerable<Driver>> GetOnlineAvailableDriversAsync();
    Task<Driver> CreateAsync(Driver driver);
    Task<Vehicle> AddVehicleAsync(int driverId, Vehicle vehicle);
    Task UpdateLocationAsync(int driverId, double lat, double lng);
    Task UpdateAvailabilityAsync(int driverId, bool isAvailable, bool isOnline);
    Task UpdateRatingAsync(int driverId, decimal newAverage, int totalTrips);
}
