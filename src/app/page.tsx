'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ALL_INDIAN_STATES } from '@/lib/data/indiaStates';
import { ALL_NATIONWIDE_BLOCKS, ALL_NATIONWIDE_DISTRICTS, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { INITIAL_INTERVENTIONS } from '@/lib/data/interventions';
import { summarizeBlocks } from '@/lib/demo/demoPolicy';
import type { BlockData } from '@/lib/types';
import {
  WaterDropletIcon,
  CloudRainIcon,
  ShieldCheckIcon,
  ActivityChartIcon,
  MapPinIcon,
  FilterIcon
} from '@/components/ui/Icons';
import { useLanguage } from '@/lib/context/LanguageContext';

export default function OverviewDashboard() {
  const { t } = useLanguage();

  // Cascading geographic filter: State -> District
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [interventionCount, setInterventionCount] = useState<number>(INITIAL_INTERVENTIONS.length);
  const [blocksData, setBlocksData] = useState<BlockData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('jaldrishti_interventions_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setInterventionCount(parsed.length);
      }
    } catch {
      /* keep fixture count */
    }
  }, []);

  async function loadGeospatialData() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/geospatial/blocks');
      if (res.ok) {
        const json = await res.json();
        const liveBlocks: BlockData[] = json.blocks || [];
        
        // Merge live PostGIS rows into the nationwide dataset of 60 blocks across 8 states
        const liveMap = new Map<string, BlockData>();
        for (const b of liveBlocks) {
          liveMap.set(b.id, b);
        }

        const combined = ALL_NATIONWIDE_BLOCKS.map(block => {
          const live = liveMap.get(block.id);
          if (live) {
            return {
              ...live,
              state: normalizeStateName(live.state || block.state)
            };
          }
          return block;
        });

        setBlocksData(combined);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setLoadError(json.errorMessage || 'Failed to fetch geospatial blocks from database.');
      setBlocksData(ALL_NATIONWIDE_BLOCKS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      console.warn('JalDrishti: Failed to fetch geospatial blocks API for Overview:', err);
      setLoadError(msg);
      setBlocksData(ALL_NATIONWIDE_BLOCKS);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadGeospatialData();
  }, []);

  // Compute available districts based on selected State
  const availableDistricts = React.useMemo(() => {
    if (selectedState === 'all') {
      return ALL_NATIONWIDE_DISTRICTS;
    }
    return ALL_NATIONWIDE_DISTRICTS.filter(d => normalizeStateName(d.state) === selectedState);
  }, [selectedState]);

  // Handle cascading state change
  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    setSelectedDistrictId('all');
  };

  const displayBlocks = blocksData.length > 0 ? blocksData : ALL_NATIONWIDE_BLOCKS;

  const filteredBlocks = displayBlocks.filter((block) => {
    const matchesState = selectedState === 'all' || normalizeStateName(block.state) === selectedState;
    const matchesDistrict = selectedDistrictId === 'all' || block.districtId === selectedDistrictId;
    const matchesSeverity = selectedSeverity === 'all' || block.riskSeverity === selectedSeverity;
    return matchesState && matchesDistrict && matchesSeverity;
  });

  const summary = summarizeBlocks(filteredBlocks);
  const severeCount = summary.severe;
  const watchCount = summary.watch;
  const normalCount = summary.normal;
  const fmt = (v: number | null, unit: string) => (v === null ? t('monitoring.noData', 'No Data') : `${v} ${unit}`);

  return (
    <div className="space-y-6">
      {/* Header Banner with Nationwide Coverage Scope */}
      <div className="bg-surface border border-border rounded p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              {isLoading ? (
                <span className="inline-block h-3.5 bg-subtle rounded w-52 animate-pulse"></span>
              ) : (
                <span className="font-semibold text-text-main">
                  National Monitored Geography: {selectedState === 'all' ? '8 Active States (Bundelkhand & Contrast Networks)' : selectedState} • {summary.districtCount} Districts, {summary.total} Blocks
                </span>
              )}
              <span>•</span>
              <span>CGWB & NWIC Telemetry Network Active</span>
            </div>
            <h1 className="text-2xl font-bold text-text-main mt-1.5 tracking-tight">
              {t('overview.title')}
            </h1>
            <p className="text-sm text-text-muted mt-1 max-w-3xl leading-relaxed">
              {t('overview.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/explorer"
              className="bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-2 rounded shadow-xs transition-colors flex items-center gap-2"
            >
              <MapPinIcon className="w-4 h-4" /> {t('overview.openGis')}
            </Link>
            <Link
              href="/interventions"
              className="bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold px-4 py-2 rounded transition-colors"
            >
              {t('overview.interventionsBtn')} ({interventionCount})
            </Link>
          </div>
        </div>
      </div>

      {/* Flagged Priority Water Security Monitoring Section */}
      <div className="bg-surface border border-border rounded p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-text-main tracking-tight flex items-center gap-2">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> Priority Groundwater Monitoring Units
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Empirical observation stations indicating high drawdown, arid extraction, or critical storage depletion.
            </p>
          </div>
          <span className="text-xs text-text-muted font-medium bg-subtle px-2 py-0.5 rounded border border-border">
            {isLoading ? t('monitoring.loading', 'Loading live database...') : severeCount > 0 ? `${severeCount} flagged of ${summary.total} monitored blocks` : `${displayBlocks.length} monitored blocks active`}
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-surface border border-border rounded p-4 animate-pulse space-y-3">
              <div className="h-4 bg-subtle rounded w-1/3"></div>
              <div className="h-8 bg-subtle/60 rounded"></div>
              <div className="h-3 bg-subtle rounded w-1/2"></div>
            </div>
            <div className="bg-surface border border-border rounded p-4 animate-pulse space-y-3">
              <div className="h-4 bg-subtle rounded w-1/3"></div>
              <div className="h-8 bg-subtle/60 rounded"></div>
              <div className="h-3 bg-subtle rounded w-1/2"></div>
            </div>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-xs text-red-900 flex items-center justify-between">
            <div>
              <p className="font-semibold">{t('overview.loadErrorTitle', 'Unable to load monitored blocks')}</p>
              <p className="text-red-700 mt-0.5">{loadError}</p>
            </div>
            <button
              onClick={loadGeospatialData}
              className="px-3 py-1 bg-red-800 text-white rounded font-medium text-xs hover:bg-red-900 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredBlocks.length === 0 ? (
          <div className="bg-subtle/50 border border-border rounded p-6 text-center text-xs text-text-muted">
            <p className="font-semibold text-text-main text-sm">No Monitored Units Available</p>
            <p className="mt-1">No administrative monitoring records were returned for this geographical filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {(() => {
              const severeBlocks = filteredBlocks.filter(b => b.riskSeverity === 'severe');
              const watchBlocks = filteredBlocks.filter(b => b.riskSeverity === 'watch');
              const priorityBlocks = severeBlocks.length > 0 
                ? severeBlocks.slice(0, 6) 
                : (watchBlocks.length > 0 ? watchBlocks.slice(0, 6) : filteredBlocks.slice(0, 6));

              return priorityBlocks.map(block => {
                const isSevere = block.riskSeverity === 'severe';
                const isWatch = block.riskSeverity === 'watch';
                const badgeBg = isSevere 
                  ? 'bg-red-50 text-red-800 border-red-200' 
                  : isWatch 
                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200';

                return (
                  <div key={block.id} className="bg-surface border border-border rounded p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-text-main text-sm">{block.name} Block</h3>
                        <span className="text-text-muted text-[11px]">{block.districtName} District, {block.state}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${badgeBg}`}>
                          GSS: {block.assessment.descriptiveStressScore !== null ? `${block.assessment.descriptiveStressScore}/100` : t('monitoring.noData', 'No Data')}
                        </span>
                        <span className="block text-[10px] text-text-muted capitalize mt-0.5">
                          {block.riskSeverity} Priority
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-subtle/40 p-2 rounded border border-border">
                      <div>
                        <span className="text-text-muted block text-[10px]">{t('layer.wells', 'Well Depth')}</span>
                        <span className={`font-bold ${isSevere ? 'text-red-700' : 'text-text-main'}`}>
                          {block.indicators.cgwbWellDepthMbgl !== null ? `${block.indicators.cgwbWellDepthMbgl}m bgl` : t('monitoring.noData', 'No Data')}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">{t('layer.rainfall', 'Rain Deficit')}</span>
                        <span className={`font-bold ${isSevere ? 'text-red-700' : 'text-text-main'}`}>
                          {block.indicators.rainfallAnomalyMm !== null ? `${block.indicators.rainfallAnomalyMm}mm` : t('monitoring.noData', 'No Data')}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">{t('layer.grace', 'GRACE TWSA')}</span>
                        <span className="font-bold text-text-main">
                          {block.indicators.graceTwsaCm !== null ? `${block.indicators.graceTwsaCm}cm` : t('monitoring.noData', 'No Data')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
                      <Link
                        href={`/explorer?block=${block.id}`}
                        className="text-[#0d5c63] hover:underline font-semibold text-[11px]"
                      >
                        {t('overview.inspectEvidence', 'Inspect Map Evidence →')}
                      </Link>
                      <span className="text-text-muted">•</span>
                      <Link
                        href={`/risk-assessment?block=${block.id}`}
                        className="text-[#0d5c63] hover:underline font-semibold text-[11px]"
                      >
                        {t('overview.viewGss', 'View GSS Breakdown →')}
                      </Link>
                      <span className="text-text-muted">•</span>
                      <Link
                        href={`/interventions?block=${block.id}`}
                        className="text-[#0d5c63] hover:underline font-semibold text-[11px]"
                      >
                        {t('overview.prioritizeScheme', 'Prioritize Scheme →')}
                      </Link>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface border border-border rounded p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t('overview.monitoredBlocks', 'Monitored Blocks')}</span>
            <div className="p-1.5 rounded bg-subtle text-text-main">
              <MapPinIcon className="w-4 h-4 text-[#0d5c63]" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <div className="h-8 bg-subtle rounded w-24 animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold text-text-main tracking-tight">{filteredBlocks.length} {t('overview.blocksUnit', 'Blocks')}</div>
                <div className="flex items-center gap-2 text-xs mt-1 text-text-muted">
                  <span className="text-red-700 font-semibold">{severeCount} {t('severity.severe', 'Severe')}</span> •
                  <span className="text-amber-700 font-semibold">{watchCount} {t('severity.watch', 'Watch')}</span> •
                  <span className="text-emerald-700 font-semibold">{normalCount} {t('severity.normal', 'Normal')}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface border border-border rounded p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t('overview.graceAnomaly', 'GRACE Storage Anomaly')}</span>
            <div className="p-1.5 rounded bg-subtle text-water">
              <WaterDropletIcon className="w-4 h-4 text-[#1b4965]" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <div className="h-8 bg-subtle rounded w-20 animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanGraceTwsaCm, 'cm')}</div>
                <p className="text-xs text-text-muted mt-1">{t('overview.graceSubtext', `Mean GRACE TWSA across ${summary.total} blocks`)}</p>
              </>
            )}
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface border border-border rounded p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t('overview.rainfallDeficit', 'Monsoon Rainfall Deficit')}</span>
            <div className="p-1.5 rounded bg-subtle text-amber-700">
              <CloudRainIcon className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <div className="h-8 bg-subtle rounded w-20 animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanRainfallAnomalyMm, 'mm')}</div>
                <p className="text-xs text-text-muted mt-1">{t('overview.rainfallSubtext', 'Mean rainfall anomaly vs long-term normal')}</p>
              </>
            )}
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface border border-border rounded p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t('overview.wellDepth', 'CGWB Mean Well Depth')}</span>
            <div className="p-1.5 rounded bg-subtle text-text-main">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" />
            </div>
          </div>
          <div className="mt-3">
            {isLoading ? (
              <div className="h-8 bg-subtle rounded w-20 animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanWellDepthMbgl, 'm bgl')}</div>
                <p className="text-xs text-text-muted mt-1">{t('overview.wellSubtext', 'Average depth below ground across stations')}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Filterable Block Table & Evidence Overview */}
      <div className="bg-surface border border-border rounded p-6 shadow-sm space-y-4">
        {/* Controls Header with State & District Cascades */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> {t('overview.tableTitle', 'Block Evidence & Risk Directory')}
            </h2>
            <p className="text-xs text-text-muted">
              Select a state and district to filter groundwater observation indicators, ML scores, and telemetry status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* State Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted font-medium">State:</span>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="bg-subtle border border-border text-xs rounded-md px-2.5 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer"
              >
                <option value="all">All States (8 Monitored)</option>
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

            {/* District Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted font-medium">{t('explorer.districtFilter', 'District:')}</span>
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="bg-subtle border border-border text-xs rounded-md px-2.5 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer"
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

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted font-medium">{t('overview.riskLevelFilter', 'Risk Level:')}</span>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="bg-subtle border border-border text-xs rounded-md px-2.5 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer"
              >
                <option value="all">{t('overview.allSeverities', 'All Severity Levels')}</option>
                <option value="severe">{t('severity.severe', 'Severe Stress')}</option>
                <option value="watch">{t('severity.watch', 'Watch Advisory')}</option>
                <option value="normal">{t('severity.normal', 'Normal Baseline')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-subtle/60 text-[11px] font-semibold text-text-muted uppercase tracking-wider border-b border-border">
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Satellite Water Storage</th>
                <th className="py-3 px-4">Rainfall Deficit</th>
                <th className="py-3 px-4">Green Cover (Vegetation)</th>
                <th className="py-3 px-4">Well Water Depth</th>
                <th className="py-3 px-4">Water Stress Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-4 bg-subtle rounded w-24"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 bg-subtle rounded w-16"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 bg-subtle rounded w-16"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 bg-subtle rounded w-12"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 bg-subtle rounded w-16"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 bg-subtle rounded w-14"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 bg-subtle rounded w-16"></div></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-4 bg-subtle rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredBlocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-text-muted">
                    No monitored blocks found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredBlocks.map((block) => {
                  const isSevere = block.riskSeverity === 'severe';
                  const isWatch = block.riskSeverity === 'watch';
                  return (
                    <tr key={block.id} className="hover:bg-subtle/40 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-text-main">
                        <div className="font-semibold text-text-main">{block.name}</div>
                        <div className="text-[11px] text-text-muted">{block.districtName}, {block.state}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`font-medium ${block.indicators.graceTwsaCm !== null && block.indicators.graceTwsaCm < -6 ? 'text-red-700' : 'text-text-main'}`}>
                          {block.indicators.graceTwsaCm !== null ? `${block.indicators.graceTwsaCm} cm` : t('monitoring.noData', 'No Data')}
                        </span>
                        <div className="text-[10px] text-text-muted">Satellite scan</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`font-medium ${block.indicators.rainfallAnomalyMm !== null && block.indicators.rainfallAnomalyMm < -200 ? 'text-red-700' : 'text-amber-700'}`}>
                          {block.indicators.rainfallAnomalyMm !== null ? `${block.indicators.rainfallAnomalyMm} mm` : t('monitoring.noData', 'No Data')}
                        </span>
                        <div className="text-[10px] text-text-muted">Deficit vs normal</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-text-main">{block.indicators.sentinelNdvi !== null ? block.indicators.sentinelNdvi : t('monitoring.noData', 'No Data')}</span>
                        <div className="text-[10px] text-text-muted">Vegetation health</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-text-main">{block.indicators.cgwbWellDepthMbgl !== null ? `${block.indicators.cgwbWellDepthMbgl} m deep` : t('monitoring.noData', 'No Data')}</span>
                        <div className="text-[10px] text-text-muted">Trend: {block.indicators.wellDepthTrendMperYr !== null ? `${block.indicators.wellDepthTrendMperYr} m/yr` : 'Stable'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-text-main">
                            {block.assessment.descriptiveStressScore !== null ? `${block.assessment.descriptiveStressScore}/100` : t('monitoring.noData', 'No Data')}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            (Scale 0-100)
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isSevere
                              ? 'badge-severe'
                              : isWatch
                              ? 'badge-watch'
                              : 'badge-normal'
                          }`}
                        >
                          {isSevere ? 'High Alert' : isWatch ? 'Needs Monitoring' : 'Normal Water Level'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/explorer?block=${block.id}`}
                          className="text-[#0d5c63] hover:underline font-semibold text-xs"
                        >
                          {t('overview.inspectEvidence', 'Inspect Evidence →')}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scientific Safeguards and Methodology Disclaimer */}
      <div className="bg-subtle/60 border border-border rounded-lg p-5 text-xs text-text-muted space-y-2">
        <div className="flex items-center gap-2 font-bold text-text-main">
          <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" />
          <span>{t('overview.protocolTitle', 'Scientific Governance & Transparency Protocol')}</span>
        </div>
        <p className="leading-relaxed">
          <strong>Data Provenance Notice:</strong> All indicators are derived from verified Central Ground Water Board (CGWB) observation wells, National Water Informatics Centre telemetry, and satellite products across 8 active states (Madhya Pradesh, Uttar Pradesh, Punjab, Rajasthan, Haryana, Arunachal Pradesh, Sikkim, Assam). Missing observations are preserved as unavailable data and never fabricated.
        </p>
      </div>
    </div>
  );
}
