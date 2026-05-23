namespace Autigres.Core.Entities;

public class Vehicle
{
    public int Id { get; set; }
    public int DriverId { get; set; }
    public string PlateNumber { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int Year { get; set; }
    public string Color { get; set; } = string.Empty;
    public byte Capacity { get; set; } = 4;
    public bool IsActive { get; set; } = true;

    public Driver Driver { get; set; } = null!;
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
}
