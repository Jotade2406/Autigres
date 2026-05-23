using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class TripConfiguration : IEntityTypeConfiguration<Trip>
{
    public void Configure(EntityTypeBuilder<Trip> builder)
    {
        builder.ToTable("trips");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.Uuid).HasColumnName("uuid").HasColumnType("char(36)");
        builder.Property(t => t.DriverId).HasColumnName("driver_id");
        builder.Property(t => t.VehicleId).HasColumnName("vehicle_id");
        builder.Property(t => t.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.OriginLat).HasColumnName("origin_lat").HasPrecision(10, 8);
        builder.Property(t => t.OriginLng).HasColumnName("origin_lng").HasPrecision(11, 8);
        builder.Property(t => t.OriginAddress).HasColumnName("origin_address").HasMaxLength(500);
        builder.Property(t => t.DestinationLat).HasColumnName("destination_lat").HasPrecision(10, 8);
        builder.Property(t => t.DestinationLng).HasColumnName("destination_lng").HasPrecision(11, 8);
        builder.Property(t => t.DestinationAddress).HasColumnName("destination_address").HasMaxLength(500);
        builder.Property(t => t.TotalDistanceKm).HasColumnName("total_distance_km").HasPrecision(8, 3);
        builder.Property(t => t.BaseFare).HasColumnName("base_fare").HasPrecision(10, 2);
        builder.Property(t => t.IsPoolingAllowed).HasColumnName("is_pooling_allowed");
        builder.Property(t => t.PaymentMethod).HasColumnName("payment_method").HasMaxLength(10);
        builder.Property(t => t.ArrivedAt).HasColumnName("arrived_at");
        builder.Property(t => t.StartedAt).HasColumnName("started_at");
        builder.Property(t => t.CompletedAt).HasColumnName("completed_at");
        builder.Property(t => t.CancelledAt).HasColumnName("cancelled_at");
        builder.Property(t => t.CreatedAt).HasColumnName("created_at");
        builder.Property(t => t.UpdatedAt).HasColumnName("updated_at");

        builder.HasIndex(t => t.Uuid).IsUnique();
        builder.HasOne(t => t.Driver).WithMany(d => d.Trips)
            .HasForeignKey(t => t.DriverId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(t => t.Vehicle).WithMany(v => v.Trips)
            .HasForeignKey(t => t.VehicleId).IsRequired(false).OnDelete(DeleteBehavior.Restrict);
    }
}
