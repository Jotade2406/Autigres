using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class GraphEdgeConfiguration : IEntityTypeConfiguration<GraphEdge>
{
    public void Configure(EntityTypeBuilder<GraphEdge> builder)
    {
        builder.ToTable("graph_edges");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.FromNodeId).HasColumnName("from_node_id");
        builder.Property(e => e.ToNodeId).HasColumnName("to_node_id");
        builder.Property(e => e.DistanceMeters).HasColumnName("distance_meters").HasPrecision(10, 2);
        builder.Property(e => e.TimeSecondsAvg).HasColumnName("time_seconds_avg");
        builder.Property(e => e.RoadName).HasColumnName("road_name").HasMaxLength(200);
        builder.Property(e => e.IsBidirectional).HasColumnName("is_bidirectional");

        builder.HasIndex(e => new { e.FromNodeId, e.ToNodeId }).IsUnique();
        builder.HasOne(e => e.FromNode).WithMany(n => n.OutgoingEdges)
            .HasForeignKey(e => e.FromNodeId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(e => e.ToNode).WithMany(n => n.IncomingEdges)
            .HasForeignKey(e => e.ToNodeId).OnDelete(DeleteBehavior.Restrict);
    }
}
