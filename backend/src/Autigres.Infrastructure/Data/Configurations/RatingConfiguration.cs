using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class RatingConfiguration : IEntityTypeConfiguration<Rating>
{
    public void Configure(EntityTypeBuilder<Rating> builder)
    {
        builder.ToTable("ratings");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.TripId).HasColumnName("trip_id");
        builder.Property(r => r.RaterUserId).HasColumnName("rater_user_id");
        builder.Property(r => r.RatedUserId).HasColumnName("rated_user_id");
        builder.Property(r => r.Score).HasColumnName("score");
        builder.Property(r => r.Comment).HasColumnName("comment");
        builder.Property(r => r.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(r => new { r.TripId, r.RaterUserId, r.RatedUserId }).IsUnique();
        builder.HasOne(r => r.Trip).WithMany(t => t.Ratings)
            .HasForeignKey(r => r.TripId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(r => r.RaterUser).WithMany()
            .HasForeignKey(r => r.RaterUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(r => r.RatedUser).WithMany()
            .HasForeignKey(r => r.RatedUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
