using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class TripRequestConfiguration : IEntityTypeConfiguration<TripRequest>
{
    public void Configure(EntityTypeBuilder<TripRequest> builder)
    {
        builder.ToTable("trip_requests");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.Uuid).HasColumnName("uuid").HasColumnType("char(36)");
        builder.Property(r => r.PassengerId).HasColumnName("passenger_id");
        builder.Property(r => r.OriginLat).HasColumnName("origin_lat").HasPrecision(10, 8);
        builder.Property(r => r.OriginLng).HasColumnName("origin_lng").HasPrecision(11, 8);
        builder.Property(r => r.OriginAddress).HasColumnName("origin_address").HasMaxLength(500);
        builder.Property(r => r.DestinationLat).HasColumnName("destination_lat").HasPrecision(10, 8);
        builder.Property(r => r.DestinationLng).HasColumnName("destination_lng").HasPrecision(11, 8);
        builder.Property(r => r.DestinationAddress).HasColumnName("destination_address").HasMaxLength(500);
        builder.Property(r => r.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.EstimatedFare).HasColumnName("estimated_fare").HasPrecision(10, 2);
        builder.Property(r => r.PaymentMethod).HasColumnName("payment_method").HasMaxLength(10);
        builder.Property(r => r.ServiceTier).HasColumnName("service_tier").HasMaxLength(20).HasDefaultValue("economico");
        builder.Property(r => r.MaxDetourSeconds).HasColumnName("max_detour_seconds");
        builder.Property(r => r.IsPoolingAllowed).HasColumnName("is_pooling_allowed");
        builder.Property(r => r.ExpiresAt).HasColumnName("expires_at");
        builder.Property(r => r.CancelledAt).HasColumnName("cancelled_at");
        builder.Property(r => r.CreatedAt).HasColumnName("created_at");
        builder.Property(r => r.UpdatedAt).HasColumnName("updated_at");

        builder.HasIndex(r => r.Uuid).IsUnique();
        builder.HasOne(r => r.Passenger).WithMany(p => p.TripRequests)
            .HasForeignKey(r => r.PassengerId).OnDelete(DeleteBehavior.Restrict);
    }
}
