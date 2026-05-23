using System.Security.Claims;
using Autigres.API.DTOs;
using Autigres.API.Services;
using Autigres.Core.Entities;
using Autigres.Core.Enums;
using Autigres.Core.Exceptions;
using Autigres.Core.Interfaces.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Autigres.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IUserRepository _userRepo;
    private readonly IPassengerRepository _passengerRepo;
    private readonly IDriverRepository _driverRepo;
    private readonly JwtService _jwtService;

    public AuthController(
        IUserRepository userRepo,
        IPassengerRepository passengerRepo,
        IDriverRepository driverRepo,
        JwtService jwtService)
    {
        _userRepo = userRepo;
        _passengerRepo = passengerRepo;
        _driverRepo = driverRepo;
        _jwtService = jwtService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _userRepo.GetByEmailAsync(request.Email);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Credenciales inválidas." });

        return Ok(BuildAuthResponse(user));
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var existing = await _userRepo.GetByEmailAsync(request.Email);
        if (existing is not null)
            return Conflict(new { message = "El correo ya está registrado." });

        if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var role)
            || role == UserRole.Admin)
            return BadRequest(new { message = "Rol inválido. Use 'passenger' o 'driver'." });

        var user = new User
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = role,
            Status = UserStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        user = await _userRepo.CreateAsync(user);

        if (role == UserRole.Passenger)
            await _passengerRepo.CreateAsync(new Passenger { UserId = user.Id });
        else
            await _driverRepo.CreateAsync(new Driver { UserId = user.Id });

        return CreatedAtAction(nameof(Me), BuildAuthResponse(user));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserSummary>> Me()
    {
        var uuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? User.FindFirstValue("sub");
        if (uuidStr is null || !Guid.TryParse(uuidStr, out var uuid))
            return Unauthorized();

        var user = await _userRepo.GetByUuidAsync(uuid)
                   ?? throw new NotFoundException("User", uuid);

        return Ok(ToUserSummary(user));
    }

    private AuthResponse BuildAuthResponse(User user)
    {
        var token = _jwtService.GenerateToken(user);
        var jwtSection = HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()
            .GetSection("JwtSettings");
        var expiresIn = int.Parse(jwtSection["ExpirationHours"] ?? "24") * 3600;

        return new AuthResponse(token, "Bearer", expiresIn, ToUserSummary(user));
    }

    private static UserSummary ToUserSummary(User user) =>
        new(user.Uuid.ToString(),
            user.Email,
            $"{user.FirstName} {user.LastName}",
            user.Role.ToString().ToLower(),
            user.ProfilePictureUrl);
}
