using Autigres.Core.Entities;
using Autigres.Core.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Autigres.Infrastructure.Data.Configurations;

public class TripPassengerConfiguration : IEntityTypeConfiguration<TripPassenger>
{
    public void Configure(EntityTypeBuilder<TripPassenger> builder)
    {
        builder.ToTable("trip_passengers");
        builder.HasKey(tp => tp.Id);
        builder.Property(tp => tp.Id).HasColumnName("id");
        builder.Property(tp => tp.TripId).HasColumnName("trip_id");
        builder.Property(tp => tp.PassengerId).HasColumnName("passenger_id");
        builder.Property(tp => tp.RequestId).HasColumnName("request_id");
        builder.Property(tp => tp.PickupLat).HasColumnName("pickup_lat").HasPrecision(10, 8);
        builder.Property(tp => tp.PickupLng).HasColumnName("pickup_lng").HasPrecision(11, 8);
        builder.Property(tp => tp.PickupAddress).HasColumnName("pickup_address").HasMaxLength(500);
        builder.Property(tp => tp.DropoffLat).HasColumnName("dropoff_lat").HasPrecision(10, 8);
        builder.Property(tp => tp.DropoffLng).HasColumnName("dropoff_lng").HasPrecision(11, 8);
        builder.Property(tp => tp.DropoffAddress).HasColumnName("dropoff_address").HasMaxLength(500);
        builder.Property(tp => tp.PickupOrder).HasColumnName("pickup_order");
        builder.Property(tp => tp.DropoffOrder).HasColumnName("dropoff_order");
        builder.Property(tp => tp.FareAmount).HasColumnName("fare_amount").HasPrecision(10, 2);
        builder.Property(tp => tp.Status)
            .HasColumnName("status")
            .HasConversion(new ValueConverter<TripPassengerStatus, string>(
                v => StatusToDb(v),
                s => StatusFromDb(s)))
            .HasMaxLength(20);
        builder.Property(tp => tp.AddedDetourSeconds).HasColumnName("added_detour_seconds");
        builder.Property(tp => tp.PickedUpAt).HasColumnName("picked_up_at");
        builder.Property(tp => tp.DroppedOffAt).HasColumnName("dropped_off_at");

        builder.HasIndex(tp => new { tp.TripId, tp.PassengerId }).IsUnique();
        builder.HasOne(tp => tp.Trip).WithMany(t => t.TripPassengers)
            .HasForeignKey(tp => tp.TripId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(tp => tp.Passenger).WithMany(p => p.TripPassengers)
            .HasForeignKey(tp => tp.PassengerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(tp => tp.Request).WithOne(r => r.TripPassenger)
            .HasForeignKey<TripPassenger>(tp => tp.RequestId).OnDelete(DeleteBehavior.Restrict);
    }

    private static string StatusToDb(TripPassengerStatus v)
    {
        if (v == TripPassengerStatus.PickedUp)   return "picked_up";
        if (v == TripPassengerStatus.DroppedOff) return "dropped_off";
        if (v == TripPassengerStatus.NoShow)     return "no_show";
        return v.ToString().ToLower();
    }

    private static TripPassengerStatus StatusFromDb(string s)
    {
        if (s == "picked_up")   return TripPassengerStatus.PickedUp;
        if (s == "dropped_off") return TripPassengerStatus.DroppedOff;
        if (s == "no_show")     return TripPassengerStatus.NoShow;
        return Enum.Parse<TripPassengerStatus>(s, true);
    }
}
