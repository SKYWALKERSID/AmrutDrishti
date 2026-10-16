'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ALL_INDIAN_STATES } from '@/lib/data/indiaStates';
import { ALL_NATIONWIDE_BLOCKS, ALL_NATIONWIDE_DISTRICTS, normalizeStateName, mergeWithLiveBlocks } from '@/lib/data/allNationwideBlocks';
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
        const combined = mergeWithLiveBlocks(liveBlocks);
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
      {/* Top Header */}
      <div className="bg-surface border border-border rounded p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mb-1.5">
            <span className="font-semibold text-text-main">
              National Groundwater Telemetry
            </span>
            <span>•</span>
            <span>Multi-Source Geospatial Monitoring</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
            Groundwater Overview & Telemetry Status
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-3xl leading-relaxed">
            Monitored observation units, satellite-derived storage anomalies, and ground telemetry for water security decision support.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/explorer"
            className="bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-2 rounded shadow-xs transition-colors flex items-center gap-2"
          >
            {t('overview.openGis', 'Open GIS Explorer')}
          </Link>
          <Link
            href="/interventions"
            className="bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold px-4 py-2 rounded transition-colors"
          >
            {t('overview.interventionsBtn', 'Interventions')} ({interventionCount})
          </Link>
        </div>
      </div>

      {/* Unified Telemetry Metric Strip */}
      <div className="bg-surface border border-border rounded p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* KPI 1 */}
          <div className="py-2 sm:py-0 sm:px-4 first:sm:pl-0">
            <span className="text-xs font-medium text-text-muted">{t('overview.monitoredBlocks', 'Monitored Blocks')}</span>
            <div className="mt-1.5">
              {isLoading ? (
                <div className="h-7 bg-subtle rounded w-24 animate-pulse"></div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
                    {filteredBlocks.length} <span className="text-xs font-normal text-text-muted">{t('overview.blocksUnit', 'Blocks')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] mt-0.5 text-text-muted">
                    <span className="text-red-700 font-semibold">{severeCount} {t('severity.severe', 'Severe')}</span> •
                    <span className="text-amber-700 font-semibold">{watchCount} {t('severity.watch', 'Watch')}</span> •
                    <span className="text-emerald-700 font-semibold">{normalCount} {t('severity.normal', 'Normal')}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* KPI 2 */}
          <div className="py-2 sm:py-0 sm:px-4">
            <span className="text-xs font-medium text-text-muted">{t('overview.graceAnomaly', 'Satellite Water Storage')}</span>
            <div className="mt-1.5">
              {isLoading ? (
                <div className="h-7 bg-subtle rounded w-20 animate-pulse"></div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanGraceTwsaCm, 'cm')}</div>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{t('overview.graceSubtext', `Mean GRACE TWSA anomaly`)}</p>
                </>
              )}
            </div>
          </div>

          {/* KPI 3 */}
          <div className="py-2 sm:py-0 sm:px-4">
            <span className="text-xs font-medium text-text-muted">{t('overview.rainfallDeficit', 'Monsoon Rainfall Deficit')}</span>
            <div className="mt-1.5">
              {isLoading ? (
                <div className="h-7 bg-subtle rounded w-20 animate-pulse"></div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanRainfallAnomalyMm, 'mm')}</div>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{t('overview.rainfallSubtext', 'Average monsoon deficit vs baseline')}</p>
                </>
              )}
            </div>
          </div>

          {/* KPI 4 */}
          <div className="py-2 sm:py-0 sm:px-4 last:sm:pr-0">
            <span className="text-xs font-medium text-text-muted">{t('overview.wellDepth', 'CGWB Mean Well Depth')}</span>
            <div className="mt-1.5">
              {isLoading ? (
                <div className="h-7 bg-subtle rounded w-20 animate-pulse"></div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanWellDepthMbgl, 'm bgl')}</div>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{t('overview.wellSubtext', 'Average water table depth below ground')}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* High Water Stress Blocks Section (Structured Priority Directory) */}
      <div className="bg-surface border border-border rounded p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-text-main tracking-tight">
              High Water Stress Priority Units
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {isLoading
                ? t('monitoring.loading', 'Loading live database...')
                : severeCount > 0
                ? `${severeCount} flagged of ${summary.total} monitored blocks requiring priority administrative attention`
                : `${displayBlocks.length} monitored blocks active`}
            </p>
          </div>
          <Link
            href="/risk-assessment"
            className="text-xs font-semibold text-[#0d5c63] hover:underline"
          >
            All Risk Scores & Methodology →
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2 pt-1 animate-pulse">
            <div className="h-10 bg-subtle rounded w-full"></div>
            <div className="h-10 bg-subtle rounded w-full"></div>
            <div className="h-10 bg-subtle rounded w-full"></div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-subtle/50 text-[11px] font-semibold text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="py-2.5 px-3">Administrative Block</th>
                  <th className="py-2.5 px-3">Severity & GSS Score</th>
                  <th className="py-2.5 px-3">Well Depth</th>
                  <th className="py-2.5 px-3">Rainfall Deficit</th>
                  <th className="py-2.5 px-3">Satellite TWSA</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(() => {
                  const severeBlocks = filteredBlocks.filter(b => b.riskSeverity === 'severe');
                  const watchBlocks = filteredBlocks.filter(b => b.riskSeverity === 'watch');
                  const priorityBlocks = severeBlocks.length > 0 
                    ? severeBlocks.slice(0, 6) 
                    : (watchBlocks.length > 0 ? watchBlocks.slice(0, 6) : filteredBlocks.slice(0, 6));

                  return priorityBlocks.map(block => {
                    const isSevere = block.riskSeverity === 'severe';
                    const isWatch = block.riskSeverity === 'watch';

                    return (
                      <tr key={block.id} className="hover:bg-subtle/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-text-main text-xs">{block.name} Block</div>
                          <div className="text-[11px] text-text-muted">{block.districtName} District, {block.state}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${isSevere ? 'text-red-700' : isWatch ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {block.assessment.descriptiveStressScore !== null ? `${block.assessment.descriptiveStressScore}/100` : t('monitoring.noData', 'No Data')}
                          </span>
                          <span className="block text-[10px] text-text-muted capitalize">
                            {block.riskSeverity} Priority
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-medium ${isSevere ? 'text-red-700 font-semibold' : 'text-text-main'}`}>
                            {block.indicators.cgwbWellDepthMbgl !== null ? `${block.indicators.cgwbWellDepthMbgl}m bgl` : t('monitoring.noData', 'No Data')}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-medium ${isSevere ? 'text-red-700 font-semibold' : 'text-text-main'}`}>
                            {block.indicators.rainfallAnomalyMm !== null ? `${block.indicators.rainfallAnomalyMm}mm` : t('monitoring.noData', 'No Data')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-text-main font-medium">
                          {block.indicators.graceTwsaCm !== null ? `${block.indicators.graceTwsaCm}cm` : t('monitoring.noData', 'No Data')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/explorer?block=${block.id}`}
                              className="text-[#0d5c63] hover:underline font-semibold text-[11px]"
                            >
                              {t('overview.inspectEvidence', 'Inspect Map →')}
                            </Link>
                            <span className="text-text-muted">•</span>
                            <Link
                              href={`/risk-assessment?block=${block.id}`}
                              className="text-[#0d5c63] hover:underline font-semibold text-[11px]"
                            >
                              {t('overview.viewGss', 'GSS →')}
                            </Link>
                            <span className="text-text-muted">•</span>
                            <Link
                              href={`/interventions?block=${block.id}`}
                              className="text-[#0d5c63] hover:underline font-semibold text-[11px]"
                            >
                              {t('overview.prioritizeScheme', 'Intervention →')}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Content Grid: Filterable Block Table & Evidence Overview */}
      <div className="bg-surface border border-border rounded p-6 shadow-sm space-y-4">
        {/* Controls Header with State & District Cascades */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-text-main">
              {t('overview.tableTitle', 'Block Evidence & Risk Directory')}
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
                          className={`font-semibold text-xs ${
                            isSevere
                              ? 'text-red-700'
                              : isWatch
                              ? 'text-amber-700'
                              : 'text-emerald-700'
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
    </div>
  );
}
