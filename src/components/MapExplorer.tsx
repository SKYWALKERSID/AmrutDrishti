'use client';

import React, { useState } from 'react';
import { BUNDELKHAND_DISTRICTS, ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { BlockData, RiskSeverity } from '@/lib/types';
import { WaterDropletIcon, MapPinIcon, ActivityChartIcon, FilterIcon, InfoIcon, CloudRainIcon } from '@/components/ui/Icons';
import Link from 'next/link';

interface MapExplorerProps {
  initialBlockId?: string;
}

export default function MapExplorer({ initialBlockId }: MapExplorerProps) {
  const [selectedBlock, setSelectedBlock] = useState<BlockData>(
    ALL_BLOCKS.find((b) => b.id === initialBlockId) || ALL_BLOCKS[0]
  );
  const [activeLayer, setActiveLayer] = useState<'risk' | 'grace' | 'rainfall' | 'wells' | 'sentinel'>('risk');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');

  const getSeverityBadgeClass = (severity: RiskSeverity) => {
    switch (severity) {
      case 'severe':
        return 'badge-severe';
      case 'watch':
        return 'badge-watch';
      case 'normal':
        return 'badge-normal';
      default:
        return 'badge-gap';
    }
  };

  const filteredBlocks = ALL_BLOCKS.filter(
    (b) => selectedDistrictFilter === 'all' || b.districtId === selectedDistrictFilter
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-[#0d5c63]" /> Geospatial Evidence Explorer
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Interactive multi-resolution environmental layer inspection for Bundelkhand Pilot Blocks.
          </p>
        </div>

        {/* District Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted font-medium">District:</span>
            <select
              value={selectedDistrictFilter}
              onChange={(e) => setSelectedDistrictFilter(e.target.value)}
              className="bg-subtle border border-border rounded-md px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none"
            >
              <option value="all">All Pilot Districts</option>
              {BUNDELKHAND_DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.blocksCount} Blocks)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Layer Selector + Map + Evidence Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Map & Layer Controls (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Layer Selection Buttons */}
          <div className="bg-surface border border-border rounded-lg p-3 shadow-card flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-text-main flex items-center gap-1.5">
              <span>Active Layer:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveLayer('risk')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeLayer === 'risk'
                    ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main'
                }`}
              >
                Groundwater Risk Status
              </button>
              <button
                onClick={() => setActiveLayer('grace')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeLayer === 'grace'
                    ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main'
                }`}
              >
                GRACE TWSA (1.0°)
              </button>
              <button
                onClick={() => setActiveLayer('rainfall')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeLayer === 'rainfall'
                    ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main'
                }`}
              >
                IMD Rainfall Anomaly (0.25°)
              </button>
              <button
                onClick={() => setActiveLayer('wells')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeLayer === 'wells'
                    ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main'
                }`}
              >
                CGWB Well Network (Point)
              </button>
              <button
                onClick={() => setActiveLayer('sentinel')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeLayer === 'sentinel'
                    ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main'
                }`}
              >
                Sentinel-2 NDVI (10m)
              </button>
            </div>
          </div>

          {/* Interactive Map Visualizer Canvas Container */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card relative h-[480px]">
            {/* Resolution & Layer Info Chip */}
            <div className="absolute top-3 left-3 z-10 bg-surface/95 backdrop-blur-sm border border-border rounded-md px-3 py-1.5 shadow-sm text-xs space-y-0.5">
              <div className="font-semibold text-text-main flex items-center gap-1.5">
                <InfoIcon className="w-3.5 h-3.5 text-[#0d5c63]" />
                {activeLayer === 'risk' && 'Groundwater Stress Score Layer'}
                {activeLayer === 'grace' && 'NASA GRACE-FO TWSA Layer (1.0° Spatial Grid)'}
                {activeLayer === 'rainfall' && 'IMD Monsoon Rainfall Anomaly (25km Grid)'}
                {activeLayer === 'wells' && 'CGWB Hydrograph Observation Wells'}
                {activeLayer === 'sentinel' && 'Sentinel-2 Surface Reflectance NDVI'}
              </div>
              <div className="text-[10px] text-text-muted">
                {activeLayer === 'grace' && 'Coarse regional mass anomaly (~100km). Not village-scale depth.'}
                {activeLayer === 'wells' && 'Direct measured groundwater level below ground level (m bgl).'}
                {activeLayer === 'rainfall' && 'Interpolated 30-year long period average deficit.'}
                {activeLayer === 'sentinel' && '10m resolution cloud-masked vegetation vigor index.'}
                {activeLayer === 'risk' && 'Aggregated multi-indicator evidence status.'}
              </div>
            </div>

            {/* GIS Grid Canvas */}
            <div className="w-full h-full bg-[#f4f2eb] relative p-4 flex flex-col justify-between">
              <div className="absolute inset-0 opacity-15 pointer-events-none grid grid-cols-6 grid-rows-6 border border-slate-300">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div key={i} className="border border-slate-400/40 text-[9px] p-1 text-slate-500 font-mono">
                    24.{(i % 6) * 2}°N, 78.{(Math.floor(i / 6)) * 2}°E
                  </div>
                ))}
              </div>

              {/* Block Features Container */}
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-3 mt-12 overflow-y-auto max-h-[380px] p-2">
                {filteredBlocks.map((block) => {
                  const isSelected = selectedBlock.id === block.id;
                  const isSevere = block.riskSeverity === 'severe';
                  const isWatch = block.riskSeverity === 'watch';

                  let bgStyle = 'bg-emerald-50 border-emerald-300 text-emerald-900';
                  if (activeLayer === 'risk') {
                    if (isSevere) bgStyle = 'bg-red-100 border-red-400 text-red-900 hover:bg-red-200';
                    else if (isWatch) bgStyle = 'bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200';
                    else bgStyle = 'bg-emerald-100 border-emerald-400 text-emerald-900 hover:bg-emerald-200';
                  } else if (activeLayer === 'grace') {
                    bgStyle = block.indicators.graceTwsaCm < -6
                      ? 'bg-red-100 border-red-400 text-red-900'
                      : 'bg-amber-100 border-amber-300 text-amber-900';
                  } else if (activeLayer === 'rainfall') {
                    bgStyle = block.indicators.rainfallAnomalyMm < -200
                      ? 'bg-red-100 border-red-400 text-red-900'
                      : 'bg-blue-100 border-blue-300 text-blue-900';
                  } else if (activeLayer === 'wells') {
                    bgStyle = block.indicators.cgwbWellDepthMbgl > 14
                      ? 'bg-red-100 border-red-400 text-red-900'
                      : 'bg-emerald-100 border-emerald-400 text-emerald-900';
                  }

                  return (
                    <button
                      key={block.id}
                      onClick={() => setSelectedBlock(block)}
                      className={`p-3 rounded-lg border text-left transition-all ${bgStyle} ${
                        isSelected ? 'ring-2 ring-[#0d5c63] ring-offset-2 font-bold shadow-md' : 'opacity-90'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{block.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 font-mono font-semibold">
                          {activeLayer === 'risk' && `${block.assessment.descriptiveStressScore}/100`}
                          {activeLayer === 'grace' && `${block.indicators.graceTwsaCm}cm`}
                          {activeLayer === 'rainfall' && `${block.indicators.rainfallAnomalyMm}mm`}
                          {activeLayer === 'wells' && `${block.indicators.cgwbWellDepthMbgl}m`}
                          {activeLayer === 'sentinel' && `NDVI ${block.indicators.sentinelNdvi}`}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-80 mt-1">
                        {block.districtName} • Lat {block.coordinates[0]}, Lng {block.coordinates[1]}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Map Legend Footer Bar */}
              <div className="relative z-10 bg-surface/95 border border-border rounded-md px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="font-semibold text-text-main">Map Legend:</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-600 inline-block"></span> Severe Stress / High Deficit
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Watch Advisory
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span> Normal Baseline
                  </span>
                </div>
                <span className="text-[10px] text-text-muted">Click any block to inspect evidence</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Block Evidence Inspector Panel (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-surface border border-border rounded-lg p-5 shadow-card space-y-5 sticky top-24">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Block Evidence Inspection
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${getSeverityBadgeClass(selectedBlock.riskSeverity)}`}>
                  {selectedBlock.riskSeverity.toUpperCase()}
                </span>
              </div>
              <h2 className="text-xl font-bold text-text-main mt-1">{selectedBlock.name} Block</h2>
              <p className="text-xs text-text-muted">
                {selectedBlock.districtName} District, {selectedBlock.state}
              </p>
            </div>

            {/* Key Indicators Grid */}
            <div className="space-y-3 bg-subtle/50 p-3.5 rounded-lg border border-border">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted flex items-center gap-1">
                  <WaterDropletIcon className="w-3.5 h-3.5 text-water" /> GRACE TWSA:
                </span>
                <span className="font-bold text-text-main">{selectedBlock.indicators.graceTwsaCm} cm</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted flex items-center gap-1">
                  <CloudRainIcon className="w-3.5 h-3.5 text-amber-600" /> Rainfall Deficit:
                </span>
                <span className="font-bold text-text-main">{selectedBlock.indicators.rainfallAnomalyMm} mm</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted flex items-center gap-1">
                  <ActivityChartIcon className="w-3.5 h-3.5 text-[#0d5c63]" /> CGWB Well Depth:
                </span>
                <span className="font-bold text-text-main">{selectedBlock.indicators.cgwbWellDepthMbgl} m bgl</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted">Sentinel-2 NDVI:</span>
                <span className="font-bold text-text-main">{selectedBlock.indicators.sentinelNdvi}</span>
              </div>

              <div className="flex justify-between items-center text-xs border-t border-border/60 pt-2">
                <span className="text-text-muted font-semibold">Descriptive Stress Score:</span>
                <span className="font-bold text-[#0d5c63] text-sm">{selectedBlock.assessment.descriptiveStressScore}/100</span>
              </div>
            </div>

            {/* Primary Stress Rationale & Safeguard */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-main">Primary Stress Driver:</span>
              <p className="text-xs text-text-muted bg-surface p-2.5 rounded border border-border leading-relaxed">
                {selectedBlock.assessment.primaryStressDriver}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-text-main">Methodology & Safeguard Notice:</span>
              <p className="text-[11px] text-text-muted bg-amber-50/60 border border-amber-200 p-2.5 rounded leading-relaxed">
                {selectedBlock.assessment.safeguardNotice}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Link
                href={`/interventions?block=${selectedBlock.id}`}
                className="w-full bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                Draft Intervention Proposal →
              </Link>
              <Link
                href={`/alerts?block=${selectedBlock.id}`}
                className="w-full bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold py-2 rounded-md flex items-center justify-center gap-2 transition-colors"
              >
                Preview Alert Advisory
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
