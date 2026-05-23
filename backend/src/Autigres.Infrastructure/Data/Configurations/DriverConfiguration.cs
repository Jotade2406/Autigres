using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class DriverConfiguration : IEntityTypeConfiguration<Driver>
{
    public void Configure(EntityTypeBuilder<Driver> builder)
    {
        builder.ToTable("drivers");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasColumnName("id");
        builder.Property(d => d.UserId).HasColumnName("user_id");
        builder.Property(d => d.LicenseNumber).HasColumnName("license_number").HasMaxLength(50).IsRequired(false);
        builder.Property(d => d.LicenseExpiry).HasColumnName("license_expiry").IsRequired(false);
        builder.Property(d => d.RatingAverage).HasColumnName("rating_average").HasPrecision(3, 2);
        builder.Property(d => d.TotalTrips).HasColumnName("total_trips");
        builder.Property(d => d.IsAvailable).HasColumnName("is_available");
        builder.Property(d => d.IsOnline).HasColumnName("is_online");
        builder.Property(d => d.CurrentLat).HasColumnName("current_lat").HasPrecision(10, 8);
        builder.Property(d => d.CurrentLng).HasColumnName("current_lng").HasPrecision(11, 8);
        builder.Property(d => d.LastLocationUpdate).HasColumnName("last_location_update");
        builder.Property(d => d.VerifiedAt).HasColumnName("verified_at");

        builder.HasIndex(d => d.UserId).IsUnique();
        builder.HasIndex(d => d.LicenseNumber).IsUnique();
        builder.HasOne(d => d.User).WithOne(u => u.Driver)
            .HasForeignKey<Driver>(d => d.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
