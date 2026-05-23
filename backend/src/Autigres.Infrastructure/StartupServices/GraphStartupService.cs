using Autigres.Core.Graph;
using Autigres.Core.Interfaces.Repositories;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Autigres.Infrastructure.StartupServices;

/// <summary>
/// IHostedService que carga el grafo vial en memoria al arranque de la app.
/// Se ejecuta una sola vez antes de que la API empiece a servir requests.
/// </summary>
public class GraphStartupService : IHostedService
{
    private readonly IServiceProvider _services;
    private readonly CityGraph _cityGraph;
    private readonly ILogger<GraphStartupService> _logger;

    public GraphStartupService(
        IServiceProvider services,
        CityGraph cityGraph,
        ILogger<GraphStartupService> logger)
    {
        _services = services;
        _cityGraph = cityGraph;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Loading city graph from database...");

        using var scope = _services.CreateScope();
        var graphRepo = scope.ServiceProvider.GetRequiredService<IGraphRepository>();

        var nodes = await graphRepo.GetAllNodesAsync();
        var edges = await graphRepo.GetAllEdgesAsync();

        _cityGraph.LoadGraph(nodes, edges);

        _logger.LogInformation(
            "Graph loaded: {NodeCount} nodes, {EdgeCount} edges",
            _cityGraph.NodeCount,
            _cityGraph.EdgeCount);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
