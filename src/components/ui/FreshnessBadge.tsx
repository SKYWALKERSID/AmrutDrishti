'use client';

import React, { useState } from 'react';
import { FreshnessStatus, FRESHNESS_STYLES, FreshnessMetadata } from '@/lib/data/freshness';
import { InfoIcon } from './Icons';

interface FreshnessBadgeProps {
  status: FreshnessStatus;
  lastObservedDate?: string | null;
  lastIngestionDate?: string | null;
  sourceName?: string;
  sourceUrl?: string;
  geographicScope?: string;
  limitations?: string;
  showDetails?: boolean;
  className?: string;
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  status,
  lastObservedDate,
  lastIngestionDate,
  sourceName,
  sourceUrl,
  geographicScope,
  limitations,
  showDetails = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const style = FRESHNESS_STYLES[status] || FRESHNESS_STYLES.RECENT;

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${style.bg} ${style.text} ${style.border} transition-colors cursor-pointer hover:opacity-90`}
        title={`Status: ${style.label} (Click for provenance details)`}
        aria-expanded={isOpen}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`}></span>
        <span>{style.label}</span>
        {lastObservedDate && (
          <span className="opacity-80 font-normal">({lastObservedDate})</span>
        )}
      </button>

      {/* Popover Card for Full Provenance & Limitations */}
      {(isOpen || showDetails) && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[280px] sm:min-w-[320px] max-w-sm p-3 rounded bg-surface border border-border text-xs text-text-main space-y-2">
          <div className="flex items-center justify-between border-b border-border pb-1.5">
            <span className="font-bold text-xs flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
              {style.label} Provenance
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-text-main text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-text-muted leading-tight">
            {style.description}
          </p>

          <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] pt-1">
            {sourceName && (
              <div className="col-span-2">
                <dt className="text-text-muted">Source Provider:</dt>
                <dd className="font-medium">
                  {sourceUrl ? (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary-hover">
                      {sourceName}
                    </a>
                  ) : (
                    sourceName
                  )}
                </dd>
              </div>
            )}
            {lastObservedDate && (
              <div>
                <dt className="text-text-muted">Observation Date:</dt>
                <dd className="font-medium text-text-main">{lastObservedDate}</dd>
              </div>
            )}
            {lastIngestionDate && (
              <div>
                <dt className="text-text-muted">Ingestion / Sync:</dt>
                <dd className="font-medium text-text-main">{lastIngestionDate}</dd>
              </div>
            )}
            {geographicScope && (
              <div className="col-span-2">
                <dt className="text-text-muted">Geographic Scope:</dt>
                <dd className="font-medium text-text-main">{geographicScope}</dd>
              </div>
            )}
          </dl>

          {limitations && (
            <div className="p-2 bg-status-warningBg border border-status-warning rounded text-[10px] text-status-warningText leading-normal">
              <span className="font-semibold block">Known Limitation:</span>
              {limitations}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
