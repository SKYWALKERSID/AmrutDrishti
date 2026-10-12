'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BUNDELKHAND_DISTRICTS, ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { INITIAL_INTERVENTIONS } from '@/lib/data/interventions';
import { summarizeBlocks, SIMULATED_DATA_LABEL } from '@/lib/demo/demoPolicy';
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
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [interventionCount, setInterventionCount] = useState<number>(INITIAL_INTERVENTIONS.length);
  const [blocksData, setBlocksData] = useState<BlockData[]>([]);
  const [dataSourceInfo, setDataSourceInfo] = useState<{ source: string; isDemonstration: boolean }>({
    source: 'demonstration_fixture',
    isDemonstration: true
  });

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

  useEffect(() => {
    let active = true;
    async function loadGeospatialData() {
      try {
        const res = await fetch('/api/geospatial/blocks');
        if (res.ok && active) {
          const json = await res.json();
          if (json.blocks && Array.isArray(json.blocks) && json.blocks.length > 0) {
            setBlocksData(json.blocks);
            setDataSourceInfo({
              source: json.source || 'live_database',
              isDemonstration: json.isDemonstrationData ?? false
            });
            return;
          }
        }
      } catch (err) {
        console.warn('JalDrishti: Failed to fetch geospatial blocks API for Overview:', err);
      }
      if (active) {
        setBlocksData(ALL_BLOCKS);
        setDataSourceInfo({
          source: 'demonstration_fixture',
          isDemonstration: true
        });
      }
    }
    loadGeospatialData();
    return () => {
      active = false;
    };
  }, []);

  const displayBlocks = blocksData.length > 0 ? blocksData : ALL_BLOCKS;
  const filteredBlocks = displayBlocks.filter((block) => {
    const matchesDistrict = selectedDistrictId === 'all' || block.districtId === selectedDistrictId;
    const matchesSeverity = selectedSeverity === 'all' || block.riskSeverity === selectedSeverity;
    return matchesDistrict && matchesSeverity;
  });

  const summary = summarizeBlocks(displayBlocks);
  const severeCount = summary.severe;
  const watchCount = summary.watch;
  const normalCount = summary.normal;
  const fmt = (v: number | null, unit: string) => (v === null ? t('monitoring.noData', 'No Data') : `${v} ${unit}`);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span className="font-semibold text-text-main">
                Pilot Geography: Bundelkhand Region ({summary.districtCount} Districts, {summary.total} Blocks)
              </span>
              <span>•</span>
              <span>CGWB Observation Network Active</span>
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

      {/* Flagged Water Security Monitoring Section */}
      <div className="bg-surface border border-border rounded p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-text-main tracking-tight flex items-center gap-2">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> Priority Groundwater Monitoring Units
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Field observation stations indicating high drawdown in hard-rock aquifers.
            </p>
          </div>
          <span className="text-xs text-text-muted font-medium bg-subtle px-2 py-0.5 rounded border border-border">
            {severeCount > 0 ? `${severeCount} flagged of ${summary.total} monitored blocks` : `${displayBlocks.length} monitored blocks active`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {(() => {
            const severeBlocks = displayBlocks.filter(b => b.riskSeverity === 'severe');
            const watchBlocks = displayBlocks.filter(b => b.riskSeverity === 'watch');
            // Show severe blocks if any; otherwise show watch or first active monitored blocks
            const priorityBlocks = severeBlocks.length > 0 
              ? severeBlocks 
              : (watchBlocks.length > 0 ? watchBlocks : displayBlocks.slice(0, 4));

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
                        GSS: {block.assessment.descriptiveStressScore}/100
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
            <div className="text-2xl font-bold text-text-main tracking-tight">{displayBlocks.length} {t('overview.blocksUnit', 'Blocks')}</div>
            <div className="flex items-center gap-2 text-xs mt-1 text-text-muted">
              <span className="text-red-700 font-semibold">{severeCount} {t('severity.severe', 'Severe')}</span> •
              <span className="text-amber-700 font-semibold">{watchCount} {t('severity.watch', 'Watch')}</span> •
              <span className="text-emerald-700 font-semibold">{normalCount} {t('severity.normal', 'Normal')}</span>
            </div>
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
            <div className="text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanGraceTwsaCm, 'cm')}</div>
            <p className="text-xs text-text-muted mt-1">{t('overview.graceSubtext', `Mean GRACE TWSA across ${summary.total} blocks`)}</p>
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
            <div className="text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanRainfallAnomalyMm, 'mm')}</div>
            <p className="text-xs text-text-muted mt-1">{t('overview.rainfallSubtext', 'Mean rainfall anomaly vs long-term normal')}</p>
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
            <div className="text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanWellDepthMbgl, 'm bgl')}</div>
            <p className="text-xs text-text-muted mt-1">{t('overview.wellSubtext', 'Average depth below ground across stations')}</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Filterable Block Table & Evidence Overview */}
      <div className="bg-surface border border-border rounded p-6 shadow-sm space-y-4">
        {/* Controls Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> {t('overview.tableTitle', 'Block Evidence & Risk Directory')}
            </h2>
            <p className="text-xs text-text-muted">
              {t('overview.tableSubtitle', 'Select a district to filter groundwater observation indicators and review status.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* District Filter */}
            <div className="flex items-center gap-2 text-xs">
              <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted">{t('explorer.districtFilter', 'District:')}</span>
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="bg-subtle border border-border text-xs rounded-md px-2.5 py-1.5 font-medium text-text-main focus:outline-none"
              >
                <option value="all">{t('explorer.allDistricts', 'All Pilot Districts')} ({BUNDELKHAND_DISTRICTS.length})</option>
                {BUNDELKHAND_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.state})
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">{t('overview.riskLevelFilter', 'Risk Level:')}</span>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="bg-subtle border border-border text-xs rounded-md px-2.5 py-1.5 font-medium text-text-main focus:outline-none"
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
              {filteredBlocks.map((block) => {
                const isSevere = block.riskSeverity === 'severe';
                const isWatch = block.riskSeverity === 'watch';
                return (
                  <tr key={block.id} className="hover:bg-subtle/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-text-main">
                      <div className="font-semibold text-text-main">{block.name}</div>
                      <div className="text-[11px] text-text-muted">{block.districtName}, {block.state}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`font-medium ${(block.indicators.graceTwsaCm ?? 0) < -6 ? 'text-red-700' : 'text-text-main'}`}>
                        {block.indicators.graceTwsaCm !== null ? `${block.indicators.graceTwsaCm} cm` : t('monitoring.noData', 'No Data')}
                      </span>
                      <div className="text-[10px] text-text-muted">Satellite scan</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`font-medium ${(block.indicators.rainfallAnomalyMm ?? 0) < -200 ? 'text-red-700' : 'text-amber-700'}`}>
                        {block.indicators.rainfallAnomalyMm !== null ? `${block.indicators.rainfallAnomalyMm} mm` : t('monitoring.noData', 'No Data')}
                      </span>
                      <div className="text-[10px] text-text-muted">Deficit vs normal</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-text-main">{block.indicators.sentinelNdvi ?? t('monitoring.noData', 'No Data')}</span>
                      <div className="text-[10px] text-text-muted">Vegetation health</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-text-main">{block.indicators.cgwbWellDepthMbgl !== null ? `${block.indicators.cgwbWellDepthMbgl} m deep` : t('monitoring.noData', 'No Data')}</span>
                      <div className="text-[10px] text-text-muted">Trend: {block.indicators.wellDepthTrendMperYr !== null ? `${block.indicators.wellDepthTrendMperYr} m/yr` : 'Stable'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-text-main">{block.assessment.descriptiveStressScore}/100</span>
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
              })}
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
          <strong>Data Provenance Notice:</strong> {t('overview.protocolNotice', 'This is a UI prototype. Every indicator value, score and severity class on this page is a simulated demonstration fixture.')}
        </p>
      </div>
    </div>
  );
}
