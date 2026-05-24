using Autigres.Core.Exceptions;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Autigres.API.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, message) = exception switch
        {
            NotFoundException nfe    => (StatusCodes.Status404NotFound,   nfe.Message),
            DomainException de       => (StatusCodes.Status400BadRequest,  de.Message),
            DbUpdateException dbe when dbe.InnerException?.Message.Contains("Duplicate entry") == true
                                     => (StatusCodes.Status409Conflict,    "Ya existe un registro con esos datos."),
            _                        => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.")
        };

        if (statusCode >= StatusCodes.Status500InternalServerError)
            _logger.LogError(exception, "Unhandled exception: {Message}", exception.Message);
        else
            _logger.LogWarning("Request failed [{StatusCode}]: {Message} — TraceId={TraceId}",
                statusCode, message, context.TraceIdentifier);

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var body = JsonSerializer.Serialize(new
        {
            status = statusCode,
            error = message,
            traceId = context.TraceIdentifier
        });

        await context.Response.WriteAsync(body);
    }
}
