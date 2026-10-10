/**
 * RouteCard — Person 1's component.
 * Shows one scored route, its reason, cost badges, and the Google Maps hand-off
 * button. Uses explainRoute (Person 2) and buildGoogleMapsURL (Person 2).
 */
import { explainRoute } from "../algorithms/routeScoring.js";
import { buildGoogleMapsURL } from "../utils/googleMaps.js";

export default function RouteCard({ route, preferences, isTop }) {
  return (
    <article className={`route-card${isTop ? " route-card--top" : ""}`}>
      <header className="route-card__header">
        <h3>{route.name}</h3>
        {isTop && <span className="route-card__badge">Best match</span>}
      </header>

      <p className="route-card__reason">{explainRoute(route, preferences)}</p>

      <ul className="route-card__costs">
        <li>⏱ {route.durationMinutes} min</li>
        <li>🔊 noise {route.noiseCost}</li>
        <li>👥 crowd {route.crowdCost}</li>
        <li>☀️ sun {route.sunCost}</li>
      </ul>

      {route.dataSource === "demo" && (
        <p className="route-card__note">Demo values (simulated, not live data).</p>
      )}

      <a
        className="route-card__nav"
        href={buildGoogleMapsURL(route)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Navigate with Google Maps
      </a>
    </article>
  );
}
