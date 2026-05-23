using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id");
        builder.Property(p => p.Uuid).HasColumnName("uuid").HasColumnType("char(36)");
        builder.Property(p => p.TripPassengerId).HasColumnName("trip_passenger_id");
        builder.Property(p => p.Amount).HasColumnName("amount").HasPrecision(10, 2);
        builder.Property(p => p.Currency).HasColumnName("currency").HasMaxLength(3);
        builder.Property(p => p.Method).HasColumnName("method").HasConversion<string>().HasMaxLength(10);
        builder.Property(p => p.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(15);
        builder.Property(p => p.TransactionId).HasColumnName("transaction_id").HasMaxLength(255);
        builder.Property(p => p.ProcessedAt).HasColumnName("processed_at");
        builder.Property(p => p.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(p => p.Uuid).IsUnique();
        builder.HasIndex(p => p.TransactionId).IsUnique();
        builder.HasOne(p => p.TripPassenger).WithOne(tp => tp.Payment)
            .HasForeignKey<Payment>(p => p.TripPassengerId).OnDelete(DeleteBehavior.Restrict);
    }
}
