using Autigres.Core.Entities;
using Autigres.Core.Interfaces.Repositories;
using Autigres.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Autigres.Infrastructure.Repositories;

public class PassengerRepository : IPassengerRepository
{
    private readonly AutigresDbContext _db;

    public PassengerRepository(AutigresDbContext db) => _db = db;

    public Task<Passenger?> GetByIdAsync(int id)
        => _db.Passengers.Include(p => p.User).FirstOrDefaultAsync(p => p.Id == id);

    public Task<Passenger?> GetByUserIdAsync(int userId)
        => _db.Passengers.Include(p => p.User).FirstOrDefaultAsync(p => p.UserId == userId);

    public Task<Passenger?> GetByUserIdWithTripsAsync(int userId)
        => _db.Passengers
            .Include(p => p.User)
            .Include(p => p.TripPassengers)
                .ThenInclude(tp => tp.Trip)
                    .ThenInclude(t => t.TripPassengers)
                        .ThenInclude(tp2 => tp2.Passenger)
                            .ThenInclude(p2 => p2.User)
            .FirstOrDefaultAsync(p => p.UserId == userId);

    public async Task<Passenger> CreateAsync(Passenger passenger)
    {
        _db.Passengers.Add(passenger);
        await _db.SaveChangesAsync();
        return passenger;
    }

    public async Task UpdateRatingAsync(int passengerId, decimal newAverage, int totalTrips)
    {
        await _db.Passengers
            .Where(p => p.Id == passengerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.RatingAverage, newAverage)
                .SetProperty(p => p.TotalTrips, totalTrips));
    }
}
