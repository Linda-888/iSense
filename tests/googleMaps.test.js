import { describe, it, expect } from "vitest";
import { buildGoogleMapsURL } from "../src/utils/googleMaps.js";

const route = {
  origin: { lat: 40.1072, lng: -88.2272 },
  destination: { lat: 40.1125, lng: -88.2268 },
  waypoints: [
    { lat: 40.11, lng: -88.227 },
    { lat: 40.112, lng: -88.2265 },
  ],
};

describe("buildGoogleMapsURL", () => {
  it("includes origin, destination and walking mode", () => {
    const url = buildGoogleMapsURL(route);
    expect(url).toContain("origin=40.1072%2C-88.2272");
    expect(url).toContain("destination=40.1125%2C-88.2268");
    expect(url).toContain("travelmode=walking");
    expect(url).toContain("api=1");
  });

  it("joins waypoints with a pipe", () => {
    const url = buildGoogleMapsURL(route);
    // URLSearchParams encodes | as %7C and , as %2C
    expect(decodeURIComponent(url)).toContain("waypoints=40.11,-88.227|40.112,-88.2265");
  });

  it("caps waypoints at 3 (mobile Google Maps limit)", () => {
    const many = {
      ...route,
      waypoints: Array.from({ length: 5 }, (_, i) => ({ lat: i, lng: i })),
    };
    const decoded = decodeURIComponent(buildGoogleMapsURL(many));
    const wp = decoded.split("waypoints=")[1];
    expect(wp.split("|").length).toBe(3);
  });

  it("omits the waypoints param when there are none", () => {
    const url = buildGoogleMapsURL({ ...route, waypoints: [] });
    expect(url).not.toContain("waypoints=");
  });
});
