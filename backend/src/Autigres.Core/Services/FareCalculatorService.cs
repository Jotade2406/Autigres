namespace Autigres.Core.Services;

/// <summary>
/// Calcula tarifas para viajes individuales y compartidos.
/// Tarifa base: BOB 5.00 + BOB 1.80/km + BOB 0.08/seg.
/// Pooling: descuento del 20% por km al dividir la ruta.
/// </summary>
public class FareCalculatorService
{
    private const decimal BaseFare = 5.00m;
    private const decimal RatePerKm = 1.80m;
    private const decimal RatePerSecond = 0.08m;
    private const decimal PoolingDiscountFactor = 0.70m; // 30% discount for pooled rides

    public decimal CalculateSoloFare(double distanceMeters, double timeSeconds)
    {
        var km = (decimal)distanceMeters / 1000m;
        var fare = BaseFare + km * RatePerKm + (decimal)timeSeconds * RatePerSecond;
        return Math.Round(fare, 0);
    }

    public decimal CalculatePoolingFare(double distanceMeters, double timeSeconds, int passengerCount)
    {
        var solo = CalculateSoloFare(distanceMeters, timeSeconds);
        var discounted = solo * PoolingDiscountFactor / Math.Max(1, passengerCount);
        return Math.Round(discounted, 0);
    }
}
