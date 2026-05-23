using Autigres.Core.Entities;
using Autigres.Core.Graph;

namespace Autigres.Core.Interfaces.Services;

public interface IMatchingService
{
    /// <summary>
    /// Evalúa si dos solicitudes específicas son compatibles para pooling.
    /// </summary>
    Task<PoolingResult?> TryMatchRequestsAsync(int requestIdA, int requestIdB);

    /// <summary>
    /// Busca entre todas las solicitudes pendientes una que sea compatible con
    /// <paramref name="newRequestId"/>. Si la encuentra, crea el Trip (status=Scheduled)
    /// y marca ambas solicitudes como Matched. Devuelve el Trip creado o null.
    /// </summary>
    Task<Trip?> FindAndMatchAsync(int newRequestId);
}
