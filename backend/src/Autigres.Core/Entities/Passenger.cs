using Autigres.Core.Enums;

namespace Autigres.Core.Entities;

public class Passenger
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public decimal RatingAverage { get; set; } = 5.00m;
    public int TotalTrips { get; set; }
    public PaymentMethod PreferredPaymentMethod { get; set; } = PaymentMethod.Cash;

    public User User { get; set; } = null!;
    public ICollection<TripRequest> TripRequests { get; set; } = new List<TripRequest>();
    public ICollection<TripPassenger> TripPassengers { get; set; } = new List<TripPassenger>();
}
