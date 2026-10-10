/**
 * LocationSelector — Person 1's component.
 * Origin / destination dropdowns populated from Location[] (CONTRACT §3).
 */
export default function LocationSelector({
  locations,
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
}) {
  return (
    <div className="location-selector">
      <h2>Where to?</h2>
      <label className="field">
        From
        <select value={origin ?? ""} onChange={(e) => onOriginChange(e.target.value)}>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        To
        <select
          value={destination ?? ""}
          onChange={(e) => onDestinationChange(e.target.value)}
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
