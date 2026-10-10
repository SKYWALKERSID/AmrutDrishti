'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BUNDELKHAND_DISTRICTS, ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { INITIAL_INTERVENTIONS } from '@/lib/data/interventions';
import { summarizeBlocks, SIMULATED_DATA_LABEL } from '@/lib/demo/demoPolicy';
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

  const filteredBlocks = ALL_BLOCKS.filter((block) => {
    const matchesDistrict = selectedDistrictId === 'all' || block.districtId === selectedDistrictId;
    const matchesSeverity = selectedSeverity === 'all' || block.riskSeverity === selectedSeverity;
    return matchesDistrict && matchesSeverity;
  });

  const summary = summarizeBlocks(ALL_BLOCKS);
  const severeCount = summary.severe;
  const watchCount = summary.watch;
  const normalCount = summary.normal;
  const fmt = (v: number | null, unit: string) => (v === null ? t('monitoring.noData', 'No Data') : `${v} ${unit}`);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-primary-light text-primary font-semibold text-xs px-2.5 py-1 rounded">
                {t('overview.pilotRecords', `Pilot demonstration records: ${summary.total} blocks in ${summary.districtCount} districts (Bundelkhand, MP/UP)`)}
              </span>
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                {t('overview.uiPrototype', `UI PROTOTYPE — ${SIMULATED_DATA_LABEL}`)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-text-main mt-2 tracking-tight">
              {t('overview.title')}
            </h1>
            <p className="text-sm text-text-muted mt-1 max-w-3xl leading-relaxed">
              {t('overview.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/explorer"
              className="bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-2.5 rounded-md shadow-sm transition-colors flex items-center gap-2"
            >
              <MapPinIcon className="w-4 h-4" /> {t('overview.openGis')}
            </Link>
            <Link
              href="/interventions"
              className="bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold px-4 py-2.5 rounded-md transition-colors"
            >
              {t('overview.interventionsBtn')} ({interventionCount})
            </Link>
          </div>
        </div>
      </div>

      {/* High-Priority Flagged Risk Section */}
      <div className="bg-red-50/70 border border-red-200 rounded-lg p-5 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base font-bold text-red-950 tracking-tight">
            {t('overview.severeTitle')}
          </h2>
          <span className="text-xs text-red-800 font-medium">
            {t('overview.severeSubtext', `${severeCount} of ${summary.total} fixture blocks labelled Severe`)}
          </span>
        </div>
        <p className="text-xs text-red-900 leading-relaxed font-normal">
          {t('overview.severeDisclaimer')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {ALL_BLOCKS.filter(b => b.riskSeverity === 'severe').map(block => (
            <div key={block.id} className="bg-surface border border-red-200 rounded-md p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-text-main text-sm">{block.name} Block</h3>
                  <span className="text-text-muted text-[11px]">{block.districtName} District, {block.state}</span>
                </div>
                <span className="badge-severe text-[10px] font-bold px-2 py-0.5 rounded">
                  GSS: {block.assessment.descriptiveStressScore}/100
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] bg-subtle/40 p-2 rounded border border-border">
                <div>
                  <span className="text-text-muted block text-[10px]">{t('layer.wells', 'Well Depth')}</span>
                  <span className="font-bold text-red-700">{block.indicators.cgwbWellDepthMbgl !== null ? `${block.indicators.cgwbWellDepthMbgl}m bgl` : t('monitoring.noData', 'No Data')}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px]">{t('layer.rainfall', 'Rain Deficit')}</span>
                  <span className="font-bold text-amber-700">{block.indicators.rainfallAnomalyMm !== null ? `${block.indicators.rainfallAnomalyMm}mm` : t('monitoring.noData', 'No Data')}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px]">{t('layer.grace', 'GRACE TWSA')}</span>
                  <span className="font-bold text-text-main">{block.indicators.graceTwsaCm !== null ? `${block.indicators.graceTwsaCm}cm` : t('monitoring.noData', 'No Data')}</span>
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
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t('overview.monitoredBlocks', 'Monitored Blocks')}</span>
            <div className="p-2 rounded-md bg-subtle text-text-main">
              <MapPinIcon className="w-4 h-4 text-[#0d5c63]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main tracking-tight">{ALL_BLOCKS.length} {t('overview.blocksUnit', 'Blocks')}</div>
            <div className="flex items-center gap-2 text-xs mt-1 text-text-muted">
              <span className="text-red-700 font-semibold">{severeCount} {t('severity.severe', 'Severe')}</span> •
              <span className="text-amber-700 font-semibold">{watchCount} {t('severity.watch', 'Watch')}</span> •
              <span className="text-emerald-700 font-semibold">{normalCount} {t('severity.normal', 'Normal')}</span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t('overview.graceAnomaly', 'GRACE Storage Anomaly')}</span>
            <div className="p-2 rounded-md bg-subtle text-water">
              <WaterDropletIcon className="w-4 h-4 text-[#1b4965]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-red-700 tracking-tight">{fmt(summary.meanGraceTwsaCm, 'cm')}</div>
            <p className="text-xs text-text-muted mt-1">{t('overview.graceSubtext', `Mean of fixture GRACE TWSA values across ${summary.total} blocks (SIMULATED)`)}</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t('overview.rainfallDeficit', 'Monsoon Rainfall Deficit')}</span>
            <div className="p-2 rounded-md bg-subtle text-amber-700">
              <CloudRainIcon className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tracking-tight">{fmt(summary.meanRainfallAnomalyMm, 'mm')}</div>
            <p className="text-xs text-text-muted mt-1">{t('overview.rainfallSubtext', 'Mean of fixture rainfall anomalies (SIMULATED)')}</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t('overview.wellDepth', 'CGWB Mean Well Depth')}</span>
            <div className="p-2 rounded-md bg-subtle text-text-main">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main tracking-tight">{fmt(summary.meanWellDepthMbgl, 'm bgl')}</div>
            <p className="text-xs text-text-muted mt-1">{t('overview.wellSubtext', 'Mean of fixture well depths (SIMULATED)')}</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Filterable Block Table & Evidence Overview */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
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
                <th className="py-3 px-4">{t('overview.colBlockDistrict', 'Block & District')}</th>
                <th className="py-3 px-4">{t('overview.colGrace', 'GRACE TWSA')}</th>
                <th className="py-3 px-4">{t('overview.colRainfall', 'Rainfall Anomaly')}</th>
                <th className="py-3 px-4">{t('overview.colSentinel', 'Sentinel NDVI')}</th>
                <th className="py-3 px-4">{t('overview.colWellDepth', 'CGWB Well Depth')}</th>
                <th className="py-3 px-4">{t('overview.colStressIndex', 'Stress Index')}</th>
                <th className="py-3 px-4">{t('overview.colRiskStatus', 'Risk Status')}</th>
                <th className="py-3 px-4 text-right">{t('overview.colAction', 'Action')}</th>
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
                      <div className="text-[10px] text-text-muted">1.0° GRACE-FO</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`font-medium ${(block.indicators.rainfallAnomalyMm ?? 0) < -200 ? 'text-red-700' : 'text-amber-700'}`}>
                        {block.indicators.rainfallAnomalyMm !== null ? `${block.indicators.rainfallAnomalyMm} mm` : t('monitoring.noData', 'No Data')}
                      </span>
                      <div className="text-[10px] text-text-muted">SPI: {block.indicators.spi3Month ?? 'N/A'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-text-main">{block.indicators.sentinelNdvi ?? t('monitoring.noData', 'No Data')}</span>
                      <div className="text-[10px] text-text-muted">10m Sentinel-2</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-text-main">{block.indicators.cgwbWellDepthMbgl !== null ? `${block.indicators.cgwbWellDepthMbgl} m bgl` : t('monitoring.noData', 'No Data')}</span>
                      <div className="text-[10px] text-text-muted">Trend: {block.indicators.wellDepthTrendMperYr !== null ? `${block.indicators.wellDepthTrendMperYr} m/yr` : 'N/A'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-text-main">{block.assessment.descriptiveStressScore}/100</span>
                        <span className="text-[10px] text-text-muted">
                          {block.assessment.confidenceInterval
                            ? `[${block.assessment.confidenceInterval[0]}-${block.assessment.confidenceInterval[1]}]`
                            : '[Uncalibrated]'}
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
                        {isSevere ? t('severity.severe', 'Severe Stress') : isWatch ? t('severity.watch', 'Watch Advisory') : t('severity.normal', 'Normal Baseline')}
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
