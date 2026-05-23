using System.Security.Claims;
using Autigres.API.DTOs;
using Autigres.Core.Entities;
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
public class RatingsController : ControllerBase
{
    private readonly IUserRepository _userRepo;
    private readonly ITripRepository _tripRepo;
    private readonly AutigresDbContext _db;

    public RatingsController(
        IUserRepository userRepo,
        ITripRepository tripRepo,
        AutigresDbContext db)
    {
        _userRepo = userRepo;
        _tripRepo = tripRepo;
        _db = db;
    }

    /// <summary>POST /api/ratings — rate a driver or passenger after a trip</summary>
    [HttpPost]
    public async Task<IActionResult> CreateRating([FromBody] CreateRatingRequest request)
    {
        var raterUuid = GetCurrentUserUuid();
        var rater = await _userRepo.GetByUuidAsync(raterUuid)
                    ?? throw new NotFoundException("User", raterUuid);

        if (!Guid.TryParse(request.TripUuid, out var tripGuid))
            return BadRequest(new { message = "UUID de viaje inválido." });

        var trip = await _tripRepo.GetByUuidAsync(tripGuid)
                   ?? throw new NotFoundException("Trip", tripGuid);

        if (!Guid.TryParse(request.RatedUserUuid, out var ratedGuid))
            return BadRequest(new { message = "UUID de usuario calificado inválido." });

        var ratedUser = await _userRepo.GetByUuidAsync(ratedGuid)
                        ?? throw new NotFoundException("User", ratedGuid);

        if (request.Score < 1 || request.Score > 5)
            return BadRequest(new { message = "La puntuación debe estar entre 1 y 5." });

        var rating = new Rating
        {
            TripId = trip.Id,
            RaterUserId = rater.Id,
            RatedUserId = ratedUser.Id,
            Score = request.Score,
            Comment = request.Comment,
            CreatedAt = DateTime.UtcNow
        };

        _db.Ratings.Add(rating);
        await _db.SaveChangesAsync();

        // Recalculate rating_average for the rated user across all their received ratings
        var avg = (decimal)await _db.Ratings
            .Where(r => r.RatedUserId == ratedUser.Id)
            .AverageAsync(r => (double)r.Score);
        var rounded = Math.Round(avg, 2);

        await _db.Drivers
            .Where(d => d.UserId == ratedUser.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.RatingAverage, rounded));

        await _db.Passengers
            .Where(p => p.UserId == ratedUser.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.RatingAverage, rounded));

        return Created(string.Empty, new { message = "Calificación registrada." });
    }

    private Guid GetCurrentUserUuid()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub")
                  ?? throw new UnauthorizedAccessException();
        return Guid.Parse(raw);
    }
}
