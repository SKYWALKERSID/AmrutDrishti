'use client';

import { useEffect, useRef } from 'react';
import type { BlockData } from '@/lib/types';
import type * as Leaflet from 'leaflet';

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

function layerValue(block: BlockData, layer: MapLayer): string {
  switch (layer) {
    case 'risk':
      return `${block.assessment.descriptiveStressScore}/100`;
    case 'grace':
      return block.indicators.graceTwsaCm !== null ? `${block.indicators.graceTwsaCm} cm` : 'No Data';
    case 'rainfall':
      return block.indicators.rainfallAnomalyMm !== null ? `${block.indicators.rainfallAnomalyMm} mm` : 'No Data';
    case 'wells':
      return block.indicators.cgwbWellDepthMbgl !== null ? `${block.indicators.cgwbWellDepthMbgl} m bgl` : 'No Data';
    case 'sentinel':
      return block.indicators.sentinelNdvi !== null ? `NDVI ${block.indicators.sentinelNdvi}` : 'No Data';
  }
}

export default function LeafletMap({
  blocks,
  selectedBlockId,
  activeLayer,
  onSelectBlock,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const onSelectRef = useRef(onSelectBlock);

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

      window.setTimeout(() => {
        if (!disposed) map.invalidateSize();
      }, 100);
    }

    void initializeMap();

    return () => {
      disposed = true;
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

    if (!map || !L || !markerLayer) return;

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

    for (const block of validBlocks) {
      const selected = block.id === selectedBlockId;
      const color = markerColor(block, activeLayer);

      // Derive illustrative coverage radius from totalGeographicAreaHa (in Ha)
      // Area = PI * r^2 => r = sqrt(Area_m2 / PI)
      // For ~50,000 Ha, r is ~12.6 km (12,600m). Fall back to 15,000m if missing.
      const areaInM2 = (block.totalGeographicAreaHa || 50000) * 10000;
      const calculatedRadiusMeters = Math.round(Math.sqrt(areaInM2 / Math.PI));

      // 1. Render Translucent Spatial Risk Coverage Circle (matching screenshot design)
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
          `<br>${escapeHtml(activeLayerLabel(activeLayer))}: ${escapeHtml(layerValue(block, activeLayer))}` +
          `<br><small className="text-slate-500">Demonstration indicators; field verification required.</small>`
      );
      coverageCircle.on('click', () => onSelectRef.current(block));
      coverageCircle.addTo(markerLayer);

      // 2. Render Focal Point Center Marker for precise clicking & selection
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
          `<br>${escapeHtml(activeLayerLabel(activeLayer))}: ${escapeHtml(layerValue(block, activeLayer))}` +
          `<br><small>Demonstration indicators; field verification required.</small>`
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
  }, [blocks, selectedBlockId, activeLayer]);

  return (
    <div className="relative h-full min-h-[450px] w-full">
      <div
        ref={containerRef}
        className="h-full min-h-[450px] w-full bg-[#e8eee9]"
        aria-label="Interactive Bundelkhand geographic map"
      />

      <div className="absolute bottom-3 left-3 z-[500] rounded-md border border-border bg-white/95 p-2.5 text-xs shadow-md backdrop-blur-sm">
        <div className="font-semibold text-text-main mb-1">Map Legend</div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span> Severe
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Watch
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Normal
          </span>
        </div>
        <div className="mt-1.5 text-[10px] text-text-muted border-t border-border/50 pt-1">
          Demonstration indicators; field verification required.
        </div>
      </div>
    </div>
  );
}

function activeLayerLabel(layer: MapLayer): string {
  return {
    risk: 'Stress score',
    grace: 'GRACE TWSA',
    rainfall: 'Rainfall anomaly',
    wells: 'Well depth',
    sentinel: 'Sentinel-2 NDVI',
  }[layer];
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