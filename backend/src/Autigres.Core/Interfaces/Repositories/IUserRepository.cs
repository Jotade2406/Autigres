using Autigres.Core.Entities;

namespace Autigres.Core.Interfaces.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(int id);
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByPhoneAsync(string phone);
    Task<User?> GetByUuidAsync(Guid uuid);
    Task<User> CreateAsync(User user);
    Task<User> UpdateAsync(User user);
}
