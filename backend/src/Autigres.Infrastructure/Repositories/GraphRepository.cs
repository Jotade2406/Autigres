using Autigres.Core.Entities;
using Autigres.Core.Interfaces.Repositories;
using Dapper;
using MySqlConnector;

namespace Autigres.Infrastructure.Repositories;

/// <summary>
/// Usa Dapper (no EF Core) para velocidad máxima al cargar el grafo completo al boot.
/// </summary>
public class GraphRepository : IGraphRepository
{
    private readonly string _connectionString;

    public GraphRepository(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task<IEnumerable<GraphNode>> GetAllNodesAsync()
    {
        using var conn = new MySqlConnection(_connectionString);
        return await conn.QueryAsync<GraphNode>(
            "SELECT id AS Id, node_key AS NodeKey, lat AS Lat, lng AS Lng, " +
            "city AS City, address_reference AS AddressReference FROM graph_nodes");
    }

    public async Task<IEnumerable<GraphEdge>> GetAllEdgesAsync()
    {
        using var conn = new MySqlConnection(_connectionString);
        return await conn.QueryAsync<GraphEdge>(
            "SELECT id AS Id, from_node_id AS FromNodeId, to_node_id AS ToNodeId, " +
            "distance_meters AS DistanceMeters, time_seconds_avg AS TimeSecondsAvg, " +
            "road_name AS RoadName, is_bidirectional AS IsBidirectional FROM graph_edges");
    }

    public async Task BulkInsertNodesAsync(IEnumerable<GraphNode> nodes)
    {
        using var conn = new MySqlConnection(_connectionString);
        await conn.OpenAsync();
        using var tx = await conn.BeginTransactionAsync();

        const string sql =
            "INSERT IGNORE INTO graph_nodes (node_key, lat, lng, city, address_reference) " +
            "VALUES (@NodeKey, @Lat, @Lng, @City, @AddressReference)";

        await conn.ExecuteAsync(sql, nodes, transaction: tx);
        await tx.CommitAsync();
    }
}
