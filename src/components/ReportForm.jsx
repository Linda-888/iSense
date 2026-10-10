/**
 * ReportForm — Person 1 (UI) + Person 3 (submit).
 * Collects an anonymous environmental report (CONTRACT §4) and would call
 * submitReport(supabase, report). No names, no diagnoses — ever.
 *
 * Starter wiring: holds local state and logs the report. Person 3 connects
 * submitReport() once Supabase is configured.
 */
import { useState } from "react";

const LEVELS = [
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
];

export default function ReportForm({ locations }) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [noise, setNoise] = useState(2);
  const [crowd, setCrowd] = useState(2);
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const report = {
      locationId,
      segmentId: null,
      type: "outdoor",
      noise: Number(noise),
      crowd: Number(crowd),
      seats: null,
    };
    // TODO (Person 3): await submitReport(supabase, report)
    console.log("Report to submit:", report);
    setStatus("Thanks! (demo mode — not yet saved to the database)");
  };

  return (
    <form className="report-form" onSubmit={handleSubmit}>
      <h2>Report conditions</h2>
      <label className="field">
        Location
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Noise
        <select value={noise} onChange={(e) => setNoise(e.target.value)}>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Crowd
        <select value={crowd} onChange={(e) => setCrowd(e.target.value)}>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </label>
      <button type="submit">Submit report</button>
      {status && <p className="report-form__status">{status}</p>}
    </form>
  );
}
