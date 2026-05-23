using Autigres.Core.Enums;

namespace Autigres.Core.Entities;

public enum PaymentStatus { Pending, Completed, Failed, Refunded }

public class Payment
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    public int TripPassengerId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BOB";
    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? TransactionId { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public TripPassenger TripPassenger { get; set; } = null!;
}
