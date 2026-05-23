using System.Security.Claims;
using Autigres.API.DTOs;
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
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserRepository _userRepo;
    private readonly IPassengerRepository _passengerRepo;
    private readonly IDriverRepository _driverRepo;
    private readonly AutigresDbContext _db;

    public UsersController(
        IUserRepository userRepo,
        IPassengerRepository passengerRepo,
        IDriverRepository driverRepo,
        AutigresDbContext db)
    {
        _userRepo = userRepo;
        _passengerRepo = passengerRepo;
        _driverRepo = driverRepo;
        _db = db;
    }

    [HttpGet("profile")]
    public async Task<ActionResult<UserProfileResponse>> GetProfile()
    {
        var raw  = User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? User.FindFirstValue("sub")
                   ?? throw new UnauthorizedAccessException();
        var uuid = Guid.Parse(raw);
        var user = await _userRepo.GetByUuidAsync(uuid)
                   ?? throw new NotFoundException("User", uuid);

        decimal ratingAverage = 5.00m;
        int totalTrips = 0;

        if (user.Role == UserRole.Passenger)
        {
            var passenger = await _passengerRepo.GetByUserIdAsync(user.Id);
            if (passenger is not null)
            {
                ratingAverage = passenger.RatingAverage;
                totalTrips = await _db.TripPassengers
                    .CountAsync(tp => tp.PassengerId == passenger.Id
                                   && tp.Trip.Status != TripStatus.Cancelled
                                   && tp.Trip.Status != TripStatus.Scheduled);
            }
        }
        else if (user.Role == UserRole.Driver)
        {
            var driver = await _driverRepo.GetByUserIdAsync(user.Id);
            if (driver is not null)
            {
                ratingAverage = driver.RatingAverage;
                totalTrips = await _db.Trips
                    .CountAsync(t => t.DriverId == driver.Id
                                  && t.Status != TripStatus.Cancelled
                                  && t.Status != TripStatus.Scheduled);
            }
        }

        return Ok(new UserProfileResponse(
            user.Uuid.ToString(),
            $"{user.FirstName} {user.LastName}",
            user.Email,
            user.Phone,
            user.Role.ToString().ToLower(),
            user.ProfilePictureUrl,
            ratingAverage,
            totalTrips));
    }
}
