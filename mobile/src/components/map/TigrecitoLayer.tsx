import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Polyline } from 'react-native-maps';
import { NyanCatSprite } from './NyanCatSprite';
import type { LatLng } from 'react-native-maps';

// Rainbow trail palette — cycles per chunk of the traveled path
const TRAIL_COLORS = [
  '#7C3AED', // violet
  '#6366F1', // indigo
  '#38BDF8', // sky
  '#34D399', // emerald
  '#FCD34D', // yellow
  '#FB923C', // orange
  '#F87171', // red
  '#F472B6', // pink
];

const AHEAD_COLOR  = 'rgba(255,255,255,0.20)';
const UPDATE_MS    = 250; // 4 fps — smooth enough, gentle on the bridge
const NODES_PER_CHUNK = 6; // nodes per rainbow segment

type Coord = LatLng;

function dist(a: Coord, b: Coord): number {
  const dLat = b.latitude  - a.latitude;
  const dLng = b.longitude - a.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function lerp(a: Coord, b: Coord, t: number): Coord {
  return {
    latitude:  a.latitude  + (b.latitude  - a.latitude)  * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function posOnPoly(poly: Coord[], progress: number): { pos: Coord; nodeIdx: number } {
  if (poly.length < 2)
    return { pos: poly[0] ?? { latitude: 0, longitude: 0 }, nodeIdx: 0 };
  if (progress <= 0) return { pos: poly[0], nodeIdx: 0 };
  if (progress >= 1) return { pos: poly[poly.length - 1], nodeIdx: poly.length - 2 };

  let total = 0;
  const segs: number[] = [];
  for (let i = 0; i < poly.length - 1; i++) {
    const l = dist(poly[i], poly[i + 1]);
    segs.push(l);
    total += l;
  }

  let target = total * progress;
  let cum = 0;
  for (let i = 0; i < segs.length; i++) {
    if (cum + segs[i] >= target) {
      const t = segs[i] === 0 ? 0 : (target - cum) / segs[i];
      return { pos: lerp(poly[i], poly[i + 1], t), nodeIdx: i };
    }
    cum += segs[i];
  }
  return { pos: poly[poly.length - 1], nodeIdx: poly.length - 2 };
}

interface Props {
  polyline: Coord[];
  totalTimeSeconds: number;
}

export function TigrecitoLayer({ polyline, totalTimeSeconds }: Props) {
  const startRef = useRef(Date.now());
  const [progress, setProgress] = useState(0);

  // Reset animation whenever polyline or duration changes
  useEffect(() => {
    startRef.current = Date.now();
    setProgress(0);
    const t = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const p = Math.min(1, elapsed / Math.max(1, totalTimeSeconds));
      setProgress(p);
    }, UPDATE_MS);
    return () => clearInterval(t);
  }, [polyline, totalTimeSeconds]);

  const { pos, nodeIdx } = useMemo(
    () => posOnPoly(polyline, progress),
    [polyline, progress],
  );

  // Ahead portion: from current pos to end
  const aheadPoly = useMemo((): Coord[] => {
    const rest = polyline.slice(nodeIdx + 1);
    return [pos, ...rest];
  }, [polyline, nodeIdx, pos]);

  // Traveled portion split into rainbow chunks
  const trailChunks = useMemo((): { coords: Coord[]; color: string }[] => {
    const traveled = [...polyline.slice(0, nodeIdx + 1), pos];
    if (traveled.length < 2) return [];
    const chunks: { coords: Coord[]; color: string }[] = [];
    for (let i = 0; i < traveled.length - 1; i += NODES_PER_CHUNK) {
      const slice = traveled.slice(i, i + NODES_PER_CHUNK + 1);
      if (slice.length >= 2) {
        chunks.push({ coords: slice, color: TRAIL_COLORS[chunks.length % TRAIL_COLORS.length] });
      }
    }
    return chunks;
  }, [polyline, nodeIdx, pos]);

  if (polyline.length < 2) return null;

  return (
    <>
      {/* Ahead route — dimmed dashes */}
      {aheadPoly.length >= 2 && (
        <Polyline
          coordinates={aheadPoly}
          strokeColor={AHEAD_COLOR}
          strokeWidth={3}
          lineDashPattern={[8, 6]}
        />
      )}

      {/* Rainbow trail */}
      {trailChunks.map((chunk, i) => (
        <Polyline
          key={i}
          coordinates={chunk.coords}
          strokeColor={chunk.color}
          strokeWidth={5}
        />
      ))}

      {/* Nyan Cat marker */}
      <Marker
        coordinate={pos}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges
        flat
      >
        <NyanCatSprite />
      </Marker>
    </>
  );
}
