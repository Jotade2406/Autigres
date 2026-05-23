using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class RouteWaypointConfiguration : IEntityTypeConfiguration<RouteWaypoint>
{
    public void Configure(EntityTypeBuilder<RouteWaypoint> builder)
    {
        builder.ToTable("route_waypoints");
        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).HasColumnName("id");
        builder.Property(w => w.TripId).HasColumnName("trip_id");
        builder.Property(w => w.SequenceOrder).HasColumnName("sequence_order");
        builder.Property(w => w.Lat).HasColumnName("lat").HasPrecision(10, 8);
        builder.Property(w => w.Lng).HasColumnName("lng").HasPrecision(11, 8);
        builder.Property(w => w.NodeRef).HasColumnName("node_ref").HasMaxLength(50);
        builder.Property(w => w.WaypointType).HasColumnName("waypoint_type")
            .HasConversion<string>().HasMaxLength(10);
        builder.Property(w => w.ArrivedAt).HasColumnName("arrived_at");

        builder.HasOne(w => w.Trip).WithMany(t => t.RouteWaypoints)
            .HasForeignKey(w => w.TripId).OnDelete(DeleteBehavior.Cascade);
    }
}
