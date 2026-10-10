/**
 * Google Maps hand-off — Person 2's module (CONTRACT §6).
 *
 * Uses Google Maps URLs (https://www.google.com/maps/dir/?api=1...), which
 * require NO API key. Google may re-plan the path between waypoints or ignore
 * some of them (mobile browsers support up to 3 waypoints), so the in-app map
 * remains the source of truth for the recommended route.
 */

const coord = (p) => `${p.lat},${p.lng}`;

/**
 * @param {Object} route  a Route with .origin, .destination, optional .waypoints
 *                        (all { lat, lng }). See CONTRACT §2.
 * @returns {string} a shareable Google Maps walking-directions URL
 */
export function buildGoogleMapsURL(route) {
  const params = new URLSearchParams({
    api: "1",
    origin: coord(route.origin),
    destination: coord(route.destination),
    travelmode: "walking",
  });

  if (route.waypoints?.length) {
    // Google Maps mobile browsers honor at most 3 waypoints — keep it short.
    params.set(
      "waypoints",
      route.waypoints.slice(0, 3).map(coord).join("|")
    );
  }

  return `https://www.google.com/maps/dir/?${params}`;
}
