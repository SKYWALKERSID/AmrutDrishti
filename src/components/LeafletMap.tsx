'use client';

import { useEffect, useRef, useState } from 'react';
import type { BlockData } from '@/lib/types';
import type * as Leaflet from 'leaflet';
import { useLanguage } from '@/lib/context/LanguageContext';

type MapLayer = 'risk' | 'grace' | 'rainfall' | 'wells' | 'sentinel';

interface LeafletMapProps {
  blocks: BlockData[];
  selectedBlockId: string;
  activeLayer: MapLayer;
  onSelectBlock: (block: BlockData) => void;
}

function markerColor(block: BlockData, layer: MapLayer): string {
  switch (layer) {
    case 'risk':
      if (block.riskSeverity === 'severe') return '#dc2626';
      if (block.riskSeverity === 'watch') return '#f59e0b';
      return '#059669';

    case 'grace':
      return (block.indicators.graceTwsaCm ?? 0) < -6 ? '#dc2626' : '#f59e0b';

    case 'rainfall':
      return (block.indicators.rainfallAnomalyMm ?? 0) < -200
        ? '#dc2626'
        : '#2563eb';

    case 'wells':
      return (block.indicators.cgwbWellDepthMbgl ?? 0) > 14
        ? '#dc2626'
        : '#059669';

    case 'sentinel':
      return '#0d5c63';
  }
}

function layerValue(block: BlockData, layer: MapLayer, noDataText: string): string {
  switch (layer) {
    case 'risk':
      return `${block.assessment.descriptiveStressScore}/100`;
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setIsMapReady(true);

      window.setTimeout(() => {
        if (!disposed) map.invalidateSize();
      }, 100);
    }

    void initializeMap();

    return () => {
      disposed = true;
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
          color: selected ? '#0d5c63' : color,
          weight: selected ? 2.5 : 1.2,
          fillColor: color,
          fillOpacity: selected ? 0.30 : 0.20,
          dashArray: selected ? '6, 6' : undefined,
        }
      );

      coverageCircle.bindPopup(
        `<strong>${escapeHtml(block.name)} Block</strong>` +
          `<br>${escapeHtml(block.districtName)}, ${escapeHtml(block.state)}` +
          `<br>${escapeHtml(layerTitle)}: ${escapeHtml(layerValue(block, activeLayer, noDataText))}` +
          `<br><small className="text-slate-500">${escapeHtml(sampleNotice)}</small>`
      );
      coverageCircle.on('click', () => onSelectRef.current(block));
      coverageCircle.addTo(markerLayer);

      const centerMarker = L.circleMarker(
        [block.coordinates[0], block.coordinates[1]],
        {
          radius: selected ? 8 : 5,
          color: selected ? '#0d5c63' : '#ffffff',
          weight: selected ? 3 : 1.5,
          fillColor: color,
          fillOpacity: 1.0,
        }
      );

      centerMarker.bindPopup(
        `<strong>${escapeHtml(block.name)} Block Focus</strong>` +
          `<br>${escapeHtml(block.districtName)}, ${escapeHtml(block.state)}` +
          `<br>${escapeHtml(layerTitle)}: ${escapeHtml(layerValue(block, activeLayer, noDataText))}` +
          `<br><small>${escapeHtml(sampleNotice)}</small>`
      );
      centerMarker.on('click', () => onSelectRef.current(block));
      centerMarker.addTo(markerLayer);
    }

    if (validBlocks.length > 0) {
      const bounds = L.latLngBounds(
        validBlocks.map((block) => [
          block.coordinates[0],
          block.coordinates[1],
        ] as [number, number])
      );

      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
    }
  }, [blocks, selectedBlockId, activeLayer, isMapReady, t]);

  return (
    <div className="relative h-full min-h-[450px] w-full">
      <div
        ref={containerRef}
        className="h-full min-h-[450px] w-full bg-[#e8eee9]"
        aria-label="Interactive Bundelkhand geographic map"
      />

      {blocks.length === 0 && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-surface/80 backdrop-blur-xs p-4 text-center">
          <div className="max-w-xs rounded-lg border border-border bg-white p-4 shadow-sm text-xs text-text-muted">
            {t('explorer.noBlocks', 'No valid blocks found for selected filter.')}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 z-[500] rounded-md border border-border bg-white/95 p-2.5 text-xs shadow-md backdrop-blur-sm max-w-[280px]">
        <div className="font-semibold text-text-main mb-1">{t('explorer.mapGuide', 'Map Guide')}</div>
        <div className="flex flex-col gap-1 text-xs">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0 inline-block"></span> {t('severity.severe', 'High Concern')}
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 inline-block"></span> {t('severity.watch', 'Needs Checking')}
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0 inline-block"></span> {t('severity.normal', 'No Flag in Sample Data')}
          </span>
        </div>
        <div className="mt-1.5 text-[10px] text-text-muted border-t border-border/50 pt-1 leading-tight">
          {t('explorer.sampleNotice', 'Sample data — these values are for demonstration only and are not verified groundwater measurements.')}
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