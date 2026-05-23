using Autigres.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Autigres.Infrastructure.Data.Configurations;

public class GraphNodeConfiguration : IEntityTypeConfiguration<GraphNode>
{
    public void Configure(EntityTypeBuilder<GraphNode> builder)
    {
        builder.ToTable("graph_nodes");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id).HasColumnName("id");
        builder.Property(n => n.NodeKey).HasColumnName("node_key").HasMaxLength(50);
        builder.Property(n => n.Lat).HasColumnName("lat").HasPrecision(10, 8);
        builder.Property(n => n.Lng).HasColumnName("lng").HasPrecision(11, 8);
        builder.Property(n => n.City).HasColumnName("city").HasMaxLength(100);
        builder.Property(n => n.AddressReference).HasColumnName("address_reference").HasMaxLength(500);

        builder.HasIndex(n => n.NodeKey).IsUnique();
        builder.HasIndex(n => new { n.Lat, n.Lng });
    }
}
