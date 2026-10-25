'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BlockData } from '@/lib/types';
import {
  LineChart,
  Line,
  Bar,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { WaterDropletIcon, CloudRainIcon, ActivityChartIcon, FilterIcon, InfoIcon } from '@/components/ui/Icons';
import HistoricalObservationsPanel from '@/components/HistoricalObservationsPanel';
import NwdpStationForecastPanel from '@/components/NwdpStationForecastPanel';
import { useLanguage } from '@/lib/context/LanguageContext';
import { ACTIVE_TARGET_BLOCKS, ACTIVE_TARGET_DISTRICTS, mergeWithLiveBlocks, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { ALL_INDIAN_STATES, ALL_TARGET_STATES, HISTORICAL_REFERENCE_STATES, EXPANSION_INDIAN_STATES, TARGET_REGIONS, isTargetState, getTargetStatesAlphabetically } from '@/lib/data/indiaStates';
import { sortDistrictsAlphabetically, sortBlocksByName, sortBlocksHierarchy } from '@/lib/data/geographicSorting';
import { historicalSeriesProvenanceFor } from '@/lib/data/historicalSeriesProvenance';
import { CHART_COLORS, deviationColor } from '@/lib/design/chartPalette';
import { TermHelp } from '@/components/ui/PlainLanguageHelp';
import { evaluateGroundwaterIntelligence } from '@/lib/services/scientificEngine';

interface HistoricalPoint {
  month: string;
  wellDepth: number;
}

interface RawObservation {
  station_id: string;
  station_name: string;
  district_id: string;
  district_name: string;
  block_id: string;
  block_name: string;
  observation_date: string;
  water_level_mbgl: number | null;
  unit: string;
  quality_flag?: string;
  source_name?: string;
  source_provider?: string;
  source_resource_url?: string;
}

function MonitoringContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const targetStatesAtoZ = useMemo(() => getTargetStatesAlphabetically(), []);
  const initialFirstState = targetStatesAtoZ[0]?.name || 'Haryana';
  const initialDistricts = useMemo(() => {
    return sortDistrictsAlphabetically(
      ACTIVE_TARGET_DISTRICTS.filter(d => normalizeStateName(d.state) === initialFirstState)
    );
  }, [initialFirstState]);
  const initialFirstDistrict = initialDistricts[0];
  const initialBlocks = useMemo(() => {
    return sortBlocksByName(
      ACTIVE_TARGET_BLOCKS.filter(b => normalizeStateName(b.state) === initialFirstState && b.districtId === initialFirstDistrict?.id)
    );
  }, [initialFirstState, initialFirstDistrict]);
  const initialFirstBlock = initialBlocks[0];

  const [selectedState, setSelectedState] = useState<string>(initialFirstState);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(initialFirstDistrict?.id || 'all');
  const [selectedBlockId, setSelectedBlockId] = useState<string>(urlBlockParam || initialFirstBlock?.id || '');
  const [selectedStationId, setSelectedStationId] = useState<string>('all');
  const [selectedDataSource, setSelectedDataSource] = useState<'telemetry' | 'cgwb_manual'>('telemetry');
  const [telemetryStationsList, setTelemetryStationsList] = useState<Array<{
    stationId: string;
    stationName: string;
    state: string;
    district: string;
    observationCount: number;
    earliestDate: string;
    latestDate: string;
    sourceFiles: string[];
  }>>([]);
  const [selectedTelemetryStationId, setSelectedTelemetryStationId] = useState<string>('');
  const [telemetryRawObservations, setTelemetryRawObservations] = useState<RawObservation[]>([]);
  const [telemetryMetadata, setTelemetryMetadata] = useState<any>(null);
  const [telemetryStationForecast, setTelemetryStationForecast] = useState<any>(null);
  const [isTelemetryLoading, setIsTelemetryLoading] = useState<boolean>(false);
  const [blocksData, setBlocksData] = useState<BlockData[]>(ACTIVE_TARGET_BLOCKS);
  const [dataSourceInfo, setDataSourceInfo] = useState<{ source: string; isDemonstration: boolean; errorMessage?: string }>({
    source: 'nationwide_empirical',
    isDemonstration: false
  });
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [rawObservations, setRawObservations] = useState<RawObservation[]>([]);
  const [obsSource, setObsSource] = useState<'db' | 'local_archive' | 'none'>('none');
  const [isTimeSeriesLoading, setIsTimeSeriesLoading] = useState<boolean>(true);
  const [forecastData, setForecastData] = useState<any>(null);
  const [isForecastLoading, setIsForecastLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load full verified telemetry stations catalog on mount
  useEffect(() => {
    let active = true;
    async function loadTelemetryCatalog() {
      try {
        const res = await fetch('/api/telemetry-observations?stations=true');
        if (res.ok && active) {
          const json = await res.json();
          if (json.status === 'available' && Array.isArray(json.stations)) {
            setTelemetryStationsList(json.stations);
          }
        }
      } catch (err) {
        console.warn('Failed to load telemetry station catalog:', err);
      }
    }
    loadTelemetryCatalog();
    return () => { active = false; };
  }, []);

  // Load available administrative units and merge with nationwide catalog
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const res = await fetch('/api/geospatial/blocks');
        if (res.ok && active) {
          const json = await res.json();
          if (json.blocks && Array.isArray(json.blocks)) {
            const merged = mergeWithLiveBlocks(json.blocks);
            setBlocksData(merged);
            setDataSourceInfo({
              source: json.source || 'nationwide_empirical',
              isDemonstration: json.isDemonstrationData ?? false,
              errorMessage: json.errorMessage
            });
            if (merged.length > 0) {
              if (urlBlockParam && merged.some((b: BlockData) => b.id === urlBlockParam)) {
                setSelectedBlockId(urlBlockParam);
                const target = merged.find((b: BlockData) => b.id === urlBlockParam);
                if (target) {
                  setSelectedState(target.state);
                  setSelectedDistrictId(target.districtId);
                }
              } else if (!selectedBlockId) {
                // Default to very first alphabetical state, district, and block
                setSelectedState(initialFirstState);
                if (initialFirstDistrict) {
                  setSelectedDistrictId(initialFirstDistrict.id);
                }
                if (initialFirstBlock) {
                  setSelectedBlockId(initialFirstBlock.id);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch geospatial data for monitoring:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [urlBlockParam]);

  // Derived filtered districts (Sorted alphabetically A-Z)
  const availableDistricts = useMemo(() => {
    const list = selectedState === 'all'
      ? ACTIVE_TARGET_DISTRICTS
      : ACTIVE_TARGET_DISTRICTS.filter(d => normalizeStateName(d.state) === selectedState);
    return sortDistrictsAlphabetically(list);
  }, [selectedState]);

  // Derived filtered blocks (Sorted alphabetically A-Z within hierarchy)
  const filteredBlocks = useMemo(() => {
    const list = blocksData.filter(b => {
      const matchState = selectedState === 'all'
        ? isTargetState(b.state)
        : normalizeStateName(b.state) === selectedState;
      const matchDistrict = selectedDistrictId === 'all' || b.districtId === selectedDistrictId;
      return matchState && matchDistrict;
    });
    return selectedDistrictId === 'all' ? sortBlocksHierarchy(list) : sortBlocksByName(list);
  }, [blocksData, selectedState, selectedDistrictId]);

  // Handle State change: cascade auto-select first alphabetical district and block
  const handleStateChange = (stateName: string) => {
    setSelectedState(stateName);
    if (stateName === 'all') {
      setSelectedDistrictId('all');
      setSelectedBlockId('');
      return;
    }
    const dists = sortDistrictsAlphabetically(
      ACTIVE_TARGET_DISTRICTS.filter(d => normalizeStateName(d.state) === stateName)
    );
    if (dists.length > 0) {
      const firstDist = dists[0];
      setSelectedDistrictId(firstDist.id);
      const blks = sortBlocksByName(
        blocksData.filter(b => normalizeStateName(b.state) === stateName && b.districtId === firstDist.id)
      );
      if (blks.length > 0) {
        setSelectedBlockId(blks[0].id);
      } else {
        setSelectedBlockId('');
      }
    } else {
      setSelectedDistrictId('all');
      setSelectedBlockId('');
    }
  };

  // Handle District change: cascade auto-select first alphabetical block
  const handleDistrictChange = (distId: string) => {
    setSelectedDistrictId(distId);
    if (distId === 'all') {
      const blks = sortBlocksHierarchy(
        blocksData.filter(b => selectedState === 'all' ? isTargetState(b.state) : normalizeStateName(b.state) === selectedState)
      );
      if (blks.length > 0) {
        setSelectedBlockId(blks[0].id);
      } else {
        setSelectedBlockId('');
      }
      return;
    }
    const blks = sortBlocksByName(
      blocksData.filter(b => b.districtId === distId)
    );
    if (blks.length > 0) {
      setSelectedBlockId(blks[0].id);
    } else {
      setSelectedBlockId('');
    }
  };

  // Derived telemetry stations matching selected state and district
  const availableTelemetryStations = useMemo(() => {
    return telemetryStationsList.filter((stn) => {
      const matchState = selectedState === 'all' || stn.state.toLowerCase() === selectedState.toLowerCase();
      const matchDistrict = selectedDistrictId === 'all' || (() => {
        const dObj = availableDistricts.find(d => d.id === selectedDistrictId);
        return dObj ? stn.district.toLowerCase() === dObj.name.toLowerCase() : false;
      })();
      return matchState && matchDistrict;
    }).sort((a, b) => a.stationName.localeCompare(b.stationName));
  }, [telemetryStationsList, selectedState, selectedDistrictId, availableDistricts]);

  // Synchronize selected telemetry station when available stations change
  useEffect(() => {
    if (availableTelemetryStations.length > 0) {
      if (!selectedTelemetryStationId || !availableTelemetryStations.some(s => s.stationId === selectedTelemetryStationId)) {
        setSelectedTelemetryStationId(availableTelemetryStations[0].stationId);
      }
    } else {
      setSelectedTelemetryStationId('');
    }
  }, [availableTelemetryStations, selectedTelemetryStationId]);

  // Load telemetry observations for selected telemetry station
  useEffect(() => {
    if (!selectedTelemetryStationId) {
      setTelemetryRawObservations([]);
      setTelemetryMetadata(null);
      setTelemetryStationForecast(null);
      return;
    }

    let active = true;
    setIsTelemetryLoading(true);

    async function fetchTelemetry() {
      try {
        const res = await fetch(`/api/telemetry-observations?stationId=${encodeURIComponent(selectedTelemetryStationId)}&limit=1500`);
        if (res.ok && active) {
          const json = await res.json();
          if (json.status === 'available' && Array.isArray(json.observations)) {
            setTelemetryRawObservations(json.observations);
            setTelemetryMetadata({
              stationName: json.stationName,
              state: json.state,
              district: json.district,
              earliestDate: json.earliestDate,
              latestDate: json.latestDate,
              totalObservations: json.totalObservations,
              sourceFiles: json.sourceFiles,
              provenance: json.provenance,
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load station telemetry:', err);
      } finally {
        if (active) setIsTelemetryLoading(false);
      }
    }

    async function fetchForecasts() {
      try {
        const res90 = await fetch(`/api/station-forecast?stationId=${encodeURIComponent(selectedTelemetryStationId)}&horizonDays=90`);
        const res180 = await fetch(`/api/station-forecast?stationId=${encodeURIComponent(selectedTelemetryStationId)}&horizonDays=180`);
        const data90 = res90.ok ? await res90.json() : null;
        const data180 = res180.ok ? await res180.json() : null;
        if (active) {
          setTelemetryStationForecast({
            fc90: data90?.status === 'experimental' ? data90 : null,
            fc180: data180?.status === 'experimental' ? data180 : null,
          });
        }
      } catch {
        if (active) setTelemetryStationForecast(null);
      }
    }

    fetchTelemetry();
    fetchForecasts();

    return () => { active = false; };
  }, [selectedTelemetryStationId]);

  // Load genuine CGWB historical observations for this block
  useEffect(() => {
    if (!selectedBlockId) return;
    let active = true;
    // Clear stale chart state immediately when selected block changes
    setHistoricalData([]);
    setRawObservations([]);
    setSelectedStationId('all');
    setForecastData(null);
    setIsTimeSeriesLoading(true);
    setIsForecastLoading(true);
    setObsSource('none');

    async function loadTimeSeries() {
      try {
        const res = await fetch(`/api/historical-observations?block=${encodeURIComponent(selectedBlockId)}&limit=100`);
        if (res.ok) {
          const json = await res.json();
          if (active && json.observations && Array.isArray(json.observations) && json.observations.length > 0) {
            setRawObservations(json.observations);
            // Group by observation date and average water levels across stations in this block
            const dateMap = new Map<string, { sum: number; count: number; date: string }>();
            for (const obs of json.observations) {
              if (obs.water_level_mbgl !== null && !isNaN(obs.water_level_mbgl)) {
                const existing = dateMap.get(obs.observation_date) || { sum: 0, count: 0, date: obs.observation_date };
                existing.sum += obs.water_level_mbgl;
                existing.count += 1;
                dateMap.set(obs.observation_date, existing);
              }
            }

            const chartPoints: HistoricalPoint[] = Array.from(dateMap.values())
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((item) => ({
                month: item.date,
                wellDepth: Number((item.sum / item.count).toFixed(2)),
              }));

            if (active) {
              setHistoricalData(chartPoints);
              setObsSource((json.source === 'local_verified_cgwb_archive' || json.source === 'local_processed_observation_archive') ? 'local_archive' : 'db');
            }
            return;
          }
        }
      } catch {
        // Query failed: fail closed
      }

      if (active) {
        setHistoricalData([]);
        setRawObservations([]);
        setObsSource('none');
        setIsTimeSeriesLoading(false);
      }
    }

    async function loadForecast() {
      try {
        const endpoint = `/api/forecast?block=${encodeURIComponent(selectedBlockId)}`;
        const res = await fetch(endpoint);
        if (res.ok && active) {
          const json = await res.json();
          setForecastData(json);
        } else if (active) {
          setForecastData(null);
        }
      } catch {
        if (active) setForecastData(null);
      } finally {
        if (active) setIsForecastLoading(false);
      }
    }

    loadTimeSeries().finally(() => {
      if (active) setIsTimeSeriesLoading(false);
    });
    loadForecast();

    return () => {
      active = false;
    };
  }, [selectedBlockId]);

  useEffect(() => {
    if (urlBlockParam && blocksData.length > 0) {
      const validBlock = blocksData.find(b => b.id === urlBlockParam);
      if (validBlock) {
        setSelectedBlockId(validBlock.id);
        setSelectedState(validBlock.state);
        setSelectedDistrictId(validBlock.districtId);
      }
    }
  }, [urlBlockParam, blocksData]);

interface CombinedChartPoint {
  month: string;
  wellDepth: number | null;
  modelDepth: number | null;
  lowerBoundP10: number | null;
  upperBoundP90: number | null;
  graceTwsa: number | null;
  isForecast?: boolean;
}

interface RainfallChartPoint {
  period: string;
  date: string;
  observedMm: number;
  normalLpaMm: number;
  deviationMm: number;
  spi3Month: number | null;
}

  const selectedBlock = blocksData.find(b => b.id === selectedBlockId) || null;

  const combinedChartData = useMemo(() => {
    const points: CombinedChartPoint[] = historicalData.map((d) => ({
      month: d.month,
      wellDepth: d.wellDepth,
      modelDepth: null,
      lowerBoundP10: null,
      upperBoundP90: null,
      graceTwsa: null,
      isForecast: false,
    }));

    // Align satellite-derived water storage (GRACE-FO TWSA cm) against its actual assessed date
    if (selectedBlock?.indicators.graceTwsaCm !== null && selectedBlock?.indicators.graceTwsaCm !== undefined && selectedBlock.indicators.lastUpdatedDate) {
      const assessmentDate = selectedBlock.indicators.lastUpdatedDate;
      const existing = points.find(p => p.month === assessmentDate);
      if (existing) {
        existing.graceTwsa = selectedBlock.indicators.graceTwsaCm;
      } else {
        points.push({
          month: assessmentDate,
          wellDepth: selectedBlock.indicators.cgwbWellDepthMbgl ?? null,
          modelDepth: null,
          lowerBoundP10: null,
          upperBoundP90: null,
          graceTwsa: selectedBlock.indicators.graceTwsaCm,
          isForecast: false,
        });
        points.sort((a, b) => a.month.localeCompare(b.month));
      }
    }

    if (forecastData?.forecasts && Array.isArray(forecastData.forecasts) && forecastData.forecasts.length > 0) {
      if (points.length > 0) {
        const last = points[points.length - 1];
        last.modelDepth = last.wellDepth;
        last.lowerBoundP10 = last.wellDepth;
        last.upperBoundP90 = last.wellDepth;
      }

      forecastData.forecasts.forEach((fc: any) => {
        points.push({
          month: fc.targetDate || fc.targetSeason,
          wellDepth: null,
          modelDepth: fc.expectedDepthMbgl ?? null,
          lowerBoundP10: fc.uncertaintyInterval?.lowerBoundP10Mbgl ?? null,
          upperBoundP90: fc.uncertaintyInterval?.upperBoundP90Mbgl ?? null,
          graceTwsa: null,
          isForecast: true,
        });
      });
    }

    return points;
  }, [historicalData, forecastData, selectedBlock]);

  // Derived available monitoring stations within the current block
  const availableStations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const obs of rawObservations) {
      if (!obs.station_id) continue;
      const existing = map.get(obs.station_id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(obs.station_id, {
          id: obs.station_id,
          name: obs.station_name || obs.station_id,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [rawObservations]);

  // Active dataset for Chart 1 based on selected source (Telemetry vs CGWB Manual)
  const activeObservationSeries = useMemo(() => {
    if (selectedDataSource === 'telemetry') {
      return telemetryRawObservations;
    }
    return rawObservations;
  }, [selectedDataSource, telemetryRawObservations, rawObservations]);

  // Trend Chart Time Series (2021–2026), linear regression, summary metrics, and forecast targets
  const trendAnalysisData = useMemo(() => {
    const isTelemetry = selectedDataSource === 'telemetry';
    const sourceObservations = isTelemetry ? telemetryRawObservations : rawObservations;
    
    // 1. Filter observations by selected station (or block-average if 'all')
    const filtered = sourceObservations.filter((obs) => {
      if (obs.water_level_mbgl === null || isNaN(obs.water_level_mbgl)) return false;
      if (!obs.observation_date || obs.observation_date < '2021-01-01' || obs.observation_date > '2026-12-31') return false;
      if (!isTelemetry && selectedStationId !== 'all' && obs.station_id !== selectedStationId) return false;
      return true;
    });

    // 2. Group by date
    const dateMap = new Map<string, { sum: number; count: number; date: string }>();
    for (const obs of filtered) {
      const existing = dateMap.get(obs.observation_date) || { sum: 0, count: 0, date: obs.observation_date };
      existing.sum += obs.water_level_mbgl!;
      existing.count += 1;
      dateMap.set(obs.observation_date, existing);
    }

    const sortedObs = Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        date: item.date,
        depthMbgl: Number((item.sum / item.count).toFixed(2)),
      }));

    // 3. Compute Summary Metrics (net change, annualized rate)
    const validCount = sortedObs.length;
    const firstObs = validCount > 0 ? sortedObs[0] : null;
    const lastObs = validCount > 0 ? sortedObs[validCount - 1] : null;
    const netChangeM = firstObs && lastObs ? Number((lastObs.depthMbgl - firstObs.depthMbgl).toFixed(2)) : null;

    let annualizedRateM: number | null = null;
    let spanYears = 0;
    if (firstObs && lastObs && firstObs.date !== lastObs.date) {
      const msDiff = Date.parse(lastObs.date) - Date.parse(firstObs.date);
      spanYears = msDiff / (365.25 * 24 * 3600 * 1000);
      if (spanYears >= 0.5) {
        annualizedRateM = Number((netChangeM! / spanYears).toFixed(2));
      }
    }

    // 4. Ordinary Least Squares (OLS) Linear Trend Line (only when >= 3 points across >= 6 months)
    let slope = 0;
    let intercept = 0;
    const canComputeTrend = validCount >= 3 && spanYears >= 0.5;
    if (canComputeTrend) {
      const t0 = Date.parse(firstObs!.date);
      const points = sortedObs.map((o) => ({
        t: (Date.parse(o.date) - t0) / (365.25 * 24 * 3600 * 1000), // years from t0
        y: o.depthMbgl,
      }));
      const n = points.length;
      let sumT = 0;
      let sumY = 0;
      let sumTY = 0;
      let sumT2 = 0;
      for (const p of points) {
        sumT += p.t;
        sumY += p.y;
        sumTY += p.t * p.y;
        sumT2 += p.t * p.t;
      }
      const denom = n * sumT2 - sumT * sumT;
      if (Math.abs(denom) > 1e-9) {
        slope = (n * sumTY - sumT * sumY) / denom;
        intercept = (sumY - slope * sumT) / n;
      }
    }

    // 5. Build Unified Time Series Chart Points
    interface TrendChartPoint {
      date: string;
      observedDepth: number | null;
      trendLine: number | null;
      p10Depth: number | null;
      forecastDepth: number | null;
      p90Depth: number | null;
      isForecastPoint?: boolean;
      tooltipLabel?: string;
    }

    const t0 = firstObs ? Date.parse(firstObs.date) : 0;
    const chartPoints: TrendChartPoint[] = sortedObs.map((o) => {
      let trendVal: number | null = null;
      if (canComputeTrend) {
        const tYear = (Date.parse(o.date) - t0) / (365.25 * 24 * 3600 * 1000);
        trendVal = Number((intercept + slope * tYear).toFixed(2));
      }
      return {
        date: o.date,
        observedDepth: o.depthMbgl,
        trendLine: trendVal,
        p10Depth: null,
        forecastDepth: null,
        p90Depth: null,
        isForecastPoint: false,
      };
    });

    // 6. Integrate Forecast 90-day and 180-day target points (isolated points, no fabricated interpolation)
    if (isTelemetry && telemetryStationForecast) {
      if (telemetryStationForecast.fc90?.prediction) {
        const p = telemetryStationForecast.fc90.prediction;
        chartPoints.push({
          date: telemetryStationForecast.fc90.targetDate,
          observedDepth: null,
          trendLine: null,
          p10Depth: p.p10,
          forecastDepth: p.p50,
          p90Depth: p.p90,
          isForecastPoint: true,
          tooltipLabel: '90-Day Telemetry Target (Experimental)',
        });
      }
      if (telemetryStationForecast.fc180?.prediction) {
        const p = telemetryStationForecast.fc180.prediction;
        chartPoints.push({
          date: telemetryStationForecast.fc180.targetDate,
          observedDepth: null,
          trendLine: null,
          p10Depth: p.p10,
          forecastDepth: p.p50,
          p90Depth: p.p90,
          isForecastPoint: true,
          tooltipLabel: '180-Day Telemetry Target (Experimental)',
        });
      }
    } else if (!isTelemetry && forecastData?.forecasts && Array.isArray(forecastData.forecasts)) {
      for (const fc of forecastData.forecasts) {
        const horizonDays = fc.forecastHorizonDays ?? (fc.forecastHorizonMonths ? fc.forecastHorizonMonths * 30 : (fc.horizonQuarter * 90));
        if (horizonDays === 90 || horizonDays === 180) {
          const targetDate = fc.targetDate || fc.targetSeason;
          chartPoints.push({
            date: targetDate,
            observedDepth: null,
            trendLine: null,
            p10Depth: fc.uncertaintyInterval?.lowerBoundP10Mbgl ?? null,
            forecastDepth: fc.expectedDepthMbgl ?? null,
            p90Depth: fc.uncertaintyInterval?.upperBoundP90Mbgl ?? null,
            isForecastPoint: true,
            tooltipLabel: `${horizonDays}-Day Target (${fc.targetSeason})`,
          });
        }
      }
    }

    // Sort all points chronologically
    chartPoints.sort((a, b) => a.date.localeCompare(b.date));

    return {
      chartPoints,
      validCount,
      firstObs,
      lastObs,
      netChangeM,
      annualizedRateM,
      spanYears,
      canComputeTrend,
      slope,
    };
  }, [rawObservations, selectedStationId, forecastData, selectedDataSource, telemetryRawObservations, telemetryStationForecast]);

  // Seasonal Monsoon Rainfall & Deviation aligned by date and LPA baseline
  const rainfallChartData = useMemo<RainfallChartPoint[]>(() => {
    if (!selectedBlock || selectedBlock.indicators.rainfallAnomalyMm === null || selectedBlock.indicators.rainfallAnomalyMm === undefined) {
      return [];
    }

    // Official IMD 30-year Long Period Average (LPA, 1991–2020) for monsoon season (JJAS) by state
    const lpaByState: Record<string, number> = {
      'Karnataka': 860,
      'Telangana': 750,
      'Tamil Nadu': 440,
      'Madhya Pradesh': 850,
      'Rajasthan': 420,
      'Haryana': 450,
      'Punjab': 480,
      'Meghalaya': 2500,
      'Tripura': 1400,
    };

    const lpa = lpaByState[selectedBlock.state] || 800;
    const anomaly = selectedBlock.indicators.rainfallAnomalyMm;
    const observedTotal = Math.max(0, Number((lpa + anomaly).toFixed(1)));
    const date = selectedBlock.indicators.lastUpdatedDate || '2024-09-30';
    const year = date.split('-')[0] || '2024';

    return [
      {
        period: `Monsoon ${year}`,
        date,
        observedMm: observedTotal,
        normalLpaMm: lpa,
        deviationMm: anomaly,
        spi3Month: selectedBlock.indicators.spi3Month,
      }
    ];
  }, [selectedBlock]);

  const fmtVal = (val: number | null, unit: string) => (val === null ? t('monitoring.noData', 'No Data') : `${val} ${unit}`);

  return (
    <div className="space-y-8">
      {/* Header - Open Editorial Style */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
            {t('monitoring.title', 'Groundwater Monitoring & Trends')}*
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1.5 leading-relaxed">
            {t('monitoring.subtitle', 'Track verified groundwater telemetry and multi-source hydrological indicators.')}
          </p>
        </div>

        {/* Nationwide Cascading Selector (State -> District -> Block) */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* State */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted font-medium">State:</span>
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="bg-subtle border border-border rounded px-2.5 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer"
            >
              <option value="all">All 9 Active States</option>
              {getTargetStatesAlphabetically().map((st) => (
                <option key={st.code} value={st.name}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* District */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted font-medium">District:</span>
            <select
              value={selectedDistrictId}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="bg-subtle border border-border rounded px-2.5 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer"
            >
              <option value="all">
                {selectedState === 'all'
                  ? `All Districts (${availableDistricts.length})`
                  : `All in ${selectedState} (${availableDistricts.length})`}
              </option>
              {availableDistricts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {selectedState === 'all' ? `(${d.state})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Block */}
          <div className="flex items-center gap-1.5">
            <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
            <span className="font-semibold text-text-main">{t('monitoring.selectBlock', 'Block:')}</span>
            {isLoading ? (
              <div className="h-8 w-36 bg-subtle rounded animate-pulse"></div>
            ) : filteredBlocks.length > 0 ? (
              <select
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="bg-subtle border border-border rounded px-3 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer max-w-[200px]"
              >
                <option value="">Select a block...</option>
                {filteredBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.districtName}) — {b.riskSeverity.toUpperCase()}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-text-muted italic">No blocks</span>
            )}
          </div>
        </div>
      </div>

      {dataSourceInfo.errorMessage && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900">
          <strong>Data Access Notice:</strong> {dataSourceInfo.errorMessage}
        </div>
      )}

      {/* Informational Guidance Strip (Editorial Bar) */}
      <div className="border-l-2 border-primary bg-subtle px-4 py-2.5 text-xs text-text-muted flex items-center justify-between">
        <div className="flex items-center gap-2">
          <InfoIcon className="w-4 h-4 text-primary shrink-0" />
          <span>Multi-Scale Indicators: Evaluating observed CGWB well depths alongside satellite mass anomalies (GRACE-FO).</span>
        </div>
        {selectedBlock && (
          <span className="font-semibold text-text-main hidden sm:inline">{selectedBlock.name} ({selectedBlock.districtName})</span>
        )}
      </div>

      {!selectedBlock ? (
        <div className="p-12 text-center bg-subtle border border-border rounded space-y-3">
          <div className="w-10 h-10 mx-auto text-primary flex items-center justify-center bg-surface border border-border rounded-full">
            <FilterIcon className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-text-main">
            Select a district and block to view location-specific data
          </h2>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Choose a state, district, and block from the selectors above to inspect verified Central Ground Water Board observation wells, satellite water mass anomalies, and rainfall forecasts.
          </p>
        </div>
      ) : (
        <>
                    <div className="space-y-12">
            {/* 1. Groundwater Historical Trend & Forecast */}
            {/* Groundwater Historical Trend & Forecast Context (2021–2026) Module */}
      <div id="historical-trend-analysis" className="pt-8 border-t border-border space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <ActivityChartIcon className="w-4 h-4 text-primary" />
                1. Groundwater Historical Trend &amp; Forecast Context (2021–2026)
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-subtle border border-border text-text-muted">
                Observed Depth &amp; Empirical Projection
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Evaluates groundwater depth records across the 2021–2026 monitoring window. Distinguishes verified in-situ observation history from statistical trend estimation and genuine 90-day / 180-day ML projections.
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              <strong>Groundwater Depth Interpretation:</strong> Measured in metres below ground level (<span className="font-mono">m bgl</span>). A higher value indicates the water table has deepened further underground; a lower value indicates the water table has risen closer to the ground surface.
            </p>
          </div>

          {/* Dual Source & Station Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-auto">
            {/* Primary Source Toggle (Automated Telemetry vs CGWB Manual) */}
            <div className="flex items-center bg-subtle border border-border rounded p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDataSource('telemetry')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  selectedDataSource === 'telemetry'
                    ? 'bg-surface text-text-main shadow-xs font-semibold'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Automated Telemetry (18 Datasets)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDataSource('cgwb_manual')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  selectedDataSource === 'cgwb_manual'
                    ? 'bg-surface text-text-main shadow-xs font-semibold'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                CGWB Manual Archive
              </button>
            </div>

            {/* Station Dropdown based on Active Source */}
            {selectedDataSource === 'telemetry' ? (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-text-muted font-medium">DWLR Station:</span>
                <select
                  value={selectedTelemetryStationId}
                  onChange={(e) => setSelectedTelemetryStationId(e.target.value)}
                  className="bg-subtle border border-border rounded px-2.5 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer max-w-[240px]"
                >
                  {availableTelemetryStations.length > 0 ? (
                    availableTelemetryStations.map((stn) => (
                      <option key={stn.stationId} value={stn.stationId}>
                        {stn.stationName} ({stn.district}) — {stn.observationCount} obs (to {stn.latestDate})
                      </option>
                    ))
                  ) : (
                    <option value="">No telemetry stations in this geography</option>
                  )}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-text-muted font-medium">CGWB Well:</span>
                <select
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="bg-subtle border border-border rounded px-2.5 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer max-w-[200px]"
                >
                  <option value="all">
                    Block Aggregation ({availableStations.length} {availableStations.length === 1 ? 'Station' : 'Stations'})
                  </option>
                  {availableStations.map((stn) => (
                    <option key={stn.id} value={stn.id}>
                      {stn.name} ({stn.count} {stn.count === 1 ? 'obs' : 'obs'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

                {/* Source & Provenance Metadata Strip */}
        <div className="p-3 bg-subtle border border-border rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text-main">
              {selectedDataSource === 'telemetry'
                ? `Source: NWDP Automated DWLR Telemetry (${telemetryMetadata?.sourceFiles?.join(', ') || '18 Verified Raw Datasets: 2021–2025 & 2026–2030'})`
                : 'Source: Central Ground Water Board (CGWB) Manual Quarterly Survey Archive'}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-border bg-surface text-text-main">
              {selectedDataSource === 'telemetry' ? '6-Hourly Median Aggregation' : 'Quarterly Field Dips'}
            </span>
            {selectedDataSource === 'telemetry' && telemetryMetadata?.latestDate && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-300">
                ACTIVE DATA THROUGH {telemetryMetadata.latestDate}
              </span>
            )}
          </div>
          <div className="text-[11px] text-text-muted">
            {selectedDataSource === 'telemetry'
              ? `${trendAnalysisData.validCount} automated daily observations recorded`
              : `${trendAnalysisData.validCount} quarterly manual records recorded`}
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border border border-border bg-surface text-center text-xs">
          <div className="p-3">
            <span className="text-[10px] text-text-muted font-semibold block uppercase">Earliest Record</span>
            <span className="text-sm font-bold text-text-main">
              {trendAnalysisData.firstObs ? `${trendAnalysisData.firstObs.depthMbgl} m bgl` : '—'}
            </span>
            <span className="block text-[10px] text-text-muted mt-0.5">
              {trendAnalysisData.firstObs?.date || 'No observations'}
            </span>
          </div>

          <div className="p-3">
            <span className="text-[10px] text-text-muted font-semibold block uppercase">Latest Record</span>
            <span className="text-sm font-bold text-text-main">
              {trendAnalysisData.lastObs ? `${trendAnalysisData.lastObs.depthMbgl} m bgl` : '—'}
            </span>
            <span className="block text-[10px] text-text-muted mt-0.5">
              {trendAnalysisData.lastObs?.date || 'No observations'}
            </span>
          </div>

          <div className="p-3">
            <span className="text-[10px] text-text-muted font-semibold block uppercase">Observed Net Change</span>
            <span className={`text-sm font-bold ${
              trendAnalysisData.netChangeM === null ? 'text-text-main' : trendAnalysisData.netChangeM > 0 ? 'text-red-700' : trendAnalysisData.netChangeM < 0 ? 'text-emerald-700' : 'text-text-main'
            }`}>
              {trendAnalysisData.netChangeM !== null
                ? `${trendAnalysisData.netChangeM > 0 ? '+' : ''}${trendAnalysisData.netChangeM} m`
                : '—'}
            </span>
            <span className="block text-[10px] text-text-muted mt-0.5">
              {trendAnalysisData.netChangeM !== null
                ? (trendAnalysisData.netChangeM > 0 ? 'Water table deepened' : trendAnalysisData.netChangeM < 0 ? 'Water table rose' : 'No net change')
                : 'Insufficient span'}
            </span>
          </div>

          <div className="p-3">
            <span className="text-[10px] text-text-muted font-semibold block uppercase">Annualized Rate &amp; Data Span</span>
            <span className={`text-sm font-bold ${
              trendAnalysisData.annualizedRateM === null ? 'text-text-main' : trendAnalysisData.annualizedRateM > 0 ? 'text-red-700' : trendAnalysisData.annualizedRateM < 0 ? 'text-emerald-700' : 'text-text-main'
            }`}>
              {trendAnalysisData.annualizedRateM !== null
                ? `${trendAnalysisData.annualizedRateM > 0 ? '+' : ''}${trendAnalysisData.annualizedRateM} m/yr`
                : '—'}
            </span>
            <span className="block text-[10px] text-text-muted mt-0.5">
              {trendAnalysisData.validCount} valid {trendAnalysisData.validCount === 1 ? 'obs' : 'obs'} ({trendAnalysisData.spanYears.toFixed(1)} yrs)
            </span>
          </div>
        </div>

        {/* Trend Warning / Notice banner */}
        {!trendAnalysisData.canComputeTrend && (
          <div className="p-3 bg-subtle border-l-2 border-primary/60 text-xs text-text-muted flex items-start gap-2">
            <InfoIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Trend Estimation Limitation:</strong> Statistical regression trend lines require at least 3 valid observations spanning 6 months or more. Available points are displayed without an artificial trend curve.
            </span>
          </div>
        )}

        {/* Interactive Time Series Chart */}
        <div className="h-80 w-full">
          {isTimeSeriesLoading ? (
            <div className="h-full w-full bg-subtle/40 flex items-center justify-center animate-pulse">
              <span className="text-xs text-text-muted">Loading 2021–2026 historical records...</span>
            </div>
          ) : trendAnalysisData.chartPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendAnalysisData.chartPoints} margin={{ top: 15, right: 25, left: -5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_COLORS.axisText }} />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                  label={{ value: 'Well Depth (m bgl)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: CHART_COLORS.axisText }, offset: 15 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0]?.payload;
                    return (
                      <div className="bg-surface border border-border p-2.5 rounded shadow-sm text-xs space-y-1">
                        <div className="font-bold text-text-main border-b border-border/60 pb-1">
                          Date: {label}
                        </div>
                        {pt.observedDepth !== null && (
                          <div className="text-text-main flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.wellDepth }} />
                              Observed Depth:
                            </span>
                            <span className="font-mono font-bold">{pt.observedDepth} m bgl</span>
                          </div>
                        )}
                        {pt.trendLine !== null && (
                          <div className="text-text-muted flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.statisticalTrend }} />
                              Statistical Trend:
                            </span>
                            <span className="font-mono">{pt.trendLine} m bgl</span>
                          </div>
                        )}
                        {pt.forecastDepth !== null && (
                          <div className="text-red-700 flex items-center justify-between gap-3 border-t border-border/40 pt-1">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.forecastProjection }} />
                              {pt.tooltipLabel || 'ML Projection'}:
                            </span>
                            <span className="font-mono font-bold">{pt.forecastDepth} m bgl</span>
                          </div>
                        )}
                        {pt.p10Depth !== null && pt.p90Depth !== null && (
                          <div className="text-[10px] text-text-muted flex justify-between gap-2">
                            <span>P10–P90 Range:</span>
                            <span className="font-mono">[{pt.p10Depth} – {pt.p90Depth}] m bgl</span>
                          </div>
                        )}
                        {pt.isForecastPoint && (
                          <div className="text-[10px] text-amber-800 pt-0.5 border-t border-border/40">
                            Model: {forecastData?.modelIdentifier || 'GlobalBlockAwareQuantileGB-v1'} (Retrospective)
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />

                {/* 1. Historical Observed Well Depths */}
                <Line
                  type="monotone"
                  dataKey="observedDepth"
                  name="Verified Observed Depth (m bgl)"
                  stroke={CHART_COLORS.wellDepth}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CHART_COLORS.wellDepth }}
                  connectNulls={false}
                />

                {/* 2. Statistical Trend Line (Linear Regression) */}
                {trendAnalysisData.canComputeTrend && (
                  <Line
                    type="linear"
                    dataKey="trendLine"
                    name="Statistical Historical Trend (m bgl)"
                    stroke={CHART_COLORS.statisticalTrend}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls={true}
                  />
                )}

                {/* 3. Real 90d/180d Forecast Target Points (isolated, visually distinct from history) */}
                <Line
                  type="monotone"
                  dataKey="forecastDepth"
                  name="ML Forecast Target [90d & 180d] (m bgl)"
                  stroke={CHART_COLORS.forecastProjection}
                  strokeWidth={0}
                  dot={{ r: 6, fill: CHART_COLORS.forecastProjection, stroke: CHART_COLORS.tooltipBg, strokeWidth: 1.5 }}
                  connectNulls={false}
                />

                {/* 4. P10 & P90 Uncertainty Interval bounds */}
                <Line
                  type="monotone"
                  dataKey="p10Depth"
                  name="P10 Lower Bound (m bgl)"
                  stroke={CHART_COLORS.forecastProjection}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={{ r: 3, fill: CHART_COLORS.forecastProjection }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="p90Depth"
                  name="P90 Upper Bound (m bgl)"
                  stroke={CHART_COLORS.forecastProjection}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={{ r: 3, fill: CHART_COLORS.forecastProjection }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full bg-subtle/30 border border-dashed border-border flex flex-col items-center justify-center p-6 text-center space-y-2">
              <ActivityChartIcon className="w-8 h-8 text-text-muted/60" />
              <p className="text-xs font-semibold text-text-main">No Observations Available for Selected Filter</p>
              <p className="text-[11px] text-text-muted max-w-xs">
                No verified records were found for the selected geographic unit within the 2021–2026 monitoring window.
              </p>
            </div>
          )}
        </div>

        {/* Plain-Language Observed Trend Interpretation */}
        <div className="bg-subtle/70 border border-border/80 rounded p-3 text-xs space-y-1">
          <span className="font-semibold text-text-main flex items-center gap-1.5">
            <InfoIcon className="w-3.5 h-3.5 text-primary" /> Plain-Language Interpretation:
          </span>
          <p className="text-text-muted leading-relaxed">
            {(() => {
              if (trendAnalysisData.validCount === 0) {
                return 'No historical observations are currently recorded for this filter in the 2021–2026 monitoring window.';
              }
              if (trendAnalysisData.validCount === 1) {
                return `A single observation of ${trendAnalysisData.firstObs?.depthMbgl} m bgl is recorded on ${trendAnalysisData.firstObs?.date}. Single-point observations describe a point-in-time water level and cannot be interpreted as a multi-year trajectory.`;
              }
              const net = trendAnalysisData.netChangeM!;
              const dir = net > 0.5 ? 'deepened significantly (aquifer depletion)' : net < -0.5 ? 'risen closer to the surface (recharge)' : 'remained relatively steady';
              const annualizedText = trendAnalysisData.annualizedRateM !== null
                ? ` with an average annualized change rate of ${trendAnalysisData.annualizedRateM > 0 ? '+' : ''}${trendAnalysisData.annualizedRateM} m/year`
                : '';
              const forecastNote = forecastData?.forecasts && forecastData.forecasts.length > 0
                ? ` The ML model projects the next 90-day target at ${forecastData.forecasts[0]?.expectedDepthMbgl ?? '—'} m bgl and 180-day target at ${forecastData.forecasts[1]?.expectedDepthMbgl ?? '—'} m bgl relative to the origin date (${forecastData.latestObservationDate || 'verified record'}).`
                : ' Forward forecast targets are currently unavailable for this unit.';
              return `Between ${trendAnalysisData.firstObs?.date} and ${trendAnalysisData.lastObs?.date}, the monitored groundwater depth shifted from ${trendAnalysisData.firstObs?.depthMbgl} m bgl to ${trendAnalysisData.lastObs?.depthMbgl} m bgl (net change: ${net > 0 ? '+' : ''}${net} m). Across this time span, the water table has ${dir}${annualizedText}.${forecastNote}`;
            })()}
          </p>
        </div>
      </div>

            <div className="border-t border-border pt-4" />

            {/* 2. IMD Rainfall Trends & Annual Differences */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <CloudRainIcon className="w-4 h-4 text-amber-600" /> {t('monitoring.seasonalRainfallTitle', '2. IMD Rainfall Trends &amp; Annual Differences (mm)')}*
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Source: IMD Pune 0.25° Gridded Precipitation Product • Baseline: State 30-Year LPA Normal (1991–2020)
              </p>
              <div className="mt-1">
                <TermHelp termId="rainfall_anomaly" />
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                <strong>How to read:</strong> Compares total monsoon rain against the 30-year average. A negative deviation (red bar) means a rain deficit, reducing natural groundwater recharge.
              </p>
            </div>
            <span className="text-xs font-mono text-text-muted shrink-0">
              IMD Gridded • 30-Yr LPA Baseline
            </span>
          </div>

          <div className="h-72 w-full flex flex-col justify-center">
            {isLoading ? (
              <div className="h-full w-full bg-subtle/40 flex items-center justify-center animate-pulse">
                <span className="text-xs text-text-muted">Loading rainfall indicators...</span>
              </div>
            ) : rainfallChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rainfallChartData} margin={{ top: 15, right: 25, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: CHART_COLORS.axisText }} />
                  {/* Left Axis: Rainfall Total (mm) */}
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                    domain={[0, (dataMax: number) => Math.max(dataMax * 1.25, 1000)]}
                    label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: CHART_COLORS.axisText }, offset: 15 }}
                  />
                  {/* Right Axis: Deviation (mm) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                    domain={[(min: number) => Math.min(min * 1.25, -300), (max: number) => Math.max(max * 1.25, 100)]}
                    label={{ value: 'Deviation (mm)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 10, fill: CHART_COLORS.axisText }, offset: 15 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, borderColor: CHART_COLORS.tooltipBorder, fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine yAxisId="right" y={0} stroke={CHART_COLORS.referenceLine} strokeDasharray="3 3" />
                  <Bar
                    yAxisId="left"
                    dataKey="observedMm"
                    name="Observed Monsoon Total (mm)"
                    fill={CHART_COLORS.rainfallObserved}
                    barSize={40}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="normalLpaMm"
                    name="30-Yr Normal LPA (mm)"
                    fill={CHART_COLORS.rainfallBaseline}
                    barSize={40}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="deviationMm"
                    name="Deviation from LPA (mm)"
                    fill={deviationColor(rainfallChartData[0].deviationMm)}
                    barSize={30}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-subtle/30 border border-dashed border-border flex flex-col items-center justify-center p-6 text-center space-y-2">
                <CloudRainIcon className="w-8 h-8 text-text-muted/60" />
                <p className="text-xs font-semibold text-text-main">No Published IMD Gridded Rainfall Records Available</p>
                <p className="text-[11px] text-text-muted max-w-xs">
                  Gridded precipitation time series requires IMD spatial polygon aggregation (0.25° x 0.25°) which is currently unpopulated for this administrative unit.
                </p>
              </div>
            )}
          </div>

          {rainfallChartData.length > 0 && (
            <div className="grid grid-cols-3 divide-x divide-border border-y border-border py-3 text-center text-xs">
              <div className="px-2">
                <span className="text-[10px] text-text-muted font-semibold block uppercase">Estimated Total</span>
                <span className="text-base font-bold text-text-main">{rainfallChartData[0].observedMm} mm</span>
              </div>
              <div className="px-2">
                <span className="text-[10px] text-text-muted font-semibold block uppercase">30-Yr LPA Normal</span>
                <span className="text-base font-bold text-text-main">{rainfallChartData[0].normalLpaMm} mm</span>
              </div>
              <div className="px-2">
                <span className="text-[10px] text-text-muted font-semibold block uppercase">Stored Anomaly &amp; SPI</span>
                <span className={`text-base font-bold ${rainfallChartData[0].deviationMm < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {rainfallChartData[0].deviationMm > 0 ? '+' : ''}{rainfallChartData[0].deviationMm} mm
                  {selectedBlock?.indicators.spi3Month !== null && ` (SPI: ${selectedBlock?.indicators.spi3Month})`}
                </span>
              </div>
            </div>
          )}

          {rainfallChartData.length > 0 && (() => {
            const obsYear = Number(rainfallChartData[0].date.split('-')[0]);
            const isHistorical = obsYear < 2026;
            return isHistorical ? (
              <div className="p-2.5 bg-subtle border-l-2 border-primary/60 text-xs text-text-muted flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5">
                  <InfoIcon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Latest available data: {obsYear} ({rainfallChartData[0].period}):</strong> Official IMD gridded daily precipitation bundles for this block are archived through {rainfallChartData[0].date}. Direct daily raingauge records for post-{obsYear} are not published in the local archive; subsequent seasons are preserved as unmeasured data gaps.
                  </span>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-subtle border border-border text-text-muted shrink-0">
                  LATEST: {obsYear}
                </span>
              </div>
            ) : null;
          })()}

          <p className="text-xs text-text-muted">
            Monsoon rainfall indicators: The primary evidence is the stored block rainfall anomaly ({rainfallChartData[0]?.deviationMm !== undefined ? `${rainfallChartData[0].deviationMm > 0 ? '+' : ''}${rainfallChartData[0].deviationMm} mm` : 'N/A'}) compared against the state 30-year Long Period Average (LPA, 1991–2020) baseline of {rainfallChartData[0]?.normalLpaMm ?? 800} mm. Note: The &quot;Estimated Total&quot; ({rainfallChartData[0]?.observedMm ?? 'N/A'} mm) is derived by combining the state normal with the block anomaly; direct raingauge daily accumulation is aggregated separately.
          </p>

          {/* Plain-Language Citizen Takeaway for Chart 2 */}
          {rainfallChartData.length > 0 && (
            <div className="bg-subtle/70 border border-border/80 rounded p-3 text-xs space-y-1">
              <span className="font-semibold text-text-main flex items-center gap-1.5">
                <InfoIcon className="w-3.5 h-3.5 text-primary" /> Plain-Language Takeaway:
              </span>
              <p className="text-text-muted leading-relaxed">
                {(() => {
                  const pt = rainfallChartData[0];
                  const isDeficit = pt.deviationMm < 0;
                  const pct = Math.abs(Number(((pt.deviationMm / pt.normalLpaMm) * 100).toFixed(1)));
                  return `${selectedBlock?.name || 'This block'} received ${pt.observedMm} mm of monsoon rainfall compared to its 30-year normal of ${pt.normalLpaMm} mm (${pt.period}). This is a ${isDeficit ? `deficit of ${Math.abs(pt.deviationMm)} mm (${pct}% below normal)` : `surplus of ${pt.deviationMm} mm (${pct}% above normal)`}, meaning natural monsoon replenishment of the local aquifer was ${isDeficit ? 'substantially reduced' : 'favorable'} this season.`;
                })()}
              </p>
            </div>
          )}
        </div>

            <div className="border-t border-border pt-4" />

            {/* 3. Groundwater Monitoring Well Depth vs Satellite Water Storage */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <WaterDropletIcon className="w-4 h-4 text-water" /> {t('monitoring.wellVsGrace', '3. Groundwater Monitoring Well Depth vs Satellite Water Storage')}*
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Source: published CGWB/NWIC observations where returned by the historical API; NASA GRACE-FO TWSA shown separately • Last indicator update: {selectedBlock?.indicators.lastUpdatedDate || 'Unavailable'} • Scope: {selectedBlock ? `${selectedBlock.name}, ${selectedBlock.state}` : 'Monitored Unit'}
              </p>
              <div className="mt-1 space-y-0.5">
                <TermHelp termId="well_depth" />
                <TermHelp termId="satellite_water_storage" />
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                <strong>How to read:</strong> Measured in meters below ground level (<span className="font-mono">m bgl</span>). A higher depth number means the water table is dropping further underground.
              </p>
            </div>
            <span className="text-xs font-mono text-text-muted shrink-0">
              {isTimeSeriesLoading || isForecastLoading
                ? 'Loading records...'
                : historicalData.length > 0
                ? `${historicalData.length} Quarterly Obs${selectedBlock?.indicators.graceTwsaCm !== null && selectedBlock?.indicators.graceTwsaCm !== undefined ? ' • GRACE-FO TWSA' : ''}${forecastData?.forecasts?.length ? ` • ${forecastData.forecasts.length}Q Forecast` : ''}`
                : combinedChartData.length > 0
                ? `Station Telemetry Snapshot (${selectedBlock?.indicators.lastUpdatedDate || 'Verified Observation'})${selectedBlock?.indicators.graceTwsaCm !== null && selectedBlock?.indicators.graceTwsaCm !== undefined ? ' • GRACE-FO TWSA' : ''}`
                : 'CGWB Network'}
            </span>
          </div>

          {/* Forecast mode is fixed to demo/research — all blocks are stale by 400-day gate */}
          {/* No dual-mode selector shown; forecast section handles this contextually */}

          {/* Prominent Demo & Telemetry Compliance Banner */}
          {forecastData?.isDemonstrationData && (
            <div className="border-l-4 border-amber-600 bg-amber-50/80 p-3 text-xs text-amber-950 space-y-1">
              <div className="font-bold tracking-wide uppercase flex items-center gap-1.5">
                <InfoIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  {forecastData.dataAvailabilityMode === 'verified_live_telemetry'
                    ? 'EXPERIMENTAL PREDICTION — NOT VERIFIED OR OPERATIONAL'
                    : forecastData.dataAvailabilityMode === 'adaptive_historical_and_recent'
                    ? 'MIXED-INPUT EXPERIMENT — NOT VERIFIED OR OPERATIONAL'
                    : 'HISTORICAL DEMO — EXPERIMENTAL PREDICTION, NOT A CURRENT OPERATIONAL FORECAST'}
                </span>
              </div>
              <p className="leading-relaxed text-[11px]">
                {forecastData.dataAvailabilityMode === 'verified_live_telemetry' || forecastData.dataAvailabilityMode === 'adaptive_historical_and_recent'
                  ? `Projected from the experimental telemetry input series (${forecastData.observationDatesRange?.startDate || forecastData.observationDatesRange?.earliest || 'earliest'} to ${forecastData.observationDatesRange?.endDate || forecastData.observationDatesRange?.latest || 'latest'}); this is not verified groundwater depth. Model `
                  : `Projected using verified historical CGWB observations (${forecastData.observationDatesRange?.startDate || forecastData.observationDatesRange?.earliest || 'earliest'} to ${forecastData.observationDatesRange?.endDate || forecastData.observationDatesRange?.latest || 'latest'}) by model `}
                <span className="font-mono">{forecastData.modelIdentifier}</span>. Operational eligibility is strictly false. P10–P90 intervals are uncalibrated against localized pumping stress.
              </p>
            </div>
          )}

          {/* Stale archive notice when serving from local CGWB archive rather than live database */}
          {obsSource === 'local_archive' && historicalData.length > 0 && (
            <div className="bg-amber-50/80 border-l-2 border-amber-600 p-3 rounded-r text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <InfoIcon className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-amber-900">
                  <strong>Historical Archive (Stale):</strong> These records are from the verified CGWB quarterly manual monitoring archive. The latest date shown does <em>not</em> represent current groundwater conditions — all records are &gt;400 days old as of Oct 2026. No newer CGWB/NWIC measurements are currently available for this block in the published dataset.
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-700 shrink-0 bg-amber-100 px-2 py-0.5 border border-amber-300 rounded">
                STALE DATA
              </span>
            </div>
          )}

          {/* No observations notice */}
          {historicalData.length === 0 && combinedChartData.length > 0 && (
            <div className="bg-subtle/80 border-l-2 border-primary/70 p-3 rounded-r text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <InfoIcon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-text-main">
                  <strong>Indicator Snapshot:</strong> Satellite-derived GRACE-FO TWSA and block indicators are shown. No continuous quarterly well-depth time-series is currently available for this block.
                </span>
              </div>
            </div>
          )}

          <div className="h-72 w-full">
            {isTimeSeriesLoading || isForecastLoading ? (
              <div className="h-full w-full bg-subtle/40 flex items-center justify-center animate-pulse">
                <span className="text-xs text-text-muted">Loading observation series and satellite storage...</span>
              </div>
            ) : combinedChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_COLORS.axisText }} />
                  {/* Left Axis: Depth Below Ground Level (m bgl) */}
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                    label={{ value: 'Well Depth (m bgl)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: CHART_COLORS.axisText }, offset: 15 }}
                  />
                  {/* Right Axis: Terrestrial Water Storage Anomaly (cm) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                    label={{ value: 'GRACE TWSA (cm)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 10, fill: CHART_COLORS.axisText }, offset: 15 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, borderColor: CHART_COLORS.tooltipBorder, fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="wellDepth"
                    name="Observed Well Depth (m bgl)"
                    stroke={CHART_COLORS.wellDepth}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="modelDepth"
                    name="ML Projected Depth (m bgl)"
                    stroke={CHART_COLORS.forecastProjection}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                    connectNulls={true}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="lowerBoundP10"
                    name="P10 Lower Bound (m bgl)"
                    stroke={CHART_COLORS.forecastProjection}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    connectNulls={true}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="upperBoundP90"
                    name="P90 Upper Bound (m bgl)"
                    stroke={CHART_COLORS.forecastProjection}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    connectNulls={true}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="graceTwsa"
                    name="Regional Satellite TWSA (cm)"
                    stroke={CHART_COLORS.satelliteTwsa}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={{ r: 5, fill: CHART_COLORS.satelliteTwsa }}
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-subtle/30 border border-dashed border-border flex flex-col items-center justify-center p-6 text-center space-y-2">
                <ActivityChartIcon className="w-8 h-8 text-text-muted/60" />
                <p className="text-xs font-semibold text-text-main">No Published Observations Available</p>
                <p className="text-[11px] text-text-muted max-w-xs">
                  No verified historical groundwater level measurements are available for this block in the database view.
                </p>
              </div>
            )}
          </div>
          <div className="space-y-1 text-xs text-text-muted pt-2 border-t border-border/60">
            <p>
              {historicalData.length > 0
                ? t('monitoring.wellVsGraceSubtext', 'Direct well depth below ground level (m bgl) compared with regional GRACE TWSA storage anomaly (cm).')
                : 'Direct well depth below ground level (m bgl) is plotted only when verified station records exist.'}
              {forecastData?.forecasts && forecastData.forecasts.length > 0 && ' Dashed line indicates ML quantile projection with P10–P90 uncertainty intervals.'}
            </p>
            <p className="text-[11px] text-text-muted/80 italic">
              Regional Satellite Note: GRACE-FO TWSA represents coarse regional water-storage mass changes (~100 km grid). It reflects basin-scale terrestrial mass anomalies and is not a direct localized measurement of individual village wells.
            </p>
          </div>

          {/* Plain-Language Citizen Takeaway for Chart 1 */}
          {combinedChartData.length > 0 && (
            <div className="bg-subtle/70 border border-border/80 rounded p-3 text-xs space-y-1">
              <span className="font-semibold text-text-main flex items-center gap-1.5">
                <InfoIcon className="w-3.5 h-3.5 text-primary" /> Plain-Language Takeaway:
              </span>
              <p className="text-text-muted leading-relaxed">
                {(() => {
                  const validObs = combinedChartData.filter(d => !d.isForecast && d.wellDepth !== null);
                  if (validObs.length < 1) {
                    return 'Historical water depth measurements are currently not published for this specific block in the digital registry.';
                  }
                  if (validObs.length === 1) {
                    const single = validObs[0];
                    const storageStr = selectedBlock?.indicators.graceTwsaCm !== null && selectedBlock?.indicators.graceTwsaCm !== undefined
                      ? `${selectedBlock.indicators.graceTwsaCm > 0 ? `+${selectedBlock.indicators.graceTwsaCm}` : selectedBlock.indicators.graceTwsaCm} cm`
                      : 'unavailable';
                    return `On ${single.month}, the published observation record reports ${single.wellDepth} m bgl for ${selectedBlock?.name || 'this block'} (${selectedBlock?.state}); consult the source label and provenance before interpreting it. Regional satellite water storage (GRACE-FO TWSA) is ${storageStr}.`;
                  }
                  const first = validObs[0];
                  const last = validObs[validObs.length - 1];
                  const diff = Number((last.wellDepth! - first.wellDepth!).toFixed(2));
                  const direction = diff > 0.5 ? 'dropped further underground (depletion)' : diff < -0.5 ? 'rose closer to the surface (recharge)' : 'remained relatively stable';
                  return `Over the recorded period (${first.month} to ${last.month}), the monitored water level changed from ${first.wellDepth} m bgl to ${last.wellDepth} m bgl, meaning the water table has ${direction}. Satellite regional storage is currently ${selectedBlock?.indicators.graceTwsaCm !== null && selectedBlock?.indicators.graceTwsaCm !== undefined ? `${selectedBlock.indicators.graceTwsaCm} cm` : 'unavailable'} for this sector.`;
                })()}
              </p>
            </div>
          )}
        </div>
          </div>

{/* Groundwater Depth Projections Module (De-boxed Open Layout) */}
      <div id="forecast" className="pt-8 border-t border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-text-main">
                Primary 90-Day & 180-Day Groundwater Projections
              </h2>
              <span className="text-xs font-semibold text-amber-800">[Research-Only Model]</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Model: {forecastData?.modelIdentifier || 'QuantileGB-v2.0'} {forecastData?.modelVersion ? `v${forecastData.modelVersion}` : ''}
              {forecastData?.stationName ? ` • Station: ${forecastData.stationName}` : ''} • Primary prediction targets: 90 Days (Quarter 1) & 180 Days (Quarter 2). Intervals represent uncalibrated empirical quantiles (P10/P90).*
            </p>
          </div>
          <div className="text-right text-xs text-text-muted">
            <span className="font-medium">Primary: 90d & 180d Horizons</span>
            {forecastData?.latestObservationDate && (
              <span className="block text-[11px] text-text-muted/80">Origin: {forecastData.latestObservationDate}</span>
            )}
          </div>
        </div>

        {isForecastLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            <div className="h-28 bg-subtle border border-border"></div>
            <div className="h-28 bg-subtle border border-border"></div>
            <div className="h-28 bg-subtle border border-border"></div>
          </div>
        ) : forecastData && forecastData.forecasts && forecastData.forecasts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {forecastData.forecasts.map((fc: any, idx: number) => {
              const horizonDays = fc.forecastHorizonDays ?? (fc.forecastHorizonMonths ? fc.forecastHorizonMonths * 30 : (fc.horizonQuarter * 90));
              const isPrimaryHorizon = horizonDays === 90 || horizonDays === 180;
              return (
              <div key={idx} className={`p-4 bg-subtle border ${isPrimaryHorizon ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'} space-y-2.5`}>
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-text-main block">{fc.targetSeason}</span>
                    <span className="text-[10px] text-text-muted">
                      {fc.targetDate ? `Target: ${fc.targetDate}` : ''} • {horizonDays} Days ({fc.forecastHorizonMonths ?? fc.horizonQuarter * 3}M){isPrimaryHorizon ? ' [Primary Target]' : ''}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${
                    fc.stressRiskCategory === 'severe' ? 'text-red-700' : 'text-amber-700'
                  }`}>
                    ● {(fc.stressRiskCategory || 'normal').toUpperCase()}
                  </span>
                </div>

                <div className="text-xl font-bold text-text-main">
                  {fc.expectedDepthMbgl ?? '—'} <span className="text-xs font-normal text-text-muted">{fc.units || 'm bgl'}</span>
                </div>

                <div className="text-xs text-text-muted flex justify-between border-t border-border/60 pt-1.5">
                  <span>P10: {fc.uncertaintyInterval?.lowerBoundP10Mbgl !== undefined ? `${fc.uncertaintyInterval.lowerBoundP10Mbgl} m bgl` : 'N/A'}</span>
                  <span>P90: {fc.uncertaintyInterval?.upperBoundP90Mbgl !== undefined ? `${fc.uncertaintyInterval.upperBoundP90Mbgl} m bgl` : 'N/A'}</span>
                </div>
                {fc.uncertaintyInterval?.intervalWidthM !== undefined && (
                  <div className="text-[10px] text-text-muted text-right">
                    Interval Width: {fc.uncertaintyInterval.intervalWidthM} m
                  </div>
                )}

                {/* Baseline Persistence Comparison (Preserved & Distinctly Labeled) */}
                {fc.baselinePersistence && (
                  <div className="text-[11px] text-text-muted bg-surface p-2 border border-border space-y-1 mt-1">
                    <span className="font-semibold text-text-main block">Baseline Persistence Comparison:</span>
                    <div className="flex justify-between">
                      <span>Last-Obs Persistence:</span>
                      <span className="font-medium text-text-main">
                        {fc.baselinePersistence.lastObservationPersistenceMbgl !== undefined
                          ? `${fc.baselinePersistence.lastObservationPersistenceMbgl} m bgl`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Seasonal Persistence:</span>
                      <span className="font-medium text-text-main">
                        {fc.baselinePersistence.seasonalPersistenceMbgl !== undefined
                          ? `${fc.baselinePersistence.seasonalPersistenceMbgl} m bgl`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        ) : (
          <div className="p-4 bg-subtle/50 border border-border text-xs text-text-muted">
            {forecastData?.safeguardDisclaimer || 'Forecasts unavailable — requires minimum continuous verified quarterly observations.'}
          </div>
        )}

        {forecastData?.safeguardDisclaimer && (
          <p className="text-xs text-text-muted">
            {forecastData.safeguardDisclaimer}
          </p>
        )}
      </div>

      <NwdpStationForecastPanel />

      {/* Detailed Indicator Matrix for Selected Block (Open Layout) */}
      {isLoading ? (
        <div className="pt-8 border-t border-border space-y-4 animate-pulse">
          <div className="h-5 bg-subtle w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 bg-subtle"></div>
            <div className="h-24 bg-subtle"></div>
            <div className="h-24 bg-subtle"></div>
          </div>
        </div>
      ) : selectedBlock ? (
        <div className="pt-8 border-t border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border pb-3">
            <h2 className="text-sm font-bold text-text-main">
              {t('monitoring.matrixTitle', 'Current Indicator Matrix')} — {selectedBlock.name} Block ({selectedBlock.districtName})
            </h2>
            <span className="text-xs text-text-muted">
              Quality Flag: {selectedBlock.indicators.dataQualityFlag.toUpperCase()} • Telemetry: {selectedBlock.assessment.dataStatus.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border text-xs">
            <div className="py-2 md:py-0 md:pr-4 first:md:pl-0 space-y-1">
              <span className="text-text-muted font-medium">NASA GRACE-FO TWSA</span>
              <div className="text-xl font-bold text-text-main">{fmtVal(selectedBlock.indicators.graceTwsaCm, 'cm')}</div>
              <p className="text-[11px] text-text-muted leading-relaxed">Coarse satellite grid (1.0° resolution). Regional mass anomaly.</p>
            </div>

            <div className="py-2 md:py-0 md:px-4 space-y-1">
              <span className="text-text-muted font-medium">IMD Rainfall Anomaly</span>
              <div className="text-xl font-bold text-amber-700">{fmtVal(selectedBlock.indicators.rainfallAnomalyMm, 'mm')}</div>
              <p className="text-[11px] text-text-muted leading-relaxed">SPI 3-Month: {selectedBlock.indicators.spi3Month ?? 'N/A'}. Gridded rain gauge deficit.</p>
            </div>

            <div className="py-2 md:py-0 md:pl-4 last:md:pr-0 space-y-1">
              <span className="text-text-muted font-medium">CGWB Well Level (m bgl)</span>
              <div className="text-xl font-bold text-red-700">{fmtVal(selectedBlock.indicators.cgwbWellDepthMbgl, 'm bgl')}</div>
              <p className="text-[11px] text-text-muted leading-relaxed">Trend: {selectedBlock.indicators.wellDepthTrendMperYr !== null ? `${selectedBlock.indicators.wellDepthTrendMperYr} m/yr drawdown rate.` : 'No trend data'}</p>
            </div>
          </div>

          {/* Actionable Groundwater Intelligence & Drought Risk Module */}
          {(() => {
            const intel = evaluateGroundwaterIntelligence(selectedBlock.indicators);
            return (
              <div className="bg-subtle/80 border border-border p-4 rounded space-y-3 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main text-xs uppercase tracking-wider">4. Integrated Groundwater Intelligence &amp; Drought Risk Summary</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      intel.droughtRisk.category === 'Severe Drought Watch'
                        ? 'bg-red-50 text-red-800 border-red-300'
                        : intel.droughtRisk.category === 'Watch / Moderate Deficit'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}>
                      {intel.droughtRisk.category}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">
                    Rule-Based Diagnostic • Not Statutory Relief Order
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Meteorological Drought Risk</span>
                    <p className="text-text-main font-medium">{intel.droughtRisk.basis}</p>
                    <p className="text-[10px] text-text-muted">{intel.droughtRisk.ruleExplanation}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Water Availability Status</span>
                    <p className="text-text-main font-medium capitalize">Trend: {intel.waterAvailability.direction}</p>
                    <p className="text-[10px] text-text-muted">{intel.waterAvailability.storageLimitationNotice}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-text-muted">Aquifer Recharge Intelligence</span>
                    <p className="text-text-main font-medium capitalize">Potential: {intel.rechargeIntelligence.rechargePotential}</p>
                    <p className="text-[10px] text-text-muted">{intel.rechargeIntelligence.naturalReplenishmentSummary}</p>
                  </div>
                </div>

                <div className="bg-surface p-2.5 border border-border/80 rounded text-xs space-y-1">
                  <span className="font-semibold text-text-main flex items-center gap-1.5 text-[11px]">
                    <InfoIcon className="w-3.5 h-3.5 text-primary" /> Actionable Decision Support &amp; Interventions:
                  </span>
                  <p className="text-text-muted leading-relaxed text-[11px]">
                    {intel.actionableSummary}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="p-8 text-center bg-surface border border-border text-xs text-text-muted">
          No block selected or administrative unit unavailable.
        </div>
      )}

      {/* Genuine Historical Observations Panel (Open Layout) */}
      {selectedBlock && (
        <div className="pt-8 border-t border-border space-y-4">
          <h2 className="text-sm font-bold text-text-main">
            {t('monitoring.historicalObservationsTitle', 'Published CGWB / NWIC Historical Groundwater Observations')}
          </h2>
          <HistoricalObservationsPanel enabled={true} block={selectedBlock.id} />
        </div>
      )}
        </>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-text-muted">Loading Groundwater Monitoring...</div>}>
      <MonitoringContent />
    </Suspense>
  );
}
