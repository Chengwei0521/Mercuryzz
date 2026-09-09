export function latLonToPoint(latitude, longitude, radius = 1) {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return {
    x: radius * Math.cos(lat) * Math.cos(lon),
    y: radius * Math.sin(lat),
    z: radius * Math.cos(lat) * Math.sin(lon),
  };
}

export function pointToLatLon({ x, y, z }) {
  const radius = Math.hypot(x, y, z);
  if (!radius) return { latitude: 0, longitude: 0 };
  return {
    latitude: (Math.asin(Math.max(-1, Math.min(1, y / radius))) * 180) / Math.PI,
    longitude: (Math.atan2(z, x) * 180) / Math.PI,
  };
}

export function formatCoordinates(latitude, longitude) {
  return `${Math.abs(latitude).toFixed(1)}\u00b0 ${latitude < 0 ? 'S' : 'N'} / ${Math.abs(longitude).toFixed(1)}\u00b0 ${longitude < 0 ? 'W' : 'E'}`;
}

export function validateSignal({ name, message, latitude, longitude, mood }) {
  if (!name.trim() || [...name.trim()].length > 32) return 'Your callsign needs 1 to 32 characters.';
  if (!message.trim() || [...message.trim()].length > 280) return 'Your signal needs 1 to 280 characters.';
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return 'Choose a valid surface coordinate.';
  if (!['wonder', 'hope', 'curiosity'].includes(mood)) return 'Choose a signal frequency.';
  return null;
}
