using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> builder)
    {
        builder.ToTable("vehicles");
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).HasColumnName("id");
        builder.Property(v => v.DriverId).HasColumnName("driver_id");
        builder.Property(v => v.PlateNumber).HasColumnName("plate_number").HasMaxLength(20);
        builder.Property(v => v.Brand).HasColumnName("brand").HasMaxLength(100);
        builder.Property(v => v.Model).HasColumnName("model").HasMaxLength(100);
        builder.Property(v => v.Year).HasColumnName("year");
        builder.Property(v => v.Color).HasColumnName("color").HasMaxLength(50);
        builder.Property(v => v.Capacity).HasColumnName("capacity");
        builder.Property(v => v.IsActive).HasColumnName("is_active");

        builder.HasIndex(v => v.PlateNumber).IsUnique();
        builder.HasOne(v => v.Driver).WithMany(d => d.Vehicles)
            .HasForeignKey(v => v.DriverId).OnDelete(DeleteBehavior.Cascade);
    }
}
