/**
 * Report read/write — Person 3's module (CONTRACT §6).
 *
 * Maps between the app's camelCase Report shape (CONTRACT §4) and the
 * snake_case Supabase columns. Pass in the `supabase` client from
 * services/supabase.js. All functions throw on error so callers can show a
 * message and fall back to demo data.
 */

/** @returns {Promise<Array>} Location[] */
export async function getLocations(supabase) {
  const { data, error } = await supabase.from("locations").select("*");
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {string} [locationId]  optional filter
 * @returns {Promise<Array>} Report[] (raw snake_case rows)
 */
export async function getReports(supabase, locationId) {
  let query = supabase.from("reports").select("*");
  if (locationId) query = query.eq("location_id", locationId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {Object} report  Report (camelCase, CONTRACT §4)
 * @returns {Promise<void>}
 */
export async function submitReport(supabase, report) {
  const { error } = await supabase.from("reports").insert({
    location_id: report.locationId,
    segment_id: report.segmentId ?? null,
    report_type: report.type,
    noise_level: report.noise,
    crowd_level: report.crowd,
    seat_availability: report.seats ?? null,
  });
  if (error) throw error;
}
