import { GOOGLE_MAPS_API_KEY } from '../config/maps';

const GMAPS = 'https://maps.googleapis.com/maps/api';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

export interface PlacePrediction {
  placeId:       string;
  mainText:      string;
  secondaryText: string;
  description:   string;
  /** Nominatim results already have coords — skip the extra geocode call. */
  preResolved?:  { lat: number; lng: number; address: string };
}

export interface PlaceCoords {
  lat:     number;
  lng:     number;
  address: string;
}

// ── Search ────────────────────────────────────────────────────────────────────

async function googleAutocomplete(
  query: string,
  location?: { lat: number; lng: number },
): Promise<PlacePrediction[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];

  const loc = location ? `&location=${location.lat},${location.lng}&radius=50000` : '';
  const url =
    `${GMAPS}/place/autocomplete/json` +
    `?input=${encodeURIComponent(query)}` +
    `&key=${GOOGLE_MAPS_API_KEY}` +
    `&language=es&components=country:bo` + loc;

  try {
    const json = await fetch(url).then(r => r.json());
    if (json.status !== 'OK') return [];

    return (json.predictions as any[]).map(p => ({
      placeId:       p.place_id,
      mainText:      p.structured_formatting?.main_text      ?? p.description,
      secondaryText: p.structured_formatting?.secondary_text ?? '',
      description:   p.description,
    }));
  } catch { return []; }
}

async function nominatimSearch(
  query: string,
  location?: { lat: number; lng: number },
): Promise<PlacePrediction[]> {
  const viewbox = location
    ? `&viewbox=${location.lng - 0.5},${location.lat + 0.5},${location.lng + 0.5},${location.lat - 0.5}&bounded=0`
    : '';

  const url =
    `${NOMINATIM}/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&limit=6&countrycodes=bo` +
    `&accept-language=es&addressdetails=1` + viewbox;

  try {
    const items: any[] = await fetch(url, {
      headers: { 'User-Agent': 'Autigres/1.0' },
    }).then(r => r.json());

    return items.map(item => {
      const city    = item.address?.city ?? item.address?.town ?? item.address?.village ?? 'Bolivia';
      const mainTxt = item.name || item.display_name.split(',')[0].trim();
      const sub     = `${city}, Bolivia`;
      return {
        placeId:       `nominatim:${item.place_id}`,
        mainText:      mainTxt,
        secondaryText: sub,
        description:   item.display_name,
        preResolved:   {
          lat:     parseFloat(item.lat),
          lng:     parseFloat(item.lon),
          address: item.display_name,
        },
      };
    });
  } catch { return []; }
}

export async function searchPlaces(
  query: string,
  location?: { lat: number; lng: number },
): Promise<PlacePrediction[]> {
  if (!query.trim()) return [];

  const google = await googleAutocomplete(query, location);
  if (google.length > 0) return google;

  return nominatimSearch(query, location);
}

// ── Geocode ───────────────────────────────────────────────────────────────────

export async function getPlaceCoords(placeId: string): Promise<PlaceCoords | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const url =
    `${GMAPS}/place/details/json` +
    `?place_id=${placeId}` +
    `&fields=geometry,formatted_address` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const json = await fetch(url).then(r => r.json());
    if (json.status !== 'OK') return null;

    const loc = json.result.geometry.location;
    return { lat: loc.lat, lng: loc.lng, address: json.result.formatted_address };
  } catch { return null; }
}

// ── Reverse geocode ───────────────────────────────────────────────────────────

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Try Google first
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const url =
        `${GMAPS}/geocode/json?latlng=${lat},${lng}` +
        `&key=${GOOGLE_MAPS_API_KEY}&language=es`;
      const json = await fetch(url).then(r => r.json());
      if (json.status === 'OK' && json.results?.length) {
        const street = (json.results as any[]).find(
          r => r.types?.includes('street_address') || r.types?.includes('route'),
        );
        return (street ?? json.results[0]).formatted_address as string;
      }
    } catch { /* fall through */ }
  }

  // Nominatim fallback
  try {
    const url =
      `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}` +
      `&format=json&accept-language=es`;
    const json: any = await fetch(url, {
      headers: { 'User-Agent': 'Autigres/1.0' },
    }).then(r => r.json());
    if (json.display_name) return json.display_name as string;
  } catch { /* ignore */ }

  return 'Mi ubicación actual';
}
