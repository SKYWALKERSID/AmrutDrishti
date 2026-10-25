'use client';

import { useEffect, useState } from 'react';

type StationOption = {
  stationId: string;
  state: string;
  district: string;
  stationName: string;
  latestDate: string;
  horizonDays: 7;
};

type StationForecast = {
  status: 'experimental';
  modelIdentifier: string;
  modelVersion: string;
  stationId: string;
  variable: string;
  unitLabel: string;
  forecastHorizonDays: number;
  originDate: string;
  targetDate: string;
  inputSampleDays: number;
  prediction: { p10: number; p50: number; p90: number };
  intervalStatus: 'ordered_uncalibrated';
  operationalEligibility: false;
  measurementStatus: string;
  provenance: { sourceFiles: string[]; originRecordIds: string[]; aggregation: string };
};

export default function NwdpStationForecastPanel() {
  const [stations, setStations] = useState<StationOption[]>([]);
  const [stationId, setStationId] = useState('');
  const [horizonDays, setHorizonDays] = useState<number>(90);
  const [forecast, setForecast] = useState<StationForecast | null>(null);
  const [loadingStations, setLoadingStations] = useState(true);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/station-forecast?stations=true', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || body.status !== 'available' || !Array.isArray(body.stations)) {
          throw new Error(body.reason || 'Station forecast service is unavailable.');
        }
        if (active) {
          setStations(body.stations);
          setStationId((current) => current || body.stations[0]?.stationId || '');
          if (body.stations.length === 0) setError('No trained station models are available in the approved nine-state scope.');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Station forecast service is unavailable.');
      })
      .finally(() => { if (active) setLoadingStations(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!stationId) return;
    let active = true;
    setLoadingForecast(true);
    setForecast(null);
    setError(null);
    fetch(`/api/station-forecast?stationId=${encodeURIComponent(stationId)}&horizonDays=${horizonDays}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || body.status !== 'experimental') {
          throw new Error(body.reason || 'Experimental station inference is unavailable.');
        }
        if (active) setForecast(body as StationForecast);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Experimental station inference is unavailable.');
      })
      .finally(() => { if (active) setLoadingForecast(false); });
    return () => { active = false; };
  }, [stationId, horizonDays]);

  const selected = stations.find((station) => station.stationId === stationId);

  return (
    <section className="mt-8 border-t border-border pt-6 space-y-4" aria-labelledby="station-forecast-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="station-forecast-title" className="text-sm font-bold text-text-main">Experimental station telemetry forecast</h2>
          <p className="mt-1 max-w-3xl text-xs text-text-muted">
            NWDP station series are shown independently and are not assigned to the selected block. This source-reported variable has no verified station datum/sign convention; predictions are experimental and cannot support block decisions.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            <span className="font-medium">Target Horizon</span>
            <select
              className="border border-border bg-surface px-2 py-2 text-xs text-text-main"
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
              disabled={loadingForecast}
            >
              <option value={90}>90 Days (Primary Target)</option>
              <option value={180}>180 Days (Primary Target)</option>
              <option value={7}>7 Days (Short Horizon)</option>
            </select>
          </label>
          <label className="flex min-w-64 flex-col gap-1 text-xs text-text-muted">
            <span className="font-medium">Trained station (approved states only)</span>
            <select
              className="border border-border bg-surface px-2 py-2 text-text-main"
              value={stationId}
              onChange={(event) => setStationId(event.target.value)}
              disabled={loadingStations || stations.length === 0}
            >
              {stations.map((station) => (
                <option key={station.stationId} value={station.stationId}>
                  {station.state} · {station.district} · {station.stationName} · {station.latestDate}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loadingStations || loadingForecast ? (
        <p className="border border-border bg-subtle/50 p-3 text-xs text-text-muted" role="status">Loading station model or forecast…</p>
      ) : error ? (
        <p className="border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950" role="status">Forecast unavailable: {error}</p>
      ) : forecast ? (
        <div className="border border-amber-300 bg-amber-50/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-amber-950">EXPERIMENTAL · NOT OPERATIONAL</span>
            <span className="text-text-muted">{selected?.state} · {selected?.district} · {selected?.stationName}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {([
              ['P10', forecast.prediction.p10], ['P50', forecast.prediction.p50], ['P90', forecast.prediction.p90],
            ] as const).map(([label, value]) => (
              <div key={label} className="border border-border bg-surface p-3">
                <span className="block text-[10px] font-semibold uppercase text-text-muted">{label} · source units</span>
                <span className="mt-1 block text-lg font-bold text-text-main">{value.toFixed(3)} m (reported)</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-text-muted">
            {forecast.modelIdentifier} v{forecast.modelVersion}; {forecast.forecastHorizonDays}-day horizon from {forecast.originDate} to {forecast.targetDate}; {forecast.inputSampleDays} daily inputs. Interval: {forecast.intervalStatus}. The “meter” label is retained from the source; this is not verified m bgl.
          </p>
          <details className="text-[11px] text-text-muted">
            <summary className="cursor-pointer font-medium">Source lineage ({forecast.provenance.originRecordIds.length} records)</summary>
            <p className="mt-1">Daily median per station; no gap interpolation. Files: {forecast.provenance.sourceFiles.join(', ')}.</p>
          </details>
        </div>
      ) : (
        <p className="border border-border bg-subtle/50 p-3 text-xs text-text-muted" role="status">Select a trained station to request an experimental forecast.</p>
      )}
    </section>
  );
}
