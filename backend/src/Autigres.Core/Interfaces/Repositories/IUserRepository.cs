using Autigres.Core.Entities;

namespace Autigres.Core.Interfaces.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(int id);
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByUuidAsync(Guid uuid);
    Task<User> CreateAsync(User user);
    Task<User> UpdateAsync(User user);
}
