using Autigres.Core.Entities;

namespace Autigres.Core.Interfaces.Repositories;

public interface IGraphRepository
{
    Task<IEnumerable<GraphNode>> GetAllNodesAsync();
    Task<IEnumerable<GraphEdge>> GetAllEdgesAsync();
    Task BulkInsertNodesAsync(IEnumerable<GraphNode> nodes);
}
