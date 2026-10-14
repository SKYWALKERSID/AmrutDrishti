'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BUNDELKHAND_DISTRICTS } from '@/lib/data/bundelkhand';
import {
  NATIONAL_CONTRAST_DISTRICTS,
  STATE_CONTRAST_GROUPS
} from '@/lib/data/nationalContrast';
import { ALL_INDIAN_STATES, IndianStateMeta } from '@/lib/data/indiaStates';
import { ALL_NATIONWIDE_DISTRICTS, mergeWithLiveBlocks } from '@/lib/data/allNationwideBlocks';
import { BlockData, DistrictData, RiskSeverity } from '@/lib/types';
import { WaterDropletIcon, MapPinIcon, ActivityChartIcon, FilterIcon, InfoIcon, CloudRainIcon } from '@/components/ui/Icons';
import Link from 'next/link';
import LeafletMap from '@/components/LeafletMap';
import { useLanguage } from '@/lib/context/LanguageContext';

interface MapExplorerProps {
  initialBlockId?: string;
}

// Helper to normalize state strings to match ALL_INDIAN_STATES canonical names
function normalizeStateName(stateName: string): string {
  if (!stateName) return '';
  const lower = stateName.toLowerCase().trim();
  if (lower.includes('uttar pradesh')) return 'Uttar Pradesh';
  if (lower.includes('madhya pradesh')) return 'Madhya Pradesh';
  if (lower.includes('punjab')) return 'Punjab';
  if (lower.includes('rajasthan')) return 'Rajasthan';
  if (lower.includes('haryana')) return 'Haryana';
  if (lower.includes('arunachal')) return 'Arunachal Pradesh';
  if (lower.includes('sikkim')) return 'Sikkim';
  if (lower.includes('assam')) return 'Assam';
  return stateName;
}

export default function MapExplorer({ initialBlockId }: MapExplorerProps) {
  const { t } = useLanguage();

  // Unified administrative selection: State -> District -> Block
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('all');

  // Live database blocks state
  const [liveBlocksData, setLiveBlocksData] = useState<BlockData[]>([]);
  const [dataSourceInfo, setDataSourceInfo] = useState<{ source: string; isDemonstration: boolean; errorMessage?: string }>({
    source: 'loading',
    isDemonstration: false
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Inspector & Map Layers
  const [selectedBlock, setSelectedBlock] = useState<BlockData | null>(null);
  const [activeLayer, setActiveLayer] = useState<'risk' | 'grace' | 'rainfall' | 'wells' | 'sentinel'>('risk');

  // 1. Fetch live database geospatial blocks on mount
  useEffect(() => {
    let active = true;
    async function loadGeospatialData() {
      try {
        const res = await fetch('/api/geospatial/blocks');
        if (res.ok && active) {
          const json = await res.json();
          if (json.blocks && Array.isArray(json.blocks)) {
            setLiveBlocksData(json.blocks);
            setDataSourceInfo({
              source: json.source || 'live_database',
              isDemonstration: json.isDemonstrationData ?? false,
              errorMessage: json.errorMessage
            });
          }
        }
      } catch (err) {
        console.warn('JalDrishti: Failed to fetch geospatial blocks API for MapExplorer:', err);
        if (active) setLiveBlocksData([]);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadGeospatialData();
    return () => {
      active = false;
    };
  }, []);

  // 2. Build the unified nationwide dataset using the verified scientific merge engine
  // Merging live database telemetry with empirical baseline indicators and dynamically computing GSS
  const allDistricts = useMemo<DistrictData[]>(() => {
    const mergedBlocks = mergeWithLiveBlocks(liveBlocksData);
    const blockMap = new Map<string, BlockData>();
    for (const b of mergedBlocks) {
      blockMap.set(b.id, b);
    }

    return ALL_NATIONWIDE_DISTRICTS.map(dist => {
      const canonicalState = normalizeStateName(dist.state);
      const updatedBlocks = dist.blocks.map(block => {
        const merged = blockMap.get(block.id);
        if (merged) {
          return { ...merged, state: canonicalState };
        }
        return { ...block, state: canonicalState };
      });

      return {
        ...dist,
        state: canonicalState,
        blocks: updatedBlocks
      };
    });
  }, [liveBlocksData]);

  // Flattened pool of all 60 monitored blocks across the 8 wired states
  const allBlocks = useMemo<BlockData[]>(() => {
    return allDistricts.flatMap(d => d.blocks);
  }, [allDistricts]);

  // Set initial selected block from initialBlockId prop if passed
  useEffect(() => {
    if (initialBlockId && allBlocks.length > 0) {
      const found = allBlocks.find(b => b.id === initialBlockId);
      if (found) {
        setSelectedBlock(found);
        setSelectedState(found.state);
        setSelectedDistrictId(found.districtId);
        setSelectedBlockId(found.id);
      }
    }
  }, [initialBlockId, allBlocks]);

  // 3. Cascading Dropdown Filter Options
  // Districts available under the current state selection
  const availableDistricts = useMemo<DistrictData[]>(() => {
    if (selectedState === 'all') {
      return allDistricts;
    }
    return allDistricts.filter(d => normalizeStateName(d.state) === selectedState);
  }, [allDistricts, selectedState]);

  // Blocks available under the current district / state selection
  const availableBlocks = useMemo<BlockData[]>(() => {
    if (selectedDistrictId !== 'all') {
      const dist = availableDistricts.find(d => d.id === selectedDistrictId);
      return dist ? dist.blocks : [];
    }
    if (selectedState !== 'all') {
      return availableDistricts.flatMap(d => d.blocks);
    }
    return allBlocks;
  }, [availableDistricts, selectedDistrictId, selectedState, allBlocks]);

  // Currently filtered blocks passed directly to the Leaflet GIS canvas
  const filteredBlocks = useMemo<BlockData[]>(() => {
    if (selectedBlockId !== 'all') {
      const single = availableBlocks.find(b => b.id === selectedBlockId);
      return single ? [single] : availableBlocks;
    }
    return availableBlocks;
  }, [availableBlocks, selectedBlockId]);

  // Keep selectedBlock in sync with user selections or fall back to first active block
  useEffect(() => {
    if (selectedBlockId !== 'all') {
      const match = availableBlocks.find(b => b.id === selectedBlockId);
      if (match) {
        setSelectedBlock(match);
        return;
      }
    }

    if (selectedBlock && filteredBlocks.some(b => b.id === selectedBlock.id)) {
      // Keep existing selection intact
      return;
    }

    if (filteredBlocks.length > 0) {
      setSelectedBlock(filteredBlocks[0]);
    } else {
      setSelectedBlock(null);
    }
  }, [filteredBlocks, selectedBlockId, availableBlocks]);

  // Handlers for strict cascading behavior: State -> District -> Block
  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    setSelectedDistrictId('all');
    setSelectedBlockId('all');

    if (newState === 'all') {
      if (allBlocks.length > 0) setSelectedBlock(allBlocks[0]);
    } else {
      const firstDist = allDistricts.find(d => normalizeStateName(d.state) === newState);
      if (firstDist && firstDist.blocks.length > 0) {
        setSelectedBlock(firstDist.blocks[0]);
      }
    }
  };

  const handleDistrictChange = (newDistrictId: string) => {
    setSelectedDistrictId(newDistrictId);
    setSelectedBlockId('all');

    if (newDistrictId === 'all') {
      if (availableBlocks.length > 0) setSelectedBlock(availableBlocks[0]);
    } else {
      const dist = availableDistricts.find(d => d.id === newDistrictId);
      if (dist && dist.blocks.length > 0) {
        setSelectedBlock(dist.blocks[0]);
      }
    }
  };

  const handleBlockChange = (newBlockId: string) => {
    setSelectedBlockId(newBlockId);
    if (newBlockId !== 'all') {
      const match = availableBlocks.find(b => b.id === newBlockId);
      if (match) setSelectedBlock(match);
    } else if (availableBlocks.length > 0) {
      setSelectedBlock(availableBlocks[0]);
    }
  };

  // When user clicks a circle on the Leaflet map directly
  const handleMapSelectBlock = (block: BlockData) => {
    setSelectedBlock(block);
    setSelectedState(normalizeStateName(block.state));
    setSelectedDistrictId(block.districtId);
    setSelectedBlockId(block.id);
  };

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

  return (
    <div className="space-y-5">
      {/* Top Header with Unified Geographic Cascading Controls */}
      <div className="bg-surface border border-border rounded p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-[#0d5c63]" /> {t('explorer.title', 'Explore the Map')}
          </h1>
          {isLoading && (
            <span className="text-xs text-text-muted">Loading layers...</span>
          )}
        </div>

        {/* Hierarchical Cascading Selectors: State -> District -> Block */}
        <div className="pt-3 border-t border-border/80 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-text-muted font-semibold">
            <FilterIcon className="w-3.5 h-3.5 text-[#0d5c63]" />
            <span>Select Geography:</span>
          </div>

          {/* 1. STATE SELECTOR (All 28 States & 8 UTs) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="state-select" className="text-text-muted font-medium">State:</label>
            <select
              id="state-select"
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="bg-subtle border border-border rounded-md px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer max-w-[220px]"
            >
              <option value="all">All Available States (8 Monitored)</option>
              <optgroup label="Active Monitored States (8)">
                {ALL_INDIAN_STATES.filter(s => s.hasData).map((st) => (
                  <option key={st.code} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Telemetry Ingestion Pending (28)">
                {ALL_INDIAN_STATES.filter(s => !s.hasData).map((st) => (
                  <option
                    key={st.code}
                    value={st.name}
                    disabled
                    className="text-gray-400 bg-gray-50 italic"
                  >
                    {st.name} (Telemetry Ingestion Pending)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 2. DISTRICT SELECTOR (Cascades based on selected State) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="district-select" className="text-text-muted font-medium">District:</label>
            <select
              id="district-select"
              value={selectedDistrictId}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={selectedState !== 'all' && availableDistricts.length === 0}
              className="bg-subtle border border-border rounded-md px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-[200px]"
            >
              <option value="all">
                {selectedState === 'all'
                  ? `All Districts (${allDistricts.length})`
                  : `All Districts in ${selectedState} (${availableDistricts.length})`}
              </option>
              {availableDistricts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {selectedState === 'all' ? `(${d.state})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. BLOCK SELECTOR (Cascades based on selected District) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="block-select" className="text-text-muted font-medium">Block:</label>
            <select
              id="block-select"
              value={selectedBlockId}
              onChange={(e) => handleBlockChange(e.target.value)}
              disabled={availableBlocks.length === 0}
              className="bg-subtle border border-border rounded-md px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-[200px]"
            >
              <option value="all">
                {selectedDistrictId === 'all'
                  ? `All Blocks (${availableBlocks.length})`
                  : `All Blocks in District (${availableBlocks.length})`}
              </option>
              {availableBlocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} Block
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Shortcut */}
          {(selectedState !== 'all' || selectedDistrictId !== 'all' || selectedBlockId !== 'all') && (
            <button
              onClick={() => {
                setSelectedState('all');
                setSelectedDistrictId('all');
                setSelectedBlockId('all');
                if (allBlocks.length > 0) setSelectedBlock(allBlocks[0]);
              }}
              className="text-[#0d5c63] hover:underline font-semibold text-xs ml-auto"
            >
              Reset to All India
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Layer Selector + Map + Evidence Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Map & Layer Controls (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Layer Selection Controls */}
          <div className="bg-surface border border-border rounded-lg p-2.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs font-semibold text-text-main flex items-center gap-1.5 shrink-0 px-1">
              <span>{t('explorer.activeLayer', 'Map View')}:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveLayer('risk')}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activeLayer === 'risk'
                    ? 'bg-[#0d5c63] text-white font-semibold shadow-xs'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.risk', 'Water Stress Status')}
              </button>
              <button
                onClick={() => setActiveLayer('wells')}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activeLayer === 'wells'
                    ? 'bg-[#0d5c63] text-white font-semibold shadow-xs'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.wells', 'Well Depth')}
              </button>
              <button
                onClick={() => setActiveLayer('rainfall')}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activeLayer === 'rainfall'
                    ? 'bg-[#0d5c63] text-white font-semibold shadow-xs'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.rainfall', 'Rainfall Difference')}
              </button>
              <button
                onClick={() => setActiveLayer('grace')}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activeLayer === 'grace'
                    ? 'bg-[#0d5c63] text-white font-semibold shadow-xs'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.grace', 'Satellite Water Storage')}
              </button>
              <button
                onClick={() => setActiveLayer('sentinel')}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activeLayer === 'sentinel'
                    ? 'bg-[#0d5c63] text-white font-semibold shadow-xs'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.sentinel', 'Green Cover')}
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
            {isLoading && (
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
                    No active observation blocks found for the selected administrative geography.
                  </p>
                </div>
              </div>
            )}

            {/* GIS Leaflet Map Container */}
            <LeafletMap
              blocks={filteredBlocks}
              selectedBlockId={selectedBlock?.id}
              activeLayer={activeLayer}
              onSelectBlock={handleMapSelectBlock}
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
                      <ActivityChartIcon className="w-3.5 h-3.5 text-[#0d5c63] shrink-0" /> <span className="truncate">Well Depth:</span>
                    </span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.cgwbWellDepthMbgl !== null ? `${selectedBlock.indicators.cgwbWellDepthMbgl} m deep` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted flex items-center gap-1 min-w-0">
                      <CloudRainIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" /> <span className="truncate">Rainfall Difference:</span>
                    </span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.rainfallAnomalyMm !== null ? `${selectedBlock.indicators.rainfallAnomalyMm} mm` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted flex items-center gap-1 min-w-0">
                      <WaterDropletIcon className="w-3.5 h-3.5 text-water shrink-0" /> <span className="truncate">Satellite Water Storage:</span>
                    </span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.graceTwsaCm !== null ? `${selectedBlock.indicators.graceTwsaCm} cm` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted truncate min-w-0">Green Cover (Vegetation):</span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.sentinelNdvi !== null ? selectedBlock.indicators.sentinelNdvi : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-border/60 pt-2 flex-wrap gap-1">
                    <span className="text-text-muted font-semibold">Water Stress Score:</span>
                    <span className="font-bold text-[#0d5c63] text-sm shrink-0 ml-auto">
                      {selectedBlock.assessment.descriptiveStressScore !== null ? `${selectedBlock.assessment.descriptiveStressScore}/100` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>
                </div>

                {/* Key Driver / Context */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-text-main">Contributing Factors:</span>
                  <p className="text-xs text-text-muted bg-surface p-2.5 rounded border border-border leading-relaxed">
                    {selectedBlock.assessment.primaryStressDriver || 'Normal seasonal conditions observed.'}
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
                  Click a monitoring block marker on the map or choose a block from the cascading menu to inspect observed telemetry.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regional Groundwater Profiles */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0d5c63]"></span>
              State Groundwater Profiles: High Stress vs Recharge Regions
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Groundwater status and extraction levels across monitored states. Click any state card to focus the map.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-100 text-red-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-600"></span> Over-Exploited Region
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Abundant / Safe Region
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STATE_CONTRAST_GROUPS.map((grp) => (
            <div
              key={grp.state}
              onClick={() => handleStateChange(grp.state)}
              className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                normalizeStateName(grp.state) === selectedState
                  ? 'ring-2 ring-[#0d5c63]'
                  : ''
              } ${
                grp.category === 'high_stress'
                  ? 'border-red-200 bg-red-50/40'
                  : 'border-emerald-200 bg-emerald-50/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      grp.category === 'high_stress'
                        ? 'bg-red-700 text-white'
                        : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {grp.category === 'high_stress' ? 'High Stress' : 'Water Secure'}
                  </span>
                  <h3 className="font-bold text-sm text-text-main">{grp.state}</h3>
                </div>
                <span className="text-[11px] text-text-muted">
                  {grp.districts.flatMap(d => d.blocks).length} blocks
                </span>
              </div>

              <p className="text-xs text-text-main mt-2 leading-relaxed line-clamp-3">
                {grp.summaryDescription}
              </p>

              <div className="mt-3 pt-2 border-t border-border/60 text-[11px] flex justify-between items-center">
                <span className="text-text-muted">
                  {grp.districts.length} districts monitored
                </span>
                <span className="text-[#0d5c63] font-semibold hover:underline">
                  Filter map to {grp.state} →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
