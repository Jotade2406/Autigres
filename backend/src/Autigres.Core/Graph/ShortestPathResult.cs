namespace Autigres.Core.Graph;

/// <summary>Resultado de un cálculo de ruta mínima con Dijkstra.</summary>
public class ShortestPathResult
{
    public bool IsReachable { get; init; }
    public double TotalTimeSeconds { get; init; }
    public double TotalDistanceMeters { get; init; }

    /// <summary>Lista de node IDs en orden desde origen hasta destino.</summary>
    public List<int> NodePath { get; init; } = new();

    /// <summary>Lista de edge IDs recorridos en orden.</summary>
    public List<int> EdgePath { get; init; } = new();

    public static ShortestPathResult Unreachable => new() { IsReachable = false };
}

public enum PathWeight { Time, Distance }
