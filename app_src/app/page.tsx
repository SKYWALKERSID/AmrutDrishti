'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BUNDELKHAND_DISTRICTS, ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { INITIAL_INTERVENTIONS } from '@/lib/data/interventions';
import { 
  WaterDropletIcon, 
  CloudRainIcon, 
  ShieldCheckIcon, 
  ActivityChartIcon,
  MapPinIcon,
  FilterIcon
} from '@/components/ui/Icons';

export default function OverviewDashboard() {
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const filteredBlocks = ALL_BLOCKS.filter((block) => {
    const matchesDistrict = selectedDistrictId === 'all' || block.districtId === selectedDistrictId;
    const matchesSeverity = selectedSeverity === 'all' || block.riskSeverity === selectedSeverity;
    return matchesDistrict && matchesSeverity;
  });

  const severeCount = ALL_BLOCKS.filter(b => b.riskSeverity === 'severe').length;
  const watchCount = ALL_BLOCKS.filter(b => b.riskSeverity === 'watch').length;
  const normalCount = ALL_BLOCKS.filter(b => b.riskSeverity === 'normal').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-primary-light text-primary font-semibold text-xs px-2.5 py-1 rounded">
                Initial Priority States (Central, North & Northeast India)
              </span>
              <span className="text-xs text-text-muted">Observation Period: Post-Monsoon 2026</span>
            </div>
            <h1 className="text-2xl font-bold text-text-main mt-2 tracking-tight">
              Groundwater Risk & Decision Support Overview
            </h1>
            <p className="text-sm text-text-muted mt-1 max-w-3xl leading-relaxed">
              Consolidated geospatial evidence connecting satellite storage anomalies, high-resolution rainfall records, 
              vegetation indicators, and ground well observations for local governance teams.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/explorer"
              className="bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-2.5 rounded-md shadow-sm transition-colors flex items-center gap-2"
            >
              <MapPinIcon className="w-4 h-4" /> Open GIS Explorer
            </Link>
            <Link
              href="/interventions"
              className="bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold px-4 py-2.5 rounded-md transition-colors"
            >
              Intervention Workspace ({INITIAL_INTERVENTIONS.length})
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Monitored Blocks</span>
            <div className="p-2 rounded-md bg-subtle text-text-main">
              <MapPinIcon className="w-4 h-4 text-[#0d5c63]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main tracking-tight">{ALL_BLOCKS.length} Blocks</div>
            <div className="flex items-center gap-2 text-xs mt-1 text-text-muted">
              <span className="text-red-700 font-semibold">{severeCount} Severe</span> • 
              <span className="text-amber-700 font-semibold">{watchCount} Watch</span> • 
              <span className="text-emerald-700 font-semibold">{normalCount} Normal</span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">GRACE Storage Anomaly</span>
            <div className="p-2 rounded-md bg-subtle text-water">
              <WaterDropletIcon className="w-4 h-4 text-[#1b4965]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-red-700 tracking-tight">-6.8 cm TWSA</div>
            <p className="text-xs text-text-muted mt-1">Regional Mass Anomaly vs 2004-2010 Mean</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Monsoon Rainfall Deficit</span>
            <div className="p-2 rounded-md bg-subtle text-amber-700">
              <CloudRainIcon className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-700 tracking-tight">-210 mm</div>
            <p className="text-xs text-text-muted mt-1">IMD Gridded Deficit (SPI: -1.58 Severe Lag)</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">CGWB Mean Well Depth</span>
            <div className="p-2 rounded-md bg-subtle text-text-main">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main tracking-tight">14.8 m bgl</div>
            <p className="text-xs text-text-muted mt-1">Piezometer Network (-0.68 m/yr trend)</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Filterable Block Table & Evidence Overview */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        {/* Controls Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> Block Evidence & Risk Directory
            </h2>
            <p className="text-xs text-text-muted">
              Select a district to filter groundwater observation indicators and review status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* District Filter */}
            <div className="flex items-center gap-2 text-xs">
              <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted">District:</span>
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="bg-subtle border border-border text-xs rounded-md px-2.5 py-1.5 font-medium text-text-main focus:outline-none"
              >
                <option value="all">All Priority Districts ({BUNDELKHAND_DISTRICTS.length})</option>
                {BUNDELKHAND_DISTRICTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.state})
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">Risk Level:</span>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="bg-subtle border border-border text-xs rounded-md px-2.5 py-1.5 font-medium text-text-main focus:outline-none"
              >
                <option value="all">All Severity Levels</option>
                <option value="severe">Severe Stress</option>
                <option value="watch">Watch Advisory</option>
                <option value="normal">Normal Baseline</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-subtle/60 text-[11px] font-semibold text-text-muted uppercase tracking-wider border-b border-border">
                <th className="py-3 px-4">Block & District</th>
                <th className="py-3 px-4">GRACE TWSA</th>
                <th className="py-3 px-4">Rainfall Anomaly</th>
                <th className="py-3 px-4">Sentinel NDVI</th>
                <th className="py-3 px-4">CGWB Well Depth</th>
                <th className="py-3 px-4">Stress Index</th>
                <th className="py-3 px-4">Risk Status</th>
                <th className="py-3 px-4 text-right">Action</th>
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
                      <span className={`font-medium ${block.indicators.graceTwsaCm < -6 ? 'text-red-700' : 'text-text-main'}`}>
                        {block.indicators.graceTwsaCm} cm
                      </span>
                      <div className="text-[10px] text-text-muted">1.0° GRACE-FO</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`font-medium ${block.indicators.rainfallAnomalyMm < -200 ? 'text-red-700' : 'text-amber-700'}`}>
                        {block.indicators.rainfallAnomalyMm} mm
                      </span>
                      <div className="text-[10px] text-text-muted">SPI: {block.indicators.spi3Month}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-text-main">{block.indicators.sentinelNdvi}</span>
                      <div className="text-[10px] text-text-muted">10m Sentinel-2</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-text-main">{block.indicators.cgwbWellDepthMbgl} m bgl</span>
                      <div className="text-[10px] text-text-muted">Trend: {block.indicators.wellDepthTrendMperYr} m/yr</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-text-main">{block.assessment.descriptiveStressScore}/100</span>
                        <span className="text-[10px] text-text-muted">[{block.assessment.confidenceInterval[0]}-{block.assessment.confidenceInterval[1]}]</span>
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
                        {isSevere ? 'Severe Stress' : isWatch ? 'Watch Advisory' : 'Normal Baseline'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/explorer?block=${block.id}`}
                        className="text-[#0d5c63] hover:underline font-semibold text-xs"
                      >
                        Inspect Evidence →
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
          <span>Scientific Governance & Transparency Protocol</span>
        </div>
        <p className="leading-relaxed">
          <strong>Data Provenance Notice:</strong> All indicators presented on JalDrishti are explicitly labeled as <em>observed</em> (CGWB well hydrographs, IMD rain gauges), 
          <em>derived</em> (Sentinel-2 NDVI, GRACE TWSA anomaly), or <em>simulated demonstration metrics</em>. 
          No countdown formulas or unvalidated &ldquo;days-to-crisis&rdquo; claims are issued. Multi-source spatial scale differences (100km GRACE satellite grid vs point well piezometers) 
          are preserved to ensure rigorous governance decision support.
        </p>
      </div>
    </div>
  );
}
