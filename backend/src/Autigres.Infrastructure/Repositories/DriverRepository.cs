using Autigres.Core.Entities;
using Autigres.Core.Interfaces.Repositories;
using Autigres.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Autigres.Infrastructure.Repositories;

public class DriverRepository : IDriverRepository
{
    private readonly AutigresDbContext _db;

    public DriverRepository(AutigresDbContext db) => _db = db;

    public Task<Driver?> GetByIdAsync(int id)
        => _db.Drivers.Include(d => d.User).Include(d => d.Vehicles)
            .FirstOrDefaultAsync(d => d.Id == id);

    public Task<Driver?> GetByUserIdAsync(int userId)
        => _db.Drivers.Include(d => d.User).Include(d => d.Vehicles)
            .FirstOrDefaultAsync(d => d.UserId == userId);

    public Task<IEnumerable<Driver>> GetOnlineAvailableDriversAsync()
        => Task.FromResult<IEnumerable<Driver>>(
            _db.Drivers.Where(d => d.IsOnline && d.IsAvailable).ToList());

    public async Task<Driver> CreateAsync(Driver driver)
    {
        _db.Drivers.Add(driver);
        await _db.SaveChangesAsync();
        return driver;
    }

    public async Task<Vehicle> AddVehicleAsync(int driverId, Vehicle vehicle)
    {
        vehicle.DriverId = driverId;
        _db.Set<Vehicle>().Add(vehicle);
        await _db.SaveChangesAsync();
        return vehicle;
    }

    public async Task UpdateLocationAsync(int driverId, double lat, double lng)
    {
        await _db.Drivers
            .Where(d => d.Id == driverId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(d => d.CurrentLat, lat)
                .SetProperty(d => d.CurrentLng, lng)
                .SetProperty(d => d.LastLocationUpdate, DateTime.UtcNow));
    }

    public async Task UpdateAvailabilityAsync(int driverId, bool isAvailable, bool isOnline)
    {
        await _db.Drivers
            .Where(d => d.Id == driverId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(d => d.IsAvailable, isAvailable)
                .SetProperty(d => d.IsOnline, isOnline));
    }

    public async Task UpdateRatingAsync(int driverId, decimal newAverage, int totalTrips)
    {
        await _db.Drivers
            .Where(d => d.Id == driverId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(d => d.RatingAverage, newAverage)
                .SetProperty(d => d.TotalTrips, totalTrips));
    }
}
