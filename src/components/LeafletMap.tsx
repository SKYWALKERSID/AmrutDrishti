'use client';

import { useEffect, useRef, useState } from 'react';
import type { BlockData } from '@/lib/types';
import type * as Leaflet from 'leaflet';
import { useLanguage } from '@/lib/context/LanguageContext';
import { MAP_COLORS } from '@/lib/design/mapPalette';

type MapLayer = 'risk' | 'grace' | 'rainfall' | 'wells' | 'sentinel';

interface LeafletMapProps {
  blocks: BlockData[];
  selectedBlockId?: string;
  activeLayer: MapLayer;
  onSelectBlock: (block: BlockData) => void;
}

function markerColor(block: BlockData, layer: MapLayer): string {
  switch (layer) {
    case 'risk':
      if (block.riskSeverity === 'severe') return MAP_COLORS.severe;
      if (block.riskSeverity === 'watch') return MAP_COLORS.watch;
      if (block.riskSeverity === 'normal') return MAP_COLORS.normal;
      return MAP_COLORS.gap; // honest gap representation

    case 'grace':
      if (block.indicators.graceTwsaCm === null) return MAP_COLORS.gap;
      return block.indicators.graceTwsaCm < -6 ? MAP_COLORS.severe : MAP_COLORS.watch;

    case 'rainfall':
      if (block.indicators.rainfallAnomalyMm === null) return MAP_COLORS.gap;
      return block.indicators.rainfallAnomalyMm < -200
        ? MAP_COLORS.severe
        : MAP_COLORS.rainfallNormal;

    case 'wells':
      if (block.indicators.cgwbWellDepthMbgl === null) return MAP_COLORS.gap;
      return block.indicators.cgwbWellDepthMbgl > 14
        ? MAP_COLORS.severe
        : MAP_COLORS.normal;

    case 'sentinel':
      if (block.indicators.sentinelNdvi === null) return MAP_COLORS.gap;
      return MAP_COLORS.outlineSelected;
  }
}

function layerValue(block: BlockData, layer: MapLayer, noDataText: string): string {
  switch (layer) {
    case 'risk':
      return block.assessment.descriptiveStressScore !== null ? `${block.assessment.descriptiveStressScore}/100` : noDataText;
    case 'grace':
      return block.indicators.graceTwsaCm !== null ? `${block.indicators.graceTwsaCm} cm` : noDataText;
    case 'rainfall':
      return block.indicators.rainfallAnomalyMm !== null ? `${block.indicators.rainfallAnomalyMm} mm` : noDataText;
    case 'wells':
      return block.indicators.cgwbWellDepthMbgl !== null ? `${block.indicators.cgwbWellDepthMbgl} m bgl` : noDataText;
    case 'sentinel':
      return block.indicators.sentinelNdvi !== null ? `NDVI ${block.indicators.sentinelNdvi}` : noDataText;
  }
}

export default function LeafletMap({
  blocks,
  selectedBlockId,
  activeLayer,
  onSelectBlock,
}: LeafletMapProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const onSelectRef = useRef(onSelectBlock);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectBlock;
  }, [onSelectBlock]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    const invalidateTimers: number[] = [];

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) return;

      const L = await import('leaflet');
      if (disposed || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [24.8, 79.0],
        zoom: 7,
        scrollWheelZoom: true,
      });

      // CartoDB Voyager raster tiles with global Fastly CDN edge caching
      const primaryTileLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
          crossOrigin: true,
          keepBuffer: 6,
          updateWhenIdle: false,
          updateWhenZooming: true,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }
      );
      primaryTileLayer.addTo(map);

      // Automatic fallback if any single tile request hits an intermittent network glitch
      primaryTileLayer.on('tileerror', (errorEvent) => {
        const img = errorEvent.tile as HTMLImageElement;
        if (img && !img.dataset.retried) {
          img.dataset.retried = 'true';
          const originalSrc = img.src;
          if (originalSrc.includes('basemaps.cartocdn.com')) {
            img.src = originalSrc.replace(/[a-d]\.basemaps/, 'a.basemaps');
          }
        }
      });

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setIsMapReady(true);

      // Responsive observer so whenever container dimensions change, Leaflet recalculates bounds
      if (containerRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed && mapRef.current) {
            mapRef.current.invalidateSize({ debounceMoveend: true });
          }
        });
        resizeObserver.observe(containerRef.current);
      }

      // Staged invalidation to handle hydration, font loads, and tab layout transitions
      [50, 150, 300, 600, 1200].forEach((delay) => {
        const timer = window.setTimeout(() => {
          if (!disposed && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, delay);
        invalidateTimers.push(timer);
      });
    }

    void initializeMap();

    return () => {
      disposed = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      invalidateTimers.forEach((timer) => window.clearTimeout(timer));
      setIsMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const markerLayer = layerRef.current;

    if (!map || !L || !markerLayer || !isMapReady) return;

    markerLayer.clearLayers();

    const validBlocks = blocks.filter(
      (block): block is BlockData & { coordinates: [number, number] } =>
        Array.isArray(block.coordinates) &&
        block.coordinates !== null &&
        Number.isFinite(block.coordinates[0]) &&
        Number.isFinite(block.coordinates[1]) &&
        Math.abs(block.coordinates[0]) <= 90 &&
        Math.abs(block.coordinates[1]) <= 180
    );

    const layerTitle = activeLayerLabel(activeLayer, t);
    const sampleNotice = t('explorer.sampleNotice', 'Sample data — these values are for demonstration only and are not verified groundwater measurements.');
    const noDataText = t('monitoring.noData', 'No Data');

    for (const block of validBlocks) {
      const selected = block.id === selectedBlockId;
      const color = markerColor(block, activeLayer);

      const areaInM2 = (block.totalGeographicAreaHa || 50000) * 10000;
      const calculatedRadiusMeters = Math.round(Math.sqrt(areaInM2 / Math.PI));

      const coverageCircle = L.circle(
        [block.coordinates[0], block.coordinates[1]],
        {
          radius: calculatedRadiusMeters,
          color: selected ? MAP_COLORS.outlineSelected : color,
          weight: selected ? 2.5 : 1.2,
          fillColor: color,
          fillOpacity: selected ? 0.30 : 0.20,
          dashArray: selected ? '6, 6' : undefined,
        }
      );

      coverageCircle.bindPopup(
        `<strong>${escapeHtml(block.name)} Block</strong>` +
          `<br>${escapeHtml(block.districtName)}, ${escapeHtml(block.state)}` +
          `<br>${escapeHtml(layerTitle)}: <strong>${escapeHtml(layerValue(block, activeLayer, noDataText))}</strong>`
      );
      coverageCircle.on('click', () => onSelectRef.current(block));
      coverageCircle.addTo(markerLayer);

      const centerMarker = L.circleMarker(
        [block.coordinates[0], block.coordinates[1]],
        {
          radius: selected ? 8 : 5,
          color: selected ? MAP_COLORS.outlineSelected : MAP_COLORS.outlineDefault,
          weight: selected ? 3 : 1.5,
          fillColor: color,
          fillOpacity: 1.0,
        }
      );

      centerMarker.bindPopup(
        `<strong>${escapeHtml(block.name)} Block</strong>` +
          `<br>${escapeHtml(block.districtName)}, ${escapeHtml(block.state)}` +
          `<br>${escapeHtml(layerTitle)}: <strong>${escapeHtml(layerValue(block, activeLayer, noDataText))}</strong>`
      );
      centerMarker.on('click', () => onSelectRef.current(block));
      centerMarker.addTo(markerLayer);
    }

    map.invalidateSize({ debounceMoveend: true });

    if (validBlocks.length > 0) {
      const bounds = L.latLngBounds(
        validBlocks.map((block) => [
          block.coordinates[0],
          block.coordinates[1],
        ] as [number, number])
      );

      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
      window.setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }, [blocks, selectedBlockId, activeLayer, isMapReady, t]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="h-full w-full bg-background"
        aria-label="Interactive India groundwater monitoring map"
      />

      {blocks.length === 0 && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-surface/80 p-4 text-center">
          <div className="max-w-xs rounded border border-border bg-surface p-4 text-xs text-text-muted">
            {t('explorer.noBlocks', 'No valid blocks found for selected filter.')}
          </div>
        </div>
      )}

      {/* Dynamic Layer Guide / Legend */}
      <div className="absolute bottom-3 left-3 z-[500] rounded border border-border bg-surface p-2.5 text-xs max-w-[calc(100%-1.5rem)] sm:max-w-[280px]">
        <div className="font-semibold text-text-main mb-1.5 flex items-center justify-between">
          <span>{t('explorer.mapGuide', 'Map Guide')}</span>
          <span className="text-[10px] text-text-muted font-normal">({activeLayerLabel(activeLayer, t)})</span>
        </div>

        {activeLayer === 'risk' && (
          <div className="flex flex-col gap-1 text-[11px]">
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-severe shrink-0 inline-block"></span> {t('map.guide.risk.high', 'High Concern (Score > 70)')}
            </span>
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-status-warning shrink-0 inline-block"></span> {t('map.guide.risk.watch', 'Needs Checking (Score 40–70)')}
            </span>
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-normal shrink-0 inline-block"></span> {t('map.guide.risk.normal', 'Normal Water Level (Score < 40)')}
            </span>
          </div>
        )}

        {activeLayer === 'grace' && (
          <div className="flex flex-col gap-1 text-[11px]">
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-severe shrink-0 inline-block"></span> {t('map.guide.grace.loss', 'Large Loss (< -6 cm anomaly)')}
            </span>
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-status-warning shrink-0 inline-block"></span> {t('map.guide.grace.deficit', 'Moderate Deficit (> -6 cm anomaly)')}
            </span>
          </div>
        )}

        {activeLayer === 'rainfall' && (
          <div className="flex flex-col gap-1 text-[11px]">
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-data-rainfall shrink-0 inline-block"></span> {t('map.guide.rain.normal', 'Normal or Low Rain Deficit')}
            </span>
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-severe shrink-0 inline-block"></span> {t('map.guide.rain.high', 'High Rain Deficit (> 200 mm shortfall)')}
            </span>
          </div>
        )}

        {activeLayer === 'wells' && (
          <div className="flex flex-col gap-1 text-[11px]">
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-normal shrink-0 inline-block"></span> {t('map.guide.wells.shallow', 'Shallow Well Level (< 14 m bgl)')}
            </span>
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-severe shrink-0 inline-block"></span> {t('map.guide.wells.deep', 'Deep Well Depletion (> 14 m bgl)')}
            </span>
          </div>
        )}

        {activeLayer === 'sentinel' && (
          <div className="flex flex-col gap-1 text-[11px]">
            <span className="flex items-center gap-1.5 text-text-main">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 inline-block"></span> {t('map.guide.sentinel.ndvi', 'Vegetation Greenness Index (NDVI)')}
            </span>
          </div>
        )}

        {/* Universal Honest Gap Representation in Legend */}
        <div className="pt-1.5 mt-1.5 border-t border-border/60 flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-status-neutral shrink-0 inline-block"></span> {t('map.guide.gap', 'Gray: Data Not Available / Pending')}
        </div>
      </div>
    </div>
  );
}

function activeLayerLabel(layer: MapLayer, t: (key: string, fallback?: string) => string): string {
  switch (layer) {
    case 'risk':
      return t('layer.risk', 'Groundwater Status');
    case 'grace':
      return t('layer.grace', 'Satellite Water Storage Estimate');
    case 'rainfall':
      return t('layer.rainfall', 'Rainfall Difference');
    case 'wells':
      return t('layer.wells', 'Groundwater Monitoring Wells');
    case 'sentinel':
      return t('layer.sentinel', 'Satellite Vegetation Information');
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}
