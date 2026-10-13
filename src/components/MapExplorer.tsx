'use client';
import React, { useState, useEffect } from 'react';
import { BUNDELKHAND_DISTRICTS, ALL_BLOCKS } from '@/lib/data/bundelkhand';
import {
  NATIONAL_CONTRAST_DISTRICTS,
  ALL_CONTRAST_BLOCKS,
  HIGH_STRESS_STATE_DISTRICTS,
  LOW_STRESS_STATE_DISTRICTS,
  STATE_CONTRAST_GROUPS
} from '@/lib/data/nationalContrast';
import { BlockData, RiskSeverity } from '@/lib/types';
import { WaterDropletIcon, MapPinIcon, ActivityChartIcon, FilterIcon, InfoIcon, CloudRainIcon } from '@/components/ui/Icons';
import Link from 'next/link';
import LeafletMap from '@/components/LeafletMap';
import { useLanguage } from '@/lib/context/LanguageContext';

interface MapExplorerProps {
  initialBlockId?: string;
}

export default function MapExplorer({ initialBlockId }: MapExplorerProps) {
  const { t } = useLanguage();
  const [mapScope, setMapScope] = useState<'bundelkhand' | 'contrast'>('bundelkhand');
  const [contrastCategoryFilter, setContrastCategoryFilter] = useState<'all' | 'high_stress' | 'low_stress'>('all');
  const [blocksData, setBlocksData] = useState<BlockData[]>([]);
  const [dataSourceInfo, setDataSourceInfo] = useState<{ source: string; isDemonstration: boolean; errorMessage?: string }>({
    source: 'loading',
    isDemonstration: false
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectedBlock, setSelectedBlock] = useState<BlockData | null>(null);
  const [activeLayer, setActiveLayer] = useState<'risk' | 'grace' | 'rainfall' | 'wells' | 'sentinel'>('risk');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');

  useEffect(() => {
    let active = true;
    async function loadGeospatialData() {
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
            if (initialBlockId) {
              const matched = json.blocks.find((b: BlockData) => b.id === initialBlockId);
              if (matched) setSelectedBlock(matched);
              else if (json.blocks.length > 0) setSelectedBlock(json.blocks[0]);
            } else if (json.blocks.length > 0) {
              setSelectedBlock(json.blocks[0]);
            }
          }
        }
      } catch (err) {
        console.warn('JalDrishti: Failed to fetch geospatial blocks API for MapExplorer:', err);
        if (active) setBlocksData([]);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadGeospatialData();
    return () => {
      active = false;
    };
  }, [initialBlockId]);

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

  const getSeverityText = (severity: RiskSeverity) => {
    switch (severity) {
      case 'severe':
        return t('severity.severe', 'High Concern');
      case 'watch':
        return t('severity.watch', 'Needs Checking');
      case 'normal':
        return t('severity.normal', 'No Flag in Sample Data');
      default:
        return severity.toUpperCase();
    }
  };

  // Switch between Bundelkhand Pilot and National Contrast datasets without fixture fallback
  const activeScopeBlocks: BlockData[] =
    mapScope === 'bundelkhand'
      ? blocksData
      : (
        contrastCategoryFilter === 'high_stress'
          ? HIGH_STRESS_STATE_DISTRICTS.flatMap(d => d.blocks)
          : contrastCategoryFilter === 'low_stress'
            ? LOW_STRESS_STATE_DISTRICTS.flatMap(d => d.blocks)
            : ALL_CONTRAST_BLOCKS
      );

  const activeScopeDistricts =
    mapScope === 'bundelkhand'
      ? BUNDELKHAND_DISTRICTS
      : (
        contrastCategoryFilter === 'high_stress'
          ? HIGH_STRESS_STATE_DISTRICTS
          : contrastCategoryFilter === 'low_stress'
            ? LOW_STRESS_STATE_DISTRICTS
            : NATIONAL_CONTRAST_DISTRICTS
      );

  const filteredBlocks = activeScopeBlocks.filter(
    (b) => selectedDistrictFilter === 'all' || b.districtId === selectedDistrictFilter
  );

  useEffect(() => {
    if (mapScope === 'contrast') {
      if (!selectedBlock || !filteredBlocks.some(b => b.id === selectedBlock.id)) {
        if (filteredBlocks.length > 0) setSelectedBlock(filteredBlocks[0]);
      }
    } else {
      if (filteredBlocks.length > 0) {
        if (!selectedBlock || !filteredBlocks.some(b => b.id === selectedBlock.id)) {
          setSelectedBlock(filteredBlocks[0]);
        }
      } else if (!isLoading) {
        setSelectedBlock(null);
      }
    }
  }, [filteredBlocks, mapScope, isLoading]);

  return (
    <div className="space-y-5">
      {/* Top Header with Scope Switcher */}
      <div className="bg-surface border border-border rounded p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="font-semibold text-text-main">
              {mapScope === 'bundelkhand'
                ? 'Bundelkhand Spatial Hydrology Layers'
                : 'National Comparative Hydrology (Most vs Least Water Scarcity)'}
            </span>
            <span>•</span>
            <span>Multi-Criteria Overlays</span>
            {isLoading && mapScope === 'bundelkhand' && (
              <span className="text-text-muted">({t('monitoring.loading', 'Loading backend layers...')})</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2 mt-1">
            <MapPinIcon className="w-5 h-5 text-[#0d5c63]" /> {t('explorer.title', 'Explore the Map')}
          </h1>
          <p className="text-xs text-text-muted mt-1">
            {mapScope === 'bundelkhand'
              ? t('explorer.subtitle', 'View groundwater and environmental information on the map')
              : 'Direct comparative assessment between severe Red Zones (Punjab, Rajasthan, Haryana) and secure water basins (Arunachal Pradesh, Sikkim, Assam).'}
          </p>
        </div>

        {/* Scope and Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Scope Toggle Button */}
          <div className="flex items-center bg-subtle border border-border rounded-md p-0.5 text-xs">
            <button
              onClick={() => {
                setMapScope('bundelkhand');
                setSelectedDistrictFilter('all');
                setSelectedBlock(blocksData.length > 0 ? blocksData[0] : null);
              }}
              className={`px-3 py-1.5 rounded font-medium text-xs transition-colors ${
                mapScope === 'bundelkhand'
                  ? 'bg-[#0d5c63] text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t('explorer.scopeBundelkhand', 'Bundelkhand Pilot (12 Blocks)')}
            </button>
            <button
              onClick={() => {
                setMapScope('contrast');
                setSelectedDistrictFilter('all');
                setSelectedBlock(ALL_CONTRAST_BLOCKS[0]);
              }}
              className={`px-3 py-1.5 rounded font-medium text-xs transition-colors ${
                mapScope === 'contrast'
                  ? 'bg-[#0d5c63] text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {t('explorer.scopeContrast', 'National Contrast (30 Blocks)')}
            </button>
          </div>

          {/* Contrast Sub-category Filter (Only in contrast mode) */}
          {mapScope === 'contrast' && (
            <select
              value={contrastCategoryFilter}
              onChange={(e) => {
                const val = e.target.value as 'all' | 'high_stress' | 'low_stress';
                setContrastCategoryFilter(val);
                setSelectedDistrictFilter('all');
                if (val === 'high_stress') {
                  setSelectedBlock(HIGH_STRESS_STATE_DISTRICTS[0].blocks[0]);
                } else if (val === 'low_stress') {
                  setSelectedBlock(LOW_STRESS_STATE_DISTRICTS[0].blocks[0]);
                }
              }}
              className="bg-subtle border border-border rounded-md px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer"
            >
              <option value="all">{t('explorer.contrastAll', 'All 6 States (16 High / 14 Low)')}</option>
              <option value="high_stress">{t('explorer.contrastHighStress', 'Top 3 High Stress (Punjab, Rajasthan, Haryana)')}</option>
              <option value="low_stress">{t('explorer.contrastLowStress', 'Top 3 Low Stress (Arunachal, Sikkim, Assam)')}</option>
            </select>
          )}

          {/* District Filter */}
          <div className="flex items-center gap-2 text-xs">
            <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted font-medium">{t('explorer.districtFilter', 'District:')}</span>
            <select
              value={selectedDistrictFilter}
              onChange={(e) => {
                setSelectedDistrictFilter(e.target.value);
                if (e.target.value !== 'all') {
                  const targetDist = activeScopeDistricts.find(d => d.id === e.target.value);
                  if (targetDist && targetDist.blocks.length > 0) {
                    setSelectedBlock(targetDist.blocks[0]);
                  }
                }
              }}
              className="bg-subtle border border-border rounded-md px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer"
            >
              <option value="all">
                {mapScope === 'bundelkhand' ? t('explorer.allDistricts', 'All Pilot Districts') : 'All Districts'}
              </option>
              {activeScopeDistricts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.state})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Consolidated Sample Data Notice Banner */}
      <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
        <InfoIcon className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold">
            {t('explorer.sampleNotice', 'Sample data — these values are for demonstration only and are not verified groundwater measurements.')}
          </span>
        </div>
      </div>

      {/* Main Grid: Layer Selector + Map + Evidence Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Map & Layer Controls (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Layer Selection Buttons */}
          <div className="bg-surface border border-border rounded-lg p-3 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs font-semibold text-text-main flex items-center gap-1.5 shrink-0">
              <span>{t('explorer.activeLayer', 'Map Information')}:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveLayer('risk')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-medium transition-colors ${activeLayer === 'risk'
                  ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                  : 'bg-subtle hover:bg-subtle/80 text-text-main'
                  }`}
              >
                {t('layer.risk', 'Groundwater Status')}
              </button>
              <button
                onClick={() => setActiveLayer('grace')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-medium transition-colors ${activeLayer === 'grace'
                  ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                  : 'bg-subtle hover:bg-subtle/80 text-text-main'
                  }`}
              >
                {t('layer.grace', 'Satellite Water Storage Estimate')}
              </button>
              <button
                onClick={() => setActiveLayer('rainfall')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-medium transition-colors ${activeLayer === 'rainfall'
                  ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                  : 'bg-subtle hover:bg-subtle/80 text-text-main'
                  }`}
              >
                {t('layer.rainfall', 'Rainfall Difference')}
              </button>
              <button
                onClick={() => setActiveLayer('wells')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-medium transition-colors ${activeLayer === 'wells'
                  ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                  : 'bg-subtle hover:bg-subtle/80 text-text-main'
                  }`}
              >
                {t('layer.wells', 'Groundwater Monitoring Wells')}
              </button>
              <button
                onClick={() => setActiveLayer('sentinel')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-medium transition-colors ${activeLayer === 'sentinel'
                  ? 'bg-[#0d5c63] text-white shadow-sm font-semibold'
                  : 'bg-subtle hover:bg-subtle/80 text-text-main'
                  }`}
              >
                {t('layer.sentinel', 'Satellite Vegetation Information')}
              </button>
            </div>
          </div>

          {/* Interactive Map Visualizer Canvas Container */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card relative h-[380px] sm:h-[480px]">
            {/* Layer Info Chip */}
            <div className="absolute top-3 left-3 z-10 bg-surface/95 backdrop-blur-sm border border-border rounded-md px-3 py-1.5 shadow-sm text-xs space-y-0.5 max-w-[calc(100%-1.5rem)] sm:max-w-sm">
              <div className="font-semibold text-text-main flex items-center gap-1.5">
                <InfoIcon className="w-3.5 h-3.5 text-[#0d5c63] shrink-0" />
                {activeLayer === 'risk' && t('layer.risk', 'Groundwater Status')}
                {activeLayer === 'grace' && t('layer.grace', 'Satellite Water Storage Estimate')}
                {activeLayer === 'rainfall' && t('layer.rainfall', 'Rainfall Difference')}
                {activeLayer === 'wells' && t('layer.wells', 'Groundwater Monitoring Wells')}
                {activeLayer === 'sentinel' && t('layer.sentinel', 'Satellite Vegetation Information')}
              </div>
              <div className="text-[10px] text-text-muted leading-tight">
                {activeLayer === 'risk' && t('explorer.riskInfo', 'Sample multi-indicator groundwater stress status.')}
                {activeLayer === 'grace' && t('explorer.graceInfo', 'Broad regional water-storage estimate (~100km). Not a direct groundwater measurement in an individual block.')}
                {activeLayer === 'rainfall' && t('explorer.rainfallInfo', 'Monsoon rainfall difference compared to long-period average (mm).')}
                {activeLayer === 'wells' && t('explorer.wellsInfo', 'Direct measured groundwater level below ground level (m bgl).')}
                {activeLayer === 'sentinel' && t('explorer.sentinelInfo', 'Satellite vegetation vigor index (NDVI).')}
              </div>
            </div>

            {/* Map Loading & Empty Overlays */}
            {isLoading && mapScope === 'bundelkhand' && (
              <div className="absolute inset-0 z-20 bg-surface/50 backdrop-blur-[1px] flex items-center justify-center">
                <div className="bg-surface border border-border px-4 py-2 rounded shadow-md text-xs font-medium text-text-main flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-[#0d5c63] border-t-transparent rounded-full animate-spin"></div>
                  {t('monitoring.loading', 'Loading verified geospatial layers...')}
                </div>
              </div>
            )}
            {!isLoading && filteredBlocks.length === 0 && (
              <div className="absolute inset-0 z-20 bg-surface/85 flex items-center justify-center p-6 text-center">
                <div className="max-w-sm space-y-2">
                  <p className="font-semibold text-sm text-text-main">No Observation Units Found</p>
                  <p className="text-xs text-text-muted">
                    {dataSourceInfo.errorMessage || 'No published geospatial units are currently available for this selection.'}
                  </p>
                </div>
              </div>
            )}

            {/* GIS Leaflet Map Container */}
            <LeafletMap
              blocks={filteredBlocks}
              selectedBlockId={selectedBlock?.id}
              activeLayer={activeLayer}
              onSelectBlock={setSelectedBlock}
            />
          </div>
        </div>

        {/* Right Column: Block Details Inspector Panel (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-surface border border-border rounded-lg p-4 sm:p-5 shadow-card space-y-4 sm:space-y-5 lg:sticky lg:top-24">
            {isLoading ? (
              <div className="space-y-4 animate-pulse" data-testid="map-inspector-loading">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-subtle rounded w-28"></div>
                  <div className="h-4 bg-subtle rounded w-16"></div>
                </div>
                <div className="h-6 bg-subtle rounded w-3/4"></div>
                <div className="h-4 bg-subtle rounded w-1/2"></div>
                <div className="space-y-3 bg-subtle/50 p-3.5 rounded-lg border border-border">
                  <div className="h-4 bg-subtle rounded w-full"></div>
                  <div className="h-4 bg-subtle rounded w-full"></div>
                  <div className="h-4 bg-subtle rounded w-full"></div>
                  <div className="h-4 bg-subtle rounded w-full"></div>
                  <div className="h-5 bg-subtle rounded w-1/2 pt-2 border-t border-border/60"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 bg-subtle rounded w-1/3"></div>
                  <div className="h-12 bg-subtle rounded"></div>
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="h-9 bg-subtle rounded"></div>
                  <div className="h-8 bg-subtle rounded"></div>
                </div>
              </div>
            ) : selectedBlock ? (
              <>
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      {t('explorer.blockDetails', 'Block Details')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${getSeverityBadgeClass(selectedBlock.riskSeverity)}`}>
                      {getSeverityText(selectedBlock.riskSeverity)}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-text-main mt-1">{selectedBlock.name} Block</h2>
                  <p className="text-xs text-text-muted">
                    {selectedBlock.districtName} District, {selectedBlock.state}
                  </p>
                </div>

                {/* Key Indicators Grid */}
                <div className="space-y-3 bg-subtle/50 p-3 sm:p-3.5 rounded-lg border border-border">
                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted flex items-center gap-1 min-w-0">
                      <WaterDropletIcon className="w-3.5 h-3.5 text-water shrink-0" /> <span className="truncate">{t('layer.grace', 'Satellite Water Storage Estimate')}:</span>
                    </span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.graceTwsaCm !== null ? `${selectedBlock.indicators.graceTwsaCm} cm` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted flex items-center gap-1 min-w-0">
                      <CloudRainIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" /> <span className="truncate">{t('layer.rainfall', 'Rainfall Difference')}:</span>
                    </span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.rainfallAnomalyMm !== null ? `${selectedBlock.indicators.rainfallAnomalyMm} mm` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted flex items-center gap-1 min-w-0">
                      <ActivityChartIcon className="w-3.5 h-3.5 text-[#0d5c63] shrink-0" /> <span className="truncate">{t('layer.wells', 'Groundwater Monitoring Wells')}:</span>
                    </span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.cgwbWellDepthMbgl !== null ? `${selectedBlock.indicators.cgwbWellDepthMbgl} m bgl` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted truncate min-w-0">{t('layer.sentinel', 'Satellite Vegetation Information')}:</span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.sentinelNdvi !== null ? selectedBlock.indicators.sentinelNdvi : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-border/60 pt-2 flex-wrap gap-1">
                    <span className="text-text-muted font-semibold">{t('explorer.sampleStressScore', 'Sample Stress Score')}:</span>
                    <span className="font-bold text-[#0d5c63] text-sm shrink-0 ml-auto">
                      {selectedBlock.assessment.descriptiveStressScore !== null ? `${selectedBlock.assessment.descriptiveStressScore}/100` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>
                </div>

                {/* Possible Contributing Factors & Safeguard Notice */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-text-main">{t('explorer.possibleDrivers', 'Possible Contributing Factors')}:</span>
                  <p className="text-xs text-text-muted bg-surface p-2.5 rounded border border-border leading-relaxed">
                    {selectedBlock.assessment.primaryStressDriver || 'No primary stress driver recorded.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-text-main">{t('explorer.importantInfo', 'Important Information')}:</span>
                  <p className="text-[11px] text-text-muted bg-amber-50/60 border border-amber-200 p-2.5 rounded leading-relaxed">
                    {selectedBlock.assessment.safeguardNotice || 'Groundwater data derived from empirical observation feeds.'}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Link
                    href={`/interventions?block=${selectedBlock.id}`}
                    className="w-full bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    {t('explorer.suggestSolution', 'Suggest a Solution')} →
                  </Link>
                  <Link
                    href={`/alerts?block=${selectedBlock.id}`}
                    className="w-full bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold py-2 rounded-md flex items-center justify-center gap-2 transition-colors"
                  >
                    {t('explorer.previewAdvisory', 'Preview Advisory')}
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-xs text-text-muted space-y-2" data-testid="map-inspector-empty">
                <p className="font-semibold text-sm text-text-main">No Unit Selected</p>
                <p>
                  {mapScope === 'bundelkhand' && blocksData.length === 0
                    ? 'No published geospatial units are currently available from the database.'
                    : 'Click a monitoring block marker on the map to inspect observed telemetry and indicators.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* State-by-State Comparative Analysis Matrix (Active in Contrast Mode) */}
      {mapScope === 'contrast' && (
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0d5c63]"></span>
                Comparative State Hydrology: Top 3 Most Stressed vs Top 3 Least Stressed
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Side-by-side contrast of dynamic sub-surface groundwater extraction, aquifer geology, and recharge mechanisms.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-100 text-red-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-red-600"></span> High Stress (Over-Exploited)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Low Stress (Safe & Surplus)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STATE_CONTRAST_GROUPS.map((grp) => (
              <div
                key={grp.state}
                className={`p-4 rounded-lg border transition-all ${
                  grp.category === 'high_stress'
                    ? 'border-red-200 bg-red-50/40'
                    : 'border-emerald-200 bg-emerald-50/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        grp.category === 'high_stress'
                          ? 'bg-red-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      #{grp.cpiRank} {grp.category === 'high_stress' ? 'Most Scarce' : 'Least Scarce'}
                    </span>
                    <h3 className="font-bold text-sm text-text-main">{grp.state}</h3>
                  </div>
                  <span className="text-[11px] text-text-muted">
                    {grp.districts.flatMap(d => d.blocks).length} blocks monitored
                  </span>
                </div>

                <p className="text-xs text-text-main mt-2.5 leading-relaxed">
                  {grp.summaryDescription}
                </p>

                <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] space-y-1">
                  <div className="flex items-start gap-1">
                    <span className="font-semibold text-text-muted shrink-0">Geological Setting:</span>
                    <span className="text-text-main">{grp.geologicalContext}</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="font-semibold text-text-muted shrink-0">Monitored Blocks:</span>
                    <span className="text-text-main font-medium">
                      {grp.districts.flatMap(d => d.blocks.map(b => b.name)).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
