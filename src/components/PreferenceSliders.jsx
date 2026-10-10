/**
 * PreferenceSliders — Person 1's component.
 * Renders the four sensory sliders + max-extra-time. Writes a Preferences
 * object (CONTRACT §1) up via onChange. This is a working starter; Person 1
 * owns the styling and final UX.
 */
const SLIDERS = [
  { key: "noise", label: "Avoid noise" },
  { key: "crowd", label: "Avoid crowds" },
  { key: "shade", label: "Prefer shade" },
  { key: "speed", label: "Prioritize speed" },
];

export default function PreferenceSliders({ preferences, onChange }) {
  const set = (key, value) =>
    onChange({ ...preferences, [key]: Number(value) });

  return (
    <div className="preference-sliders">
      <h2>Your sensory preferences</h2>
      {SLIDERS.map(({ key, label }) => (
        <label key={key} className="slider-row">
          <span>
            {label}: <strong>{preferences[key]}</strong>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={preferences[key]}
            onChange={(e) => set(key, e.target.value)}
          />
        </label>
      ))}
      <label className="slider-row">
        <span>
          Max extra minutes: <strong>{preferences.maxExtraMinutes}</strong>
        </span>
        <input
          type="range"
          min="0"
          max="15"
          value={preferences.maxExtraMinutes}
          onChange={(e) => set("maxExtraMinutes", e.target.value)}
        />
      </label>
    </div>
  );
}
