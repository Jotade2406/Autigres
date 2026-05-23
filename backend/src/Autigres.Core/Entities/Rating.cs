namespace Autigres.Core.Entities;

public class Rating
{
    public int Id { get; set; }
    public int TripId { get; set; }
    public int RaterUserId { get; set; }
    public int RatedUserId { get; set; }
    public byte Score { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }

    public Trip Trip { get; set; } = null!;
    public User RaterUser { get; set; } = null!;
    public User RatedUser { get; set; } = null!;
}
