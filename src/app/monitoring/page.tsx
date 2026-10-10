'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ALL_BLOCKS } from '@/lib/data/bundelkhand';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { WaterDropletIcon, CloudRainIcon, ActivityChartIcon, FilterIcon, InfoIcon } from '@/components/ui/Icons';

import { MONITORING_SERIES_LABEL, MONITORING_RAINFALL_REFERENCE_LABEL } from '@/lib/demo/demoPolicy';

// SIMULATED demonstration series (2021 - 2026). One shared sample for ALL blocks; not block-specific, not measured.
const HISTORICAL_TIMESERIES = [
  { month: 'Oct 2021', graceTwsa: -1.2, rainfall: 840, wellDepth: 8.2, ndvi: 0.45, smap: 0.28 },
  { month: 'Oct 2022', graceTwsa: -2.4, rainfall: 790, wellDepth: 9.8, ndvi: 0.42, smap: 0.25 },
  { month: 'Oct 2023', graceTwsa: -4.1, rainfall: 680, wellDepth: 11.5, ndvi: 0.38, smap: 0.21 },
  { month: 'Oct 2024', graceTwsa: -5.3, rainfall: 710, wellDepth: 13.1, ndvi: 0.34, smap: 0.18 },
  { month: 'Oct 2025', graceTwsa: -6.1, rainfall: 620, wellDepth: 14.2, ndvi: 0.31, smap: 0.14 },
  { month: 'Oct 2026', graceTwsa: -7.2, rainfall: 580, wellDepth: 14.8, ndvi: 0.28, smap: 0.11 },
];

function MonitoringContent() {
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const [selectedBlockId, setSelectedBlockId] = useState<string>(ALL_BLOCKS[0].id);

  useEffect(() => {
    if (urlBlockParam) {
      const validBlock = ALL_BLOCKS.find(b => b.id === urlBlockParam);
      if (validBlock) {
        setSelectedBlockId(validBlock.id);
      }
    }
  }, [urlBlockParam]);

  const selectedBlock = ALL_BLOCKS.find(b => b.id === selectedBlockId) || ALL_BLOCKS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
            <ActivityChartIcon className="w-5 h-5 text-[#0d5c63]" /> Multi-Indicator Groundwater Stress Monitoring
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Compare multi-year satellite terrestrial water storage anomalies, rainfall trends, soil moisture, and CGWB well depths.
          </p>
        </div>

        {/* Block Switcher */}
        <div className="flex items-center gap-2 text-xs">
          <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
          <span className="font-semibold text-text-main">Select Block:</span>
          <select
            value={selectedBlockId}
            onChange={(e) => setSelectedBlockId(e.target.value)}
            className="bg-subtle border border-border rounded-md px-3 py-1.5 font-medium text-text-main focus:outline-none cursor-pointer"
          >
            {ALL_BLOCKS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.districtName}) — {b.riskSeverity.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conflicting Signals & Data Gap Warning */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-4 text-xs text-amber-900 flex items-start gap-3">
        <InfoIcon className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Multi-Scale Signal Inspection Notice:</span>
          <p className="leading-relaxed">
            Surface soil moisture (SMAP) and satellite vegetation index (Sentinel NDVI) measure topsoil layers (&lt;5cm).
            During brief rain spells, surface indicators may temporarily improve while deep hard-rock aquifer water table (CGWB well depth) continues to drop due to heavy irrigation pumping.
            Always evaluate long-term well hydrographs alongside satellite anomalies.
          </p>
        </div>
      </div>

      <div role="note" className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-xs text-amber-900 font-semibold">
        {MONITORING_SERIES_LABEL} Selected block: {selectedBlock.name}. Only the indicator matrix below uses that block's fixture values, which are also simulated.
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Well Depth (m bgl) vs GRACE TWSA */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
              <WaterDropletIcon className="w-4 h-4 text-water" /> Well Depth (m bgl) vs GRACE TWSA (cm)
            </h2>
            <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">SIMULATED • shared sample, not {selectedBlock.name} data</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={HISTORICAL_TIMESERIES} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d8" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e0d8', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="wellDepth" name="Well Depth (m bgl) — simulated" stroke="#b91c1c" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="graceTwsa" name="GRACE TWSA (cm)" stroke="#1b4965" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-text-muted">
            Higher well depth (m bgl) indicates a deeper, more depleted water table below ground level.
          </p>
        </div>

        {/* Chart 2: Annual Rainfall (mm) */}
        <div className="bg-surface border border-border rounded-lg p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
              <CloudRainIcon className="w-4 h-4 text-amber-600" /> Seasonal Monsoon Rainfall (mm) — simulated
            </h2>
            <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">SIMULATED • {MONITORING_RAINFALL_REFERENCE_LABEL}</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HISTORICAL_TIMESERIES} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d8" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e0d8', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="rainfall" name="Monsoon Rainfall (mm)" fill="#0d5c63" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-text-muted">
            Monsoon precipitation deficit directly limits seasonal hard-rock aquifer recharge in Bundelkhand.
          </p>
        </div>
      </div>

      {/* Detailed Indicator Matrix for Selected Block */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
        <h2 className="text-sm font-bold text-text-main">
          Current Indicator Matrix — {selectedBlock.name} Block ({selectedBlock.districtName})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-subtle/50 rounded-lg border border-border space-y-1">
            <span className="text-text-muted font-medium">NASA GRACE-FO TWSA</span>
            <div className="text-lg font-bold text-text-main">{selectedBlock.indicators.graceTwsaCm} cm</div>
            <p className="text-[11px] text-text-muted">Coarse satellite grid (1.0° resolution). Regional mass anomaly.</p>
          </div>

          <div className="p-4 bg-subtle/50 rounded-lg border border-border space-y-1">
            <span className="text-text-muted font-medium">IMD Rainfall Anomaly</span>
            <div className="text-lg font-bold text-amber-700">{selectedBlock.indicators.rainfallAnomalyMm} mm</div>
            <p className="text-[11px] text-text-muted">SPI 3-Month: {selectedBlock.indicators.spi3Month}. Gridded rain gauge deficit.</p>
          </div>

          <div className="p-4 bg-subtle/50 rounded-lg border border-border space-y-1">
            <span className="text-text-muted font-medium">CGWB Well Level (m bgl)</span>
            <div className="text-lg font-bold text-red-700">{selectedBlock.indicators.cgwbWellDepthMbgl} m bgl</div>
            <p className="text-[11px] text-text-muted">Trend: {selectedBlock.indicators.wellDepthTrendMperYr} m/yr drawdown rate.</p>
          </div>
        </div>
      </div>
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
