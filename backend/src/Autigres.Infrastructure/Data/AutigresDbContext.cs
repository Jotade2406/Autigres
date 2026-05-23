using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Autigres.Infrastructure.Data;

public class AutigresDbContext : DbContext
{
    public AutigresDbContext(DbContextOptions<AutigresDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Passenger> Passengers => Set<Passenger>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<TripRequest> TripRequests => Set<TripRequest>();
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<TripPassenger> TripPassengers => Set<TripPassenger>();
    public DbSet<RouteWaypoint> RouteWaypoints => Set<RouteWaypoint>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<GraphNode>    GraphNodes    => Set<GraphNode>();
    public DbSet<GraphEdge>    GraphEdges    => Set<GraphEdge>();
    public DbSet<ShareRequest> ShareRequests => Set<ShareRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AutigresDbContext).Assembly);
    }
}
