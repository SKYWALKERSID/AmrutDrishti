'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import contrastProjectionsData from '@/lib/data/contrastProjections.json';

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
  // Districts available under the current state selection (Alphabetical Order)
  const availableDistricts = useMemo<DistrictData[]>(() => {
    let list = allDistricts;
    if (selectedState !== 'all') {
      list = allDistricts.filter(d => normalizeStateName(d.state) === selectedState);
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [allDistricts, selectedState]);

  // Blocks available under the current district / state selection (Alphabetical Order)
  const availableBlocks = useMemo<BlockData[]>(() => {
    let list: BlockData[] = [];
    if (selectedDistrictId !== 'all') {
      const dist = availableDistricts.find(d => d.id === selectedDistrictId);
      list = dist ? dist.blocks : [];
    } else if (selectedState !== 'all') {
      list = availableDistricts.flatMap(d => d.blocks);
    } else {
      list = allBlocks;
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
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
      <div className="bg-surface border border-border p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
            <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
              <MapPinIcon className="w-5 h-5 text-primary" /> {t('explorer.title', 'Explore the Map')}*
            </h1>
            <span aria-hidden="true">•</span>
            <span>8 Monitored States (60 Blocks)</span>
            <span aria-hidden="true">•</span>
            <span>Observation Cutoff: 2026-10-12</span>
          </div>
          {isLoading && (
            <span className="text-xs text-text-muted">Loading layers...</span>
          )}
        </div>

        {/* Hierarchical Cascading Selectors: State -> District -> Block */}
        <div className="pt-3 border-t border-border/80 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-text-muted font-semibold">
            <FilterIcon className="w-3.5 h-3.5 text-primary" />
            <span>Select Geography:</span>
          </div>

          {/* 1. STATE SELECTOR (All 28 States & 8 UTs) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="state-select" className="text-text-muted font-medium">State:</label>
            <select
              id="state-select"
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="bg-subtle border border-border px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer max-w-[220px]"
            >
              <option value="all">All Available States (8 Monitored)</option>
              <optgroup label="Active Monitored States (8)">
                {[...ALL_INDIAN_STATES.filter(s => s.hasData)]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((st) => (
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
              className="bg-subtle border border-border px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-[200px]"
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
              className="bg-subtle border border-border px-2.5 py-1.5 font-medium text-xs text-text-main focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-[200px]"
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
              className="text-primary hover:underline font-semibold text-xs ml-auto"
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
          <div className="bg-surface border border-border p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs font-semibold text-text-main flex items-center gap-1.5 shrink-0 px-1">
              <span>{t('explorer.activeLayer', 'Map View')}:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveLayer('risk')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  activeLayer === 'risk'
                    ? 'bg-primary text-text-inverted font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.risk', 'Water Stress Status')}
              </button>
              <button
                onClick={() => setActiveLayer('wells')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  activeLayer === 'wells'
                    ? 'bg-primary text-text-inverted font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.wells', 'Well Depth')}
              </button>
              <button
                onClick={() => setActiveLayer('rainfall')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  activeLayer === 'rainfall'
                    ? 'bg-primary text-text-inverted font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.rainfall', 'Rainfall Difference')}
              </button>
              <button
                onClick={() => setActiveLayer('grace')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  activeLayer === 'grace'
                    ? 'bg-primary text-text-inverted font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.grace', 'Satellite Water Storage')}
              </button>
              <button
                onClick={() => setActiveLayer('sentinel')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  activeLayer === 'sentinel'
                    ? 'bg-primary text-text-inverted font-semibold'
                    : 'bg-subtle hover:bg-subtle/80 text-text-main font-medium'
                }`}
              >
                {t('layer.sentinel', 'Green Cover')}
              </button>
            </div>
          </div>

          {/* Interactive Map Visualizer Canvas Container */}
          <div className="bg-surface border border-border overflow-hidden relative isolate h-[500px] sm:h-[620px] w-full">
            {/* Layer Info Chip */}
            <div className="absolute top-3 left-3 z-10 bg-surface border border-border px-3 py-1.5 text-xs space-y-0.5 max-w-[calc(100%-1.5rem)] sm:max-w-sm">
              <div className="font-semibold text-text-main flex items-center gap-1.5">
                <InfoIcon className="w-3.5 h-3.5 text-primary shrink-0" />
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
              <div className="absolute inset-0 z-20 bg-surface/70 flex items-center justify-center">
                <div className="bg-surface border border-border px-4 py-2 rounded text-xs font-medium text-text-main flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
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
          <div className="bg-surface border border-border rounded p-4 sm:p-5 space-y-4 sm:space-y-5 lg:sticky lg:top-24">
            {isLoading ? (
              <div className="space-y-4 animate-pulse" data-testid="map-inspector-loading">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-subtle w-28"></div>
                  <div className="h-4 bg-subtle w-16"></div>
                </div>
                <div className="h-6 bg-subtle w-3/4"></div>
                <div className="h-4 bg-subtle w-1/2"></div>
                <div className="space-y-3 bg-subtle/50 p-3.5 border border-border">
                  <div className="h-4 bg-subtle w-full"></div>
                  <div className="h-4 bg-subtle w-full"></div>
                  <div className="h-4 bg-subtle w-full"></div>
                  <div className="h-4 bg-subtle w-full"></div>
                  <div className="h-5 bg-subtle w-1/2 pt-2 border-t border-border/60"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 bg-subtle w-1/3"></div>
                  <div className="h-12 bg-subtle"></div>
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="h-9 bg-subtle"></div>
                  <div className="h-8 bg-subtle"></div>
                </div>
              </div>
            ) : selectedBlock ? (
              <>
                {/* Header with sequential cascading selectors: State -> District -> Block */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      {t('explorer.blockDetails', 'Block Details')}
                    </span>
                    <span className={`text-xs font-bold ${
                      selectedBlock.riskSeverity === 'severe'
                        ? 'text-red-700'
                        : selectedBlock.riskSeverity === 'watch'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}>
                      {getSeverityText(selectedBlock.riskSeverity)}
                    </span>
                  </div>

                  {/* Sequential Cascading Selectors */}
                  <div className="space-y-2 pt-1 border-t border-border/70">
                    {/* 1. First: Select State */}
                    <div>
                      <label htmlFor="inspector-state-select" className="block text-[11px] font-medium text-text-muted mb-0.5">
                        1. Select State:
                      </label>
                      <select
                        id="inspector-state-select"
                        value={selectedState}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className="w-full bg-subtle border border-border px-2.5 py-1.5 text-xs font-medium text-text-main focus:outline-none cursor-pointer"
                      >
                        <option value="all">All Monitored States ({ALL_INDIAN_STATES.filter(s => s.hasData).length})</option>
                        <optgroup label="Active Monitored States">
                          {[...ALL_INDIAN_STATES.filter(s => s.hasData)]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((st) => (
                              <option key={st.code} value={st.name}>
                                {st.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* 2. Second: Select District */}
                    <div>
                      <label htmlFor="inspector-district-select" className="block text-[11px] font-medium text-text-muted mb-0.5">
                        2. Select District:
                      </label>
                      <select
                        id="inspector-district-select"
                        value={selectedDistrictId}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        disabled={selectedState !== 'all' && availableDistricts.length === 0}
                        className="w-full bg-subtle border border-border px-2.5 py-1.5 text-xs font-medium text-text-main focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="all">
                          {selectedState === 'all'
                            ? `All Districts (${availableDistricts.length})`
                            : `All Districts in ${selectedState} (${availableDistricts.length})`}
                        </option>
                        {availableDistricts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {selectedState === 'all' ? `(${d.state})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Third: Select Block (Alphabetical Order) */}
                    <div>
                      <label htmlFor="inspector-block-select" className="block text-[11px] font-medium text-text-muted mb-0.5">
                        3. Select Block (A-Z):
                      </label>
                      <select
                        id="inspector-block-select"
                        value={selectedBlock.id}
                        onChange={(e) => handleBlockChange(e.target.value)}
                        disabled={availableBlocks.length === 0}
                        className="w-full bg-subtle border border-border px-2.5 py-1.5 text-xs font-semibold text-text-main focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {availableBlocks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} Block {selectedDistrictId === 'all' ? `(${b.districtName}, ${b.state})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-border/70 space-y-1.5">
                    <h2 className="text-lg font-bold text-text-main">{selectedBlock.name} Block</h2>
                    <p className="text-xs text-text-muted">
                      {selectedBlock.districtName} District, {selectedBlock.state}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap text-[11px] text-text-muted">
                      <span>Observed: <strong className="text-text-main font-medium">{selectedBlock.indicators.lastUpdatedDate || '2026-10-12'}</strong></span>
                      <span aria-hidden="true">•</span>
                      <span>Quality: <strong className="uppercase text-text-main font-medium">{selectedBlock.indicators.dataQualityFlag}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Key Indicators List - Clean, no cream background or borders */}
                <div className="space-y-2.5 py-1">
                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted">Well Depth:</span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.cgwbWellDepthMbgl !== null ? `${selectedBlock.indicators.cgwbWellDepthMbgl} m deep` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted">Rainfall Difference:</span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.rainfallAnomalyMm !== null ? `${selectedBlock.indicators.rainfallAnomalyMm} mm` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted">Satellite Water Storage:</span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.graceTwsaCm !== null ? `${selectedBlock.indicators.graceTwsaCm} cm` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs flex-wrap gap-1 min-w-0">
                    <span className="text-text-muted">Green Cover (Vegetation):</span>
                    <span className="font-bold text-text-main shrink-0 ml-auto">
                      {selectedBlock.indicators.sentinelNdvi !== null ? selectedBlock.indicators.sentinelNdvi : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-border/80 pt-2 flex-wrap gap-1">
                    <span className="text-text-muted font-semibold">Water Stress Score:</span>
                    <span className="font-bold text-primary text-sm shrink-0 ml-auto">
                      {selectedBlock.assessment.descriptiveStressScore !== null ? `${selectedBlock.assessment.descriptiveStressScore}/100` : t('monitoring.noData', 'No Data')}
                    </span>
                  </div>
                </div>

                {/* Key Driver / Context - Clean text, no pillbox container */}
                <div className="space-y-1 pt-1 border-t border-border/60">
                  <span className="text-xs font-bold text-text-main">Contributing Factors:</span>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {selectedBlock.assessment.primaryStressDriver || 'Normal seasonal conditions observed.'}
                  </p>
                </div>

                {/* Projected Depth Section */}
                {(() => {
                  const blockProj = (contrastProjectionsData as Record<string, any>)[selectedBlock.id];
                  const hasValidForecast = Boolean(blockProj && blockProj.modelStatus !== 'unavailable' && blockProj.forecasts?.length > 0);
                  const q1 = hasValidForecast ? blockProj.forecasts[0] : null;
                  const isTrainedMl = Boolean(hasValidForecast && blockProj.modelIdentifier && String(blockProj.modelIdentifier).startsWith('QuantileGB-v2.0'));
                  const badgeLabel = isTrainedMl ? 'QuantileGB-v2.0' : (hasValidForecast ? 'Empirical Trend' : null);
                  const titleLabel = isTrainedMl ? 'ML Depth Forecast (Q1):' : 'Projected Depth (Q1):';
                  const auditNotice = blockProj?.scientificAuditNotice;

                  return (
                    <div className="space-y-1.5 pt-2 border-t border-border/80" data-testid="map-inspector-ml-forecast">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-main">
                          {titleLabel}
                        </span>
                        {badgeLabel && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                            isTrainedMl ? 'text-primary bg-primary/10 border-primary/20' : 'text-text-muted bg-subtle border-border'
                          }`}>
                            {badgeLabel}
                          </span>
                        )}
                      </div>
                      {hasValidForecast && q1 ? (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between items-center min-w-0">
                            <span className="text-text-muted">Target (Water Depth):</span>
                            <span className="font-bold text-text-main shrink-0 ml-auto font-mono">
                              {q1.expectedDepthMbgl} m bgl
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-text-muted min-w-0">
                            <span>P10–P90 Uncertainty:</span>
                            <span className="font-mono shrink-0 ml-auto">
                              [{q1.uncertaintyInterval?.lowerBoundP10Mbgl ?? '—'} to {q1.uncertaintyInterval?.upperBoundP90Mbgl ?? '—'} m]
                            </span>
                          </div>
                          <div className="text-[11px] text-text-muted italic">
                            {q1.targetSeason}
                          </div>
                          {auditNotice && (
                            <div className="text-[10px] text-amber-700 bg-amber-500/10 p-1.5 border border-amber-500/30 leading-snug">
                              {auditNotice}
                            </div>
                          )}
                          {!isTrainedMl && (
                            <div className="text-[10px] text-text-muted italic leading-snug">
                              * Historical drawdown-velocity projection; no trained ML artifact exists for this geography.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-text-muted italic bg-subtle/50 p-2 border border-border">
                          Forecast Model: Unavailable for this geography (Historical telemetry only)
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Quick Actions */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Link
                    href={`/monitoring?block=${selectedBlock.id}`}
                    className="w-full bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold py-2 flex items-center justify-center gap-2 transition-colors"
                  >
                    View Multi-Horizon Forecast →
                  </Link>
                  <Link
                    href={`/interventions?block=${selectedBlock.id}`}
                    className="w-full bg-primary hover:bg-primary-hover text-text-inverted text-xs font-semibold py-2 flex items-center justify-center gap-2 transition-colors"
                  >
                    {t('explorer.suggestSolution', 'Suggest a Solution')} →
                  </Link>
                  <Link
                    href={`/alerts?block=${selectedBlock.id}`}
                    className="w-full bg-surface border border-border hover:bg-subtle text-text-main text-xs font-semibold py-2 flex items-center justify-center gap-2 transition-colors"
                  >
                    {t('explorer.previewAdvisory', 'Preview Advisory')}
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-6 text-xs text-text-muted space-y-4" data-testid="map-inspector-empty">
                <div>
                  <p className="font-semibold text-sm text-text-main">Choose a Block to Inspect</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Select any monitoring block below or click on the map to view detailed ground telemetry and water stress indicators:
                  </p>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {availableBlocks.slice(0, 10).map((blk) => (
                    <button
                      key={blk.id}
                      onClick={() => handleMapSelectBlock(blk)}
                      className="w-full text-left p-2 border border-border hover:bg-subtle transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-semibold text-text-main text-xs group-hover:text-primary">
                          {blk.name} Block
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {blk.districtName}, {blk.state}
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold ${
                        blk.riskSeverity === 'severe'
                          ? 'text-risk-severe'
                          : blk.riskSeverity === 'watch'
                          ? 'text-risk-watch'
                          : 'text-risk-normal'
                      }`}>
                        {getSeverityText(blk.riskSeverity)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
