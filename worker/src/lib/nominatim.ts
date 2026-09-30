export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BiancasAdventures/1.0 (personal, non-commercial)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string> };
    const address = data.address ?? {};
    const place = address.city ?? address.town ?? address.village ?? address.municipality;
    if (!place) return null;
    return address.country ? `${place}, ${address.country}` : place;
  } catch {
    return null;
  }
}
