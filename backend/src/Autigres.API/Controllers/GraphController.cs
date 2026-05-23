using Autigres.API.DTOs;
using Autigres.Core.Exceptions;
using Autigres.Core.Graph;
using Autigres.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Autigres.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GraphController : ControllerBase
{
    private readonly IGraphService _graphService;
    private readonly ILogger<GraphController> _logger;

    public GraphController(IGraphService graphService, ILogger<GraphController> logger)
    {
        _graphService = graphService;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/graph/shortest-path
    /// Body: { fromLat, fromLng, toLat, toLng }
    /// </summary>
    [HttpPost("shortest-path")]
    public ActionResult<ShortestPathResponse> ShortestPath([FromBody] ShortestPathRequest request)
    {
        var originNodeId = _graphService.ResolveNearestNode(request.FromLat, request.FromLng);
        var destNodeId   = _graphService.ResolveNearestNode(request.ToLat,   request.ToLng);

        _logger.LogInformation(
            "ShortestPath: ({FromLat},{FromLng})→nodeId={OriginId}  ({ToLat},{ToLng})→nodeId={DestId}",
            request.FromLat, request.FromLng, originNodeId,
            request.ToLat,   request.ToLng,   destNodeId);

        if (originNodeId is null)
            throw new NotFoundException("GraphNode", $"{request.FromLat},{request.FromLng}");
        if (destNodeId is null)
            throw new NotFoundException("GraphNode", $"{request.ToLat},{request.ToLng}");

        var result = _graphService.FindShortestPath(originNodeId.Value, destNodeId.Value);

        _logger.LogInformation(
            "ShortestPath: IsReachable={IsReachable}  TimeSeconds={Time}  DistanceMeters={Dist}",
            result.IsReachable, result.TotalTimeSeconds, result.TotalDistanceMeters);

        if (!result.IsReachable)
            return UnprocessableEntity(new { message = "No existe ruta entre los puntos dados." });

        var distanceKm   = result.TotalDistanceMeters / 1000.0;
        var fareDecimal  = 5.00m
                         + (decimal)distanceKm * 1.80m
                         + (decimal)result.TotalTimeSeconds * 0.08m;

        var polyline = result.NodePath
            .Select(id => _graphService.GetNode(id))
            .Where(n => n is not null)
            .Select(n => new RouteCoordDto(n!.Lat, n!.Lng))
            .ToList();

        return Ok(new ShortestPathResponse(
            result.TotalTimeSeconds,
            result.TotalDistanceMeters,
            Math.Round(fareDecimal, 2),
            polyline));
    }
}
