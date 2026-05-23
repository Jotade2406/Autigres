using System.Security.Claims;
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
public class PaymentsController : ControllerBase
{
    private readonly IUserRepository _userRepo;
    private readonly AutigresDbContext _db;

    public PaymentsController(IUserRepository userRepo, AutigresDbContext db)
    {
        _userRepo = userRepo;
        _db = db;
    }

    /// <summary>GET /api/payments — list payments for the current user</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetMyPayments()
    {
        var uuid = GetCurrentUserUuid();
        var user = await _userRepo.GetByUuidAsync(uuid)
                   ?? throw new NotFoundException("User", uuid);

        var payments = await _db.Payments
            .Include(p => p.TripPassenger)
                .ThenInclude(tp => tp.Trip)
            .Where(p => p.TripPassenger.Passenger.UserId == user.Id)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                uuid = p.Uuid.ToString(),
                tripUuid = p.TripPassenger.Trip.Uuid.ToString(),
                amount = p.Amount,
                currency = p.Currency,
                method = p.Method.ToString().ToLower(),
                status = p.Status.ToString().ToLower(),
                processedAt = p.ProcessedAt,
                createdAt = p.CreatedAt
            })
            .ToListAsync();

        return Ok(payments);
    }

    /// <summary>GET /api/payments/{uuid} — get payment details</summary>
    [HttpGet("{uuid}")]
    public async Task<ActionResult<object>> GetPayment(string uuid)
    {
        if (!Guid.TryParse(uuid, out var guid))
            return BadRequest(new { message = "UUID inválido." });

        var payment = await _db.Payments
            .Include(p => p.TripPassenger)
                .ThenInclude(tp => tp.Trip)
            .FirstOrDefaultAsync(p => p.Uuid == guid)
            ?? throw new NotFoundException("Payment", guid);

        return Ok(new
        {
            uuid = payment.Uuid.ToString(),
            tripUuid = payment.TripPassenger.Trip.Uuid.ToString(),
            amount = payment.Amount,
            currency = payment.Currency,
            method = payment.Method.ToString().ToLower(),
            status = payment.Status.ToString().ToLower(),
            transactionId = payment.TransactionId,
            processedAt = payment.ProcessedAt,
            createdAt = payment.CreatedAt
        });
    }

    private Guid GetCurrentUserUuid()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub")
                  ?? throw new UnauthorizedAccessException();
        return Guid.Parse(raw);
    }
}
