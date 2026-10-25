import test from "node:test";
import assert from "node:assert/strict";
import { isValidExperimentalStationForecast, isValidExperimentalStationList } from "../src/lib/services/nwdpStationForecastContract.ts";

const stationId = "Haryana::Karnal::Example Pz";
const sourceHashes = Object.fromEntries(["hr", "ka", "mp", "ml", "pb", "rj", "tn", "ts", "tr"].flatMap((state) => [
  [`gwl_tel_6_hourly_cgwb_${state}_2021_2025.csv`, "a".repeat(64)],
  [`gwl_tel_6_hourly_cgwb_${state}_2026_2030.csv`, "b".repeat(64)],
]));
const validResponse = () => ({
  status: "experimental", modelIdentifier: "NWDP-Station-Experimental-7d", modelVersion: "1.0.0-experimental",
  stationId, variable: "Groundwater Level Telemetry 6 Hourly (meter)",
  unitLabel: "meter as reported by source; groundwater datum and sign convention unverified",
  forecastHorizonDays: 7, originDate: "2026-10-22", targetDate: "2026-10-29", inputSampleDays: 7,
  prediction: { p10: 9, p50: 10, p90: 11 }, intervalStatus: "ordered_uncalibrated", operationalEligibility: false,
  measurementStatus: "experimental_source_reported_variable_unverified_depth",
  provenance: {
    sourceRegistry: "data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json",
    sourceFiles: ["gwl_tel_6_hourly_cgwb_hr_2026_2030.csv"],
    originRecordIds: ["sha256:" + "a".repeat(64) + ":line:17"], sourceHashes,
  },
});

test("station forecast contract is experimental, traceable and not m bgl", () => {
  assert.equal(isValidExperimentalStationForecast(validResponse(), stationId), true);
  const bad = validResponse(); bad.unitLabel = "verified m bgl";
  assert.equal(isValidExperimentalStationForecast(bad, stationId), false);
});

test("station forecast rejects wrong identity, horizon, target, interval and missing lineage", () => {
  assert.equal(isValidExperimentalStationForecast(validResponse(), "Punjab::X::Y"), false);
  for (const mutate of [
    (body: any) => { body.targetDate = "2026-10-28"; },
    (body: any) => { body.forecastHorizonDays = 30; },
    (body: any) => { body.prediction = { p10: 11, p50: 10, p90: 9 }; },
    (body: any) => { body.provenance.originRecordIds = []; },
  ]) {
    const invalid = validResponse(); mutate(invalid);
    assert.equal(isValidExperimentalStationForecast(invalid, stationId), false);
  }
});

test("station list requires stable station identity and non-operational status", () => {
  assert.equal(isValidExperimentalStationList({
    status: "available", operationalEligibility: false,
    stations: [{ stationId, state: "Haryana", district: "Karnal", stationName: "Example Pz", latestDate: "2026-10-22", horizonDays: 7 }],
  }), true);
  assert.equal(isValidExperimentalStationList({ status: "available", operationalEligibility: true, stations: [] }), false);
});
