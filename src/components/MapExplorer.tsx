'use client';
import React, { useState, useEffect } from 'react';
import { BUNDELKHAND_DISTRICTS, ALL_BLOCKS } from '@/lib/data/bundelkhand';
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
  const [blocksData, setBlocksData] = useState<BlockData[]>([]);
  const [dataSourceInfo, setDataSourceInfo] = useState<{ source: string; isDemonstration: boolean; errorMessage?: string }>({
    source: 'demonstration_fixture',
    isDemonstration: true
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectedBlock, setSelectedBlock] = useState<BlockData>(
    ALL_BLOCKS.find((b) => b.id === initialBlockId) || ALL_BLOCKS[0]
  );
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
              source: json.source || 'demonstration_fixture',
              isDemonstration: json.isDemonstrationData ?? true,
              errorMessage: json.errorMessage
            });
            if (initialBlockId) {
              const matched = json.blocks.find((b: BlockData) => b.id === initialBlockId);
              if (matched) setSelectedBlock(matched);
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

  const filteredBlocks = blocksData.filter(
    (b) => selectedDistrictFilter === 'all' || b.districtId === selectedDistrictFilter
  );

  if (!isLoading && blocksData.length === 0) {
    return <div className="rounded-lg border border-border bg-surface p-8 text-center space-y-2">
      <h1 className="text-xl font-bold text-text-main">No approved historical records available</h1>
      <p className="text-sm text-text-muted">The CGWB/NWIC historical database is empty or unavailable. Demonstration fixtures are not shown automatically.</p>
      {dataSourceInfo.errorMessage && <p className="text-xs text-text-muted">{dataSourceInfo.errorMessage}</p>}
    </div>;
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              dataSourceInfo.source === 'live_database'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              SOURCE: {dataSourceInfo.source.toUpperCase().replace('_', ' ')}
            </span>
            {isLoading && <span className="text-xs text-text-muted">{t('monitoring.loading', 'Loading backend layers...')}</span>}
          </div>
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2 mt-1">
            <MapPinIcon className="w-5 h-5 text-[#0d5c63]" /> {t('explorer.title', 'Explore the Map')}
          </h1>
          <p className="text-xs text-text-muted mt-1">
            {t('explorer.subtitle', 'View groundwater and environmental information on the map')}
          </p>
        </div>

        {/* District Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted font-medium">{t('explorer.districtFilter', 'District:')}</span>
            <select
              value={selectedDistrictFilter}
              onChange={(e) => setSelectedDistrictFilter(e.target.value)}
              className="bg-subtle border border-border rounded-md px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer"
            >
              <option value="all">{t('explorer.allDistricts', 'All Pilot Districts')}</option>
              {BUNDELKHAND_DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.blocks.length} / {d.blocksCount})
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

            {/* GIS Leaflet Map Container */}
            <LeafletMap
              blocks={filteredBlocks}
              selectedBlockId={selectedBlock.id}
              activeLayer={activeLayer}
              onSelectBlock={setSelectedBlock}
            />
          </div>
        </div>

        {/* Right Column: Block Details Inspector Panel (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-surface border border-border rounded-lg p-4 sm:p-5 shadow-card space-y-4 sm:space-y-5 lg:sticky lg:top-24">
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
                <span className="font-bold text-[#0d5c63] text-sm shrink-0 ml-auto">{selectedBlock.assessment.descriptiveStressScore}/100</span>
              </div>
            </div>

            {/* Possible Contributing Factors & Safeguard Notice */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-main">{t('explorer.possibleDrivers', 'Possible Contributing Factors')}:</span>
              <p className="text-xs text-text-muted bg-surface p-2.5 rounded border border-border leading-relaxed">
                {selectedBlock.assessment.primaryStressDriver}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-text-main">{t('explorer.importantInfo', 'Important Information')}:</span>
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
                {t('explorer.suggestSolution', 'Suggest a Solution')} →
              </Link>
              <Link
                href={`/alerts?block=${selectedBlock.id}`}
                className="w-full bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold py-2 rounded-md flex items-center justify-center gap-2 transition-colors"
              >
                {t('explorer.previewAdvisory', 'Preview Advisory')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
