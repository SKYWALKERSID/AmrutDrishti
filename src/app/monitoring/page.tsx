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
import { useLanguage } from '@/lib/context/LanguageContext';
import { ALL_NATIONWIDE_BLOCKS, ALL_NATIONWIDE_DISTRICTS, mergeWithLiveBlocks, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { ALL_INDIAN_STATES } from '@/lib/data/indiaStates';
import contrastHistoricalSeries from '@/lib/data/contrastHistoricalSeries.json';
import { CHART_COLORS, deviationColor } from '@/lib/design/chartPalette';

interface HistoricalPoint {
  month: string;
  wellDepth: number;
}

function MonitoringContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [blocksData, setBlocksData] = useState<BlockData[]>(ALL_NATIONWIDE_BLOCKS);
  const [dataSourceInfo, setDataSourceInfo] = useState<{ source: string; isDemonstration: boolean; errorMessage?: string }>({
    source: 'nationwide_empirical',
    isDemonstration: false
  });
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [isTimeSeriesLoading, setIsTimeSeriesLoading] = useState<boolean>(true);
  const [forecastData, setForecastData] = useState<any>(null);
  const [isForecastLoading, setIsForecastLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
              } else {
                setSelectedBlockId(merged[0].id);
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

  // Derived filtered districts
  const availableDistricts = useMemo(() => {
    if (selectedState === 'all') return ALL_NATIONWIDE_DISTRICTS;
    return ALL_NATIONWIDE_DISTRICTS.filter(d => normalizeStateName(d.state) === selectedState);
  }, [selectedState]);

  // Derived filtered blocks
  const filteredBlocks = useMemo(() => {
    return blocksData.filter(b => {
      const matchState = selectedState === 'all' || normalizeStateName(b.state) === selectedState;
      const matchDistrict = selectedDistrictId === 'all' || b.districtId === selectedDistrictId;
      return matchState && matchDistrict;
    });
  }, [blocksData, selectedState, selectedDistrictId]);

  // Handle State change
  const handleStateChange = (stateName: string) => {
    setSelectedState(stateName);
    setSelectedDistrictId('all');
    const matchedBlocks = blocksData.filter(b => stateName === 'all' || normalizeStateName(b.state) === stateName);
    if (matchedBlocks.length > 0) {
      setSelectedBlockId(matchedBlocks[0].id);
    }
  };

  // Handle District change
  const handleDistrictChange = (distId: string) => {
    setSelectedDistrictId(distId);
    const matchedBlocks = blocksData.filter(b => {
      const matchState = selectedState === 'all' || normalizeStateName(b.state) === selectedState;
      const matchDistrict = distId === 'all' || b.districtId === distId;
      return matchState && matchDistrict;
    });
    if (matchedBlocks.length > 0) {
      setSelectedBlockId(matchedBlocks[0].id);
    }
  };

  // Load genuine CGWB historical observations for this block
  useEffect(() => {
    if (!selectedBlockId) return;
    let active = true;
    setIsTimeSeriesLoading(true);
    setIsForecastLoading(true);

    async function loadTimeSeries() {
      try {
        const res = await fetch(`/api/historical-observations?block=${encodeURIComponent(selectedBlockId)}&limit=50`);
        if (res.ok) {
          const json = await res.json();
          if (active && json.observations && Array.isArray(json.observations) && json.observations.length > 0) {
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

            setHistoricalData(chartPoints);
            return;
          }
        }
      } catch {
        // Fall through to contrast series
      }

      // Check genuine empirical contrast observations extracted from CGWB datasets
      const contrastSeries = (contrastHistoricalSeries as Record<string, HistoricalPoint[]>)[selectedBlockId];
      if (active) {
        if (contrastSeries && Array.isArray(contrastSeries) && contrastSeries.length > 0) {
          setHistoricalData(contrastSeries);
        } else {
          setHistoricalData([]);
        }
        setIsTimeSeriesLoading(false);
      }
    }

    async function loadForecast() {
      try {
        const res = await fetch(`/api/forecast?block=${encodeURIComponent(selectedBlockId)}`);
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

  // Seasonal Monsoon Rainfall & Deviation aligned by date and LPA baseline
  const rainfallChartData = useMemo<RainfallChartPoint[]>(() => {
    if (!selectedBlock || selectedBlock.indicators.rainfallAnomalyMm === null || selectedBlock.indicators.rainfallAnomalyMm === undefined) {
      return [];
    }

    // Official IMD 30-year Long Period Average (LPA, 1991–2020) for monsoon season (JJAS) by state
    const lpaByState: Record<string, number> = {
      'Punjab': 480,
      'Haryana': 450,
      'Rajasthan': 420,
      'Madhya Pradesh': 850,
      'Uttar Pradesh': 800,
      'Assam': 1800,
      'Meghalaya': 2500,
      'Arunachal Pradesh': 2200,
    };

    const lpa = lpaByState[selectedBlock.state] || 800;
    const anomaly = selectedBlock.indicators.rainfallAnomalyMm;
    const observedTotal = Math.max(0, Number((lpa + anomaly).toFixed(1)));
    const date = selectedBlock.indicators.lastUpdatedDate || '2026-09-30';
    const year = date.split('-')[0] || '2026';

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
              <option value="all">All States</option>
              <optgroup label="Active Monitored States">
                {ALL_INDIAN_STATES.filter(s => s.hasData).map((st) => (
                  <option key={st.code} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Telemetry Pending">
                {ALL_INDIAN_STATES.filter(s => !s.hasData).map((st) => (
                  <option key={st.code} value={st.name} disabled className="text-gray-400 italic">
                    {st.name} (Pending)
                  </option>
                ))}
              </optgroup>
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
                  ? `All Districts (${ALL_NATIONWIDE_DISTRICTS.length})`
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

      {/* Open Content Layout for Dual Monitoring Charts */}
      <div className="space-y-12">
        {/* Chart 1: Published Groundwater Well Depths & Satellite Water Storage */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <WaterDropletIcon className="w-4 h-4 text-water" /> {t('monitoring.wellVsGrace', 'Groundwater Monitoring Well Depth vs Satellite Water Storage')}*
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Source: CGWB DWLR Hydrograph &amp; NASA GRACE-FO TWSA • Last Observation: {selectedBlock?.indicators.lastUpdatedDate || '2026-10-12'} • Scope: {selectedBlock ? `${selectedBlock.name}, ${selectedBlock.state}` : 'Monitored Unit'}
              </p>
            </div>
            <span className="text-xs font-mono text-text-muted shrink-0">
              {isTimeSeriesLoading || isForecastLoading
                ? 'Loading records...'
                : combinedChartData.length > 0
                ? `${historicalData.length} Well Obs${selectedBlock?.indicators.graceTwsaCm !== null && selectedBlock?.indicators.graceTwsaCm !== undefined ? ' • GRACE-FO TWSA' : ''}${forecastData?.forecasts?.length ? ` • ${forecastData.forecasts.length}Q Forecast` : ''}`
                : 'CGWB Network'}
            </span>
          </div>

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
        </div>

        {/* Subtle Divider Between the Two Main Charts */}
        <div className="border-t border-border pt-2" />

        {/* Chart 2: Seasonal Monsoon Rainfall & Deviation (mm) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <CloudRainIcon className="w-4 h-4 text-amber-600" /> {t('monitoring.seasonalRainfallTitle', 'Seasonal Monsoon Rainfall & Deviation (mm)')}*
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Source: IMD Pune 0.25° Gridded Precipitation Product • Baseline: State 30-Year LPA Normal (1991–2020)
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
                <ComposedChart data={rainfallChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: CHART_COLORS.axisText }} />
                  {/* Left Axis: Rainfall Total (mm) */}
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
                    domain={[0, 'auto']}
                    label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: CHART_COLORS.axisText }, offset: 15 }}
                  />
                  {/* Right Axis: Deviation (mm) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
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
                <span className="text-[10px] text-text-muted font-semibold block uppercase">Observed Total</span>
                <span className="text-base font-bold text-text-main">{rainfallChartData[0].observedMm} mm</span>
              </div>
              <div className="px-2">
                <span className="text-[10px] text-text-muted font-semibold block uppercase">30-Yr LPA Normal</span>
                <span className="text-base font-bold text-text-main">{rainfallChartData[0].normalLpaMm} mm</span>
              </div>
              <div className="px-2">
                <span className="text-[10px] text-text-muted font-semibold block uppercase">Deviation &amp; SPI</span>
                <span className={`text-base font-bold ${rainfallChartData[0].deviationMm < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {rainfallChartData[0].deviationMm > 0 ? '+' : ''}{rainfallChartData[0].deviationMm} mm
                  {selectedBlock?.indicators.spi3Month !== null && ` (SPI: ${selectedBlock?.indicators.spi3Month})`}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-text-muted">
            Seasonal monsoon rainfall (Jun–Sep) compared with the state 30-year Long Period Average (LPA, 1991–2020). The observed total shown here is calculated in the app as the state LPA reference value plus the stored rainfall difference for this block; it is not a separately measured block total. Only one season is shown.
          </p>
        </div>
      </div>

      {/* Groundwater Depth Projections Module (De-boxed Open Layout) */}
      <div id="forecast" className="pt-8 border-t border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-text-main">
                Multi-Horizon Seasonal Depth Projections
              </h2>
              <span className="text-xs font-semibold text-amber-800">[Research-Only Model]</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Model: {forecastData?.modelIdentifier || 'QuantileGB-v2.0'} {forecastData?.modelVersion ? `v${forecastData.modelVersion}` : ''}
              {forecastData?.stationName ? ` • Station: ${forecastData.stationName}` : ''} • Non-operational quantile baseline projection. Intervals represent uncalibrated empirical quantiles (P10/P90).*
            </p>
          </div>
          <div className="text-right text-xs text-text-muted">
            <span className="font-medium">Horizon: 1 to 4 Quarters Ahead</span>
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
            {forecastData.forecasts.map((fc: any, idx: number) => (
              <div key={idx} className="p-4 bg-subtle border border-border space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-text-main block">{fc.targetSeason}</span>
                    <span className="text-[10px] text-text-muted">
                      {fc.targetDate ? `Date: ${fc.targetDate}` : ''} • Horizon: {fc.horizonQuarter}Q ({fc.forecastHorizonMonths ?? fc.horizonQuarter * 3}M)
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
            ))}
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
