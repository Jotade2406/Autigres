using Autigres.Core.Entities;
using Autigres.Core.Interfaces.Repositories;
using Autigres.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Autigres.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AutigresDbContext _db;

    public UserRepository(AutigresDbContext db) => _db = db;

    public Task<User?> GetByIdAsync(int id)
        => _db.Users.FirstOrDefaultAsync(u => u.Id == id);

    public Task<User?> GetByEmailAsync(string email)
        => _db.Users.FirstOrDefaultAsync(u => u.Email == email);

    public Task<User?> GetByPhoneAsync(string phone)
        => _db.Users.FirstOrDefaultAsync(u => u.Phone == phone);

    public Task<User?> GetByUuidAsync(Guid uuid)
        => _db.Users.FirstOrDefaultAsync(u => u.Uuid == uuid);

    public async Task<User> CreateAsync(User user)
    {
        user.CreatedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    public async Task<User> UpdateAsync(User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        _db.Users.Update(user);
        await _db.SaveChangesAsync();
        return user;
    }
}
