using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class PassengerConfiguration : IEntityTypeConfiguration<Passenger>
{
    public void Configure(EntityTypeBuilder<Passenger> builder)
    {
        builder.ToTable("passengers");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id");
        builder.Property(p => p.UserId).HasColumnName("user_id");
        builder.Property(p => p.RatingAverage).HasColumnName("rating_average").HasPrecision(3, 2);
        builder.Property(p => p.TotalTrips).HasColumnName("total_trips");
        builder.Property(p => p.PreferredPaymentMethod).HasColumnName("preferred_payment_method")
            .HasConversion<string>().HasMaxLength(10);

        builder.HasIndex(p => p.UserId).IsUnique();
        builder.HasOne(p => p.User).WithOne(u => u.Passenger)
            .HasForeignKey<Passenger>(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
