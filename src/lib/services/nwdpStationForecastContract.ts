const VARIABLE = "Groundwater Level Telemetry 6 Hourly (meter)";

export function isValidExperimentalStationList(value: unknown): value is {
  status: "available";
  operationalEligibility: false;
  stations: Array<{ stationId: string; state: string; district: string; stationName: string; latestDate: string; horizonDays: 7 }>;
} {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  if (response.status !== "available" || response.operationalEligibility !== false || !Array.isArray(response.stations)) return false;
  return response.stations.every((item) => {
    if (!item || typeof item !== "object") return false;
    const station = item as Record<string, unknown>;
    return typeof station.stationId === "string" && station.stationId.split("::").length === 3
      && typeof station.state === "string" && typeof station.district === "string"
      && typeof station.stationName === "string" && isDate(station.latestDate) && station.horizonDays === 7;
  });
}

export function isValidExperimentalStationForecast(value: unknown, expectedStationId: string): boolean {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  const prediction = response.prediction as Record<string, unknown> | undefined;
  const provenance = response.provenance as Record<string, unknown> | undefined;
  const sourceFiles = provenance?.sourceFiles;
  const sourceHashes = provenance?.sourceHashes as Record<string, unknown> | undefined;
  const originIds = provenance?.originRecordIds;
  const p10 = prediction?.p10, p50 = prediction?.p50, p90 = prediction?.p90;
  const originDate = response.originDate, targetDate = response.targetDate;
  if (!isDate(originDate) || !isDate(targetDate)) return false;
  const expectedTarget = new Date(`${originDate}T00:00:00Z`);
  const horizonDays = (typeof response.forecastHorizonDays === 'number' && [7, 90, 180].includes(response.forecastHorizonDays))
    ? response.forecastHorizonDays
    : 7;
  expectedTarget.setUTCDate(expectedTarget.getUTCDate() + horizonDays);
  const filePattern = /^gwl_tel_6_hourly_cgwb_[a-z]{2}_20(?:21_2025|26_2030)\.csv$/;
  return response.status === "experimental"
    && typeof response.modelIdentifier === "string" && response.modelIdentifier.startsWith("NWDP-Station-Experimental")
    && typeof response.modelVersion === "string" && response.stationId === expectedStationId
    && response.variable === VARIABLE
    && typeof response.unitLabel === "string" && response.unitLabel.includes("unverified")
    && (response.forecastHorizonDays === 7 || response.forecastHorizonDays === 90 || response.forecastHorizonDays === 180)
    && new Date(`${targetDate}T00:00:00Z`).getTime() === expectedTarget.getTime()
    && Number.isInteger(response.inputSampleDays) && Number(response.inputSampleDays) >= 7
    && finite(p10) && finite(p50) && finite(p90) && p10 <= p50 && p50 <= p90
    && response.intervalStatus === "ordered_uncalibrated" && response.operationalEligibility === false
    && response.measurementStatus === "experimental_source_reported_variable_unverified_depth"
    && provenance?.sourceRegistry === "data/sources/nwdp_telemetry_raw/nwdp_telemetry_source_registry.json"
    && Array.isArray(sourceFiles) && sourceFiles.length > 0 && sourceFiles.every((file) => typeof file === "string" && filePattern.test(file))
    && Array.isArray(originIds) && originIds.length > 0 && originIds.every((id) => typeof id === "string" && /^sha256:[a-f0-9]{64}:line:\d+$/.test(id))
    && !!sourceHashes && Object.keys(sourceHashes).length === 18
    && Object.entries(sourceHashes).every(([name, hash]) => filePattern.test(name) && typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash));
}

function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
