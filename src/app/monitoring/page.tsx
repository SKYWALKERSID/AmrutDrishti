'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BlockData } from '@/lib/types';
import {
  LineChart,
  Line,
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

interface HistoricalPoint {
  month: string;
  wellDepth: number;
}

function MonitoringContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [blocksData, setBlocksData] = useState<BlockData[]>([]);
  const [dataSourceInfo, setDataSourceInfo] = useState<{ source: string; isDemonstration: boolean; errorMessage?: string }>({
    source: 'loading',
    isDemonstration: false
  });
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [isTimeSeriesLoading, setIsTimeSeriesLoading] = useState<boolean>(true);
  const [forecastData, setForecastData] = useState<any>(null);
  const [isForecastLoading, setIsForecastLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load available administrative units
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const res = await fetch('/api/geospatial/blocks');
        if (res.ok && active) {
          const json = await res.json();
          if (json.blocks && Array.isArray(json.blocks)) {
            setBlocksData(json.blocks);
            setDataSourceInfo({
              source: json.source || 'fallback_empty',
              isDemonstration: json.isDemonstrationData ?? false,
              errorMessage: json.errorMessage
            });
            if (json.blocks.length > 0) {
              if (urlBlockParam && json.blocks.some((b: BlockData) => b.id === urlBlockParam)) {
                setSelectedBlockId(urlBlockParam);
              } else {
                setSelectedBlockId(json.blocks[0].id);
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
          if (active && json.observations && Array.isArray(json.observations)) {
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
          } else if (active) {
            setHistoricalData([]);
          }
        } else if (active) {
          setHistoricalData([]);
        }
      } catch {
        if (active) setHistoricalData([]);
      } finally {
        if (active) setIsTimeSeriesLoading(false);
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

    loadTimeSeries();
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
      }
    }
  }, [urlBlockParam, blocksData]);

  const selectedBlock = blocksData.find(b => b.id === selectedBlockId) || null;

  const fmtVal = (val: number | null, unit: string) => (val === null ? t('monitoring.noData', 'No Data') : `${val} ${unit}`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-border rounded p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="font-semibold text-text-main">
              CGWB Groundwater Well Network
            </span>
            <span>•</span>
            <span>Empirical Monitoring Baseline</span>
          </div>
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2 mt-1">
            <ActivityChartIcon className="w-5 h-5 text-[#0d5c63]" /> {t('monitoring.title', 'Groundwater Monitoring & Trends')}
          </h1>
          <p className="text-xs text-text-muted mt-1">
            {t('monitoring.subtitle', 'Track verified groundwater telemetry and multi-source hydrological indicators.')}
          </p>
        </div>

        {/* Block Switcher */}
        <div className="flex items-center gap-2 text-xs">
          <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
          <span className="font-semibold text-text-main">{t('monitoring.selectBlock', 'Select Block:')}</span>
          {isLoading ? (
            <div className="h-8 w-44 bg-subtle rounded animate-pulse"></div>
          ) : blocksData.length > 0 ? (
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="bg-subtle border border-border rounded-md px-3 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer"
            >
              {blocksData.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.districtName}) — {b.riskSeverity.toUpperCase()}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-text-muted italic">No blocks available</span>
          )}
        </div>
      </div>

      {dataSourceInfo.errorMessage && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">
          <strong>Data Access Notice:</strong> {dataSourceInfo.errorMessage}
        </div>
      )}

      {/* Informational Guidance Strip */}
      <div className="bg-subtle/70 border border-border rounded p-3 text-xs text-text-muted flex items-center justify-between">
        <div className="flex items-center gap-2">
          <InfoIcon className="w-4 h-4 text-[#0d5c63] shrink-0" />
          <span>Multi-Scale Indicators: Evaluating observed CGWB well depths alongside satellite mass anomalies (GRACE-FO).</span>
        </div>
        {selectedBlock && (
          <span className="font-semibold text-text-main hidden sm:inline">{selectedBlock.name} ({selectedBlock.districtName})</span>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Published Groundwater Well Depths */}
        <div className="bg-surface border border-border rounded p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <WaterDropletIcon className="w-4 h-4 text-water" /> {t('monitoring.wellVsGrace', 'Groundwater Depth Trend (m bgl)')}
            </h2>
            <span className="text-[11px] text-text-muted font-medium">
              {isTimeSeriesLoading ? 'Loading records...' : historicalData.length > 0 ? `${historicalData.length} Observations` : 'CGWB Network'}
            </span>
          </div>

          <div className="h-64 w-full">
            {isTimeSeriesLoading ? (
              <div className="h-full w-full bg-subtle/40 rounded flex items-center justify-center animate-pulse">
                <span className="text-xs text-text-muted">Loading observation series...</span>
              </div>
            ) : historicalData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d8" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e0d8', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="wellDepth" name="Well Depth (m bgl)" stroke="#0d5c63" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full bg-subtle/30 rounded border border-dashed border-border flex flex-col items-center justify-center p-6 text-center space-y-2">
                <ActivityChartIcon className="w-8 h-8 text-text-muted/60" />
                <p className="text-xs font-semibold text-text-main">No Published Observations Available</p>
                <p className="text-[11px] text-text-muted max-w-xs">
                  No verified historical groundwater level measurements are available for this block in the database view.
                </p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-text-muted">
            {historicalData.length > 0
              ? t('monitoring.wellVsGraceSubtext', 'Direct well depth below ground level (m bgl) averaged across block stations from published CGWB records.')
              : 'Direct well depth below ground level (m bgl) is plotted only when verified station records exist.'}
          </p>
        </div>

        {/* Chart 2: Rainfall Anomaly & Precipitation Summary */}
        <div className="bg-surface border border-border rounded p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <CloudRainIcon className="w-4 h-4 text-amber-600" /> {t('monitoring.seasonalRainfallTitle', 'Seasonal Precipitation Indicators')}
            </h2>
            <span className="text-[11px] text-text-muted font-medium">
              IMD Gridded Rainfall
            </span>
          </div>

          <div className="h-64 w-full flex flex-col justify-center">
            {isLoading ? (
              <div className="h-full w-full bg-subtle/40 rounded flex items-center justify-center animate-pulse">
                <span className="text-xs text-text-muted">Loading rainfall indicators...</span>
              </div>
            ) : selectedBlock && selectedBlock.indicators.rainfallAnomalyMm !== null ? (
              <div className="space-y-4 p-4 bg-subtle/40 rounded border border-border text-center">
                <div className="space-y-1">
                  <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">Seasonal Monsoon Anomaly</span>
                  <div className={`text-3xl font-extrabold ${selectedBlock.indicators.rainfallAnomalyMm < -200 ? 'text-red-700' : 'text-amber-700'}`}>
                    {selectedBlock.indicators.rainfallAnomalyMm} mm
                  </div>
                  <p className="text-xs text-text-muted">Deviation from 30-year Long Period Average (LPA)</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60 text-left">
                  <div className="p-2.5 bg-surface rounded border border-border">
                    <span className="text-[10px] text-text-muted font-semibold block">SPI 3-MONTH</span>
                    <span className="text-sm font-bold text-text-main">{selectedBlock.indicators.spi3Month ?? 'Pending calculation'}</span>
                  </div>
                  <div className="p-2.5 bg-surface rounded border border-border">
                    <span className="text-[10px] text-text-muted font-semibold block">DATA STATUS</span>
                    <span className="text-sm font-bold text-text-main">{selectedBlock.assessment.dataStatus.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full w-full bg-subtle/30 rounded border border-dashed border-border flex flex-col items-center justify-center p-6 text-center space-y-2">
                <CloudRainIcon className="w-8 h-8 text-text-muted/60" />
                <p className="text-xs font-semibold text-text-main">Rainfall Time Series Unavailable</p>
                <p className="text-[11px] text-text-muted max-w-xs">
                  Gridded precipitation time series requires IMD spatial polygon aggregation which is not currently populated for this block.
                </p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-text-muted">
            Rainfall measurements are drawn from verified IMD gridded products. No synthetic monthly series are displayed.
          </p>
        </div>
      </div>

      {/* Groundwater Depth Projections Module */}
      <div className="bg-surface border border-border rounded p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> Multi-Horizon Seasonal Depth Projections
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Quantile baseline projections ({forecastData?.modelIdentifier || 'ML Provenance Verified'}) with P10–P90 uncertainty intervals.
            </p>
          </div>
          <span className="text-xs text-text-muted">
            Horizon: 1 to 4 Quarters Ahead
          </span>
        </div>

        {isForecastLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-pulse">
            <div className="h-24 bg-subtle rounded border border-border"></div>
            <div className="h-24 bg-subtle rounded border border-border"></div>
            <div className="h-24 bg-subtle rounded border border-border"></div>
          </div>
        ) : forecastData && forecastData.forecasts && forecastData.forecasts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {forecastData.forecasts.map((fc: any, idx: number) => (
              <div key={idx} className="p-3.5 bg-subtle/50 rounded border border-border space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-main">{fc.targetSeason}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    fc.stressRiskCategory === 'severe' ? 'text-red-800 bg-red-50 border border-red-200' : 'text-amber-800 bg-amber-50 border border-amber-200'
                  }`}>
                    {fc.stressRiskCategory.toUpperCase()}
                  </span>
                </div>
                <div className="text-xl font-bold text-text-main">
                  {fc.expectedDepthMbgl} <span className="text-xs font-normal text-text-muted">m bgl</span>
                </div>
                <div className="text-[11px] text-text-muted flex justify-between border-t border-border/60 pt-1">
                  <span>P10: {fc.uncertaintyInterval.lowerBoundP10Mbgl}m</span>
                  <span>P90: {fc.uncertaintyInterval.upperBoundP90Mbgl}m</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-subtle/50 rounded border border-border text-xs text-text-muted">
            {forecastData?.safeguardDisclaimer || 'Forecasts unavailable — requires minimum continuous verified quarterly observations.'}
          </div>
        )}

        {forecastData?.safeguardDisclaimer && (
          <p className="text-[11px] text-text-muted">
            {forecastData.safeguardDisclaimer}
          </p>
        )}
      </div>

      {/* Detailed Indicator Matrix for Selected Block */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4 animate-pulse">
          <div className="h-5 bg-subtle rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 bg-subtle rounded"></div>
            <div className="h-24 bg-subtle rounded"></div>
            <div className="h-24 bg-subtle rounded"></div>
          </div>
        </div>
      ) : selectedBlock ? (
        <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
          <h2 className="text-sm font-bold text-text-main flex items-center justify-between">
            <span>{t('monitoring.matrixTitle', 'Current Indicator Matrix')} — {selectedBlock.name} Block ({selectedBlock.districtName})</span>
            <span className="text-xs font-normal text-text-muted">
              Status: {selectedBlock.indicators.dataQualityFlag.toUpperCase()} (Data Status: {selectedBlock.assessment.dataStatus})
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-subtle/50 rounded-lg border border-border space-y-1">
              <span className="text-text-muted font-medium">NASA GRACE-FO TWSA</span>
              <div className="text-lg font-bold text-text-main">{fmtVal(selectedBlock.indicators.graceTwsaCm, 'cm')}</div>
              <p className="text-[11px] text-text-muted">Coarse satellite grid (1.0° resolution). Regional mass anomaly.</p>
            </div>

            <div className="p-4 bg-subtle/50 rounded-lg border border-border space-y-1">
              <span className="text-text-muted font-medium">IMD Rainfall Anomaly</span>
              <div className="text-lg font-bold text-amber-700">{fmtVal(selectedBlock.indicators.rainfallAnomalyMm, 'mm')}</div>
              <p className="text-[11px] text-text-muted">SPI 3-Month: {selectedBlock.indicators.spi3Month ?? 'N/A'}. Gridded rain gauge deficit.</p>
            </div>

            <div className="p-4 bg-subtle/50 rounded-lg border border-border space-y-1">
              <span className="text-text-muted font-medium">CGWB Well Level (m bgl)</span>
              <div className="text-lg font-bold text-red-700">{fmtVal(selectedBlock.indicators.cgwbWellDepthMbgl, 'm bgl')}</div>
              <p className="text-[11px] text-text-muted">Trend: {selectedBlock.indicators.wellDepthTrendMperYr !== null ? `${selectedBlock.indicators.wellDepthTrendMperYr} m/yr drawdown rate.` : 'No trend data'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-surface border border-border rounded-lg text-xs text-text-muted">
          No block selected or administrative unit unavailable.
        </div>
      )}

      {/* Genuine Historical Observations Panel */}
      {selectedBlock && (
        <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
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
