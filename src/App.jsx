import { useMemo, useState } from "react";
import PreferenceSliders from "./components/PreferenceSliders.jsx";
import LocationSelector from "./components/LocationSelector.jsx";
import RouteMap from "./components/RouteMap.jsx";
import RouteCard from "./components/RouteCard.jsx";
import ReportForm from "./components/ReportForm.jsx";
import { recommendRoutes } from "./algorithms/routeScoring.js";
import routesData from "./data/routes.json";
import locationsData from "./data/locations.json";

/**
 * App shell wired to the CONTRACT interfaces.
 *
 * This is deliberately a skeleton: it proves the end-to-end data flow
 * (preferences -> recommendRoutes -> ranked routes -> cards/map) works with
 * the demo data, so each teammate can build their module against a running app.
 */
export default function App() {
  const [preferences, setPreferences] = useState({
    noise: 80,
    crowd: 70,
    shade: 90,
    speed: 30,
    maxExtraMinutes: 5,
  });

  const [origin, setOrigin] = useState(locationsData[0]?.id ?? null);
  const [destination, setDestination] = useState(locationsData[1]?.id ?? null);

  const rankedRoutes = useMemo(
    () => recommendRoutes(routesData, preferences),
    [preferences]
  );

  const recommended = rankedRoutes[0] ?? null;

  return (
    <main className="app">
      <header className="app__header">
        <h1>iSense</h1>
        <p className="app__tagline">
          More inclusive campus navigation — equal access to environmental
          information and personalized routes for every sensory need.
        </p>
      </header>

      <section className="app__panel">
        <LocationSelector
          locations={locationsData}
          origin={origin}
          destination={destination}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
        />
        <PreferenceSliders
          preferences={preferences}
          onChange={setPreferences}
        />
      </section>

      <section className="app__panel">
        <RouteMap routes={rankedRoutes} recommended={recommended} />
      </section>

      <section className="app__panel">
        <h2>Recommended routes</h2>
        {rankedRoutes.length === 0 && <p>No routes match these preferences yet.</p>}
        {rankedRoutes.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            preferences={preferences}
            isTop={route.id === recommended?.id}
          />
        ))}
      </section>

      <section className="app__panel">
        <ReportForm locations={locationsData} />
      </section>

      <footer className="app__footer">
        <small>
          Demo environmental values are simulated and clearly labeled — not
          real-time measurements.
        </small>
      </footer>
    </main>
  );
}
