using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class ShareRequestConfiguration : IEntityTypeConfiguration<ShareRequest>
{
    public void Configure(EntityTypeBuilder<ShareRequest> b)
    {
        b.ToTable("share_requests");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.Uuid).HasColumnName("uuid").HasColumnType("char(36)");
        b.Property(x => x.RequesterRequestId).HasColumnName("requester_request_id");
        b.Property(x => x.TargetRequestId).HasColumnName("target_request_id");
        b.Property(x => x.Status).HasColumnName("status").HasConversion<int>();
        b.Property(x => x.CombinedTripId).HasColumnName("combined_trip_id");
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Property(x => x.ExpiresAt).HasColumnName("expires_at");

        b.HasIndex(x => x.Uuid).IsUnique();

        b.HasOne(x => x.RequesterRequest)
            .WithMany()
            .HasForeignKey(x => x.RequesterRequestId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.TargetRequest)
            .WithMany()
            .HasForeignKey(x => x.TargetRequestId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.CombinedTrip)
            .WithMany()
            .HasForeignKey(x => x.CombinedTripId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
