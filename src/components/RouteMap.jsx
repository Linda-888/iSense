/**
 * RouteMap — Person 1 + Person 2.
 * Placeholder for the Leaflet map that draws candidate route polylines
 * (route.coordinates) and highlights the recommended one.
 *
 * Kept as a lightweight placeholder so the app runs before react-leaflet is
 * wired in. Replace the inner <div> with <MapContainer> + <Polyline> from
 * react-leaflet. The in-app map is the source of truth for the route (Google
 * Maps may re-plan between waypoints).
 */
export default function RouteMap({ routes, recommended }) {
  return (
    <div className="route-map" aria-label="Route map placeholder">
      <h2>Map</h2>
      <div className="route-map__canvas">
        <p>
          Leaflet map goes here — {routes.length} candidate route
          {routes.length === 1 ? "" : "s"}.
        </p>
        {recommended && (
          <p>
            Highlighted: <strong>{recommended.name}</strong> (
            {recommended.coordinates?.length ?? 0} points)
          </p>
        )}
      </div>
    </div>
  );
}
