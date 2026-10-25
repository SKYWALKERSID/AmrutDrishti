'use client';

import React, { useState, useEffect } from 'react';
import { DATA_SOURCES } from "@/lib/data/dataSources";
import { useLanguage } from '@/lib/context/LanguageContext';
import { WhatAmILookingAt } from '@/components/ui/PlainLanguageHelp';

export default function DataSourcesPage() {
  const { t } = useLanguage();
  const healthy = DATA_SOURCES.filter((source) => source.status === "healthy").length;
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [liveBlocksCount, setLiveBlocksCount] = useState<number>(0);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  useEffect(() => {
    setLastCheckTime(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
    fetch('/api/geospatial/blocks')
      .then((res) => res.json())
      .then((data) => {
        if (data.source === 'live_database') {
          setIsLiveConnected(true);
          setLiveBlocksCount(data.blocks?.length || 0);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Header - Open Editorial Layout */}
      <div className="border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t('datasources.provenanceTitle', 'Data provenance & limitations')}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
          <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
            {t('datasources.title', 'Data Sources & Evidence Registry')}
          </h1>
          <div className="text-xs text-text-muted flex items-center gap-2">
            <span>Page checked: <strong className="text-text-main font-semibold">{lastCheckTime || 'checking…'}</strong></span>
            <span aria-hidden="true">•</span>
            <span className={isLiveConnected ? "text-emerald-700 font-semibold" : "text-text-main font-semibold"}>
              {isLiveConnected ? "Database connected" : "Database not reached; showing bundled reference values"}
            </span>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-relaxed text-text-muted">
          {t('datasources.subtitle', "Review the declared providers, spatial resolution, observation cadence, provenance notes and limitations for AMRUT DRISHTI's configured evidence sources.")}
        </p>

        {/* 5-Question Plain-Language Guide Card */}
        <div className="mt-4">
          <WhatAmILookingAt
            title="💡 How do I understand AMRUT DRISHTI's Data Sources & Limitations?"
            what="This page catalogs all official government and scientific data providers that feed into AMRUT DRISHTI, detailing who supplies each measurement, how fine-grained the data is, and what scientific limits apply."
            meaning="No single sensor covers all groundwater aspects. AMRUT DRISHTI synthesizes physical well measurements (CGWB), satellite gravity observations (NASA/DLR GRACE-FO), radar surface soil moisture (NASA SMAP), optical vegetation indices (ESA Sentinel-2), and precipitation grids (IMD)."
            whyCare="Transparency is essential in public hydrologic policy. Understanding observation cadence (quarterly vs daily) and spatial resolution (from 500m up to 300km) ensures decisions aren't made on coarse data mistaken for ultra-local telemetry."
            recentAndReliable="Each card indicates the exact latest observation date, ingestion timestamp, and missing data rate. All sources adhere to open-access government and space agency protocols."
            nextSteps="Cross-reference a block's indicators in the Explorer or Risk Assessment tabs with the resolutions and cadences documented here to understand the physical basis of alerts."
            initiallyOpen={false}
          />
        </div>

        <div className="mt-4 p-3.5 bg-emerald-50/70 border border-emerald-300 text-xs text-emerald-900 leading-relaxed space-y-1.5">
          <div>
            <span className="font-semibold">Authoritative Geographic Scope:</span> The nine active target states across four project regions are:
            <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5">
              <li><strong>South India (3 states):</strong> Karnataka, Telangana, Tamil Nadu</li>
              <li><strong>Central India (1 state):</strong> Madhya Pradesh</li>
              <li><strong>North India (3 states):</strong> Rajasthan, Haryana, Punjab</li>
              <li><strong>Northeast India (2 states):</strong> Meghalaya, Tripura</li>
            </ul>
          </div>
          <div className="text-[11px] text-emerald-800">
            <strong>Out of Scope / Excluded Regions:</strong> Assam, Sikkim, Uttar Pradesh, and Arunachal Pradesh are strictly excluded from active target navigation, target summaries, and active operational scope.
          </div>
          <div className="text-[11px] text-emerald-800">
            <strong>Update frequency:</strong> Field telemetry is published on daily to quarterly schedules; satellite products follow 5-day to monthly cycles; official IN-GRES extraction assessments are published annually. A source being listed here does not mean its latest data has been ingested or validated; see each source&apos;s Observed and Ingested dates.
          </div>
        </div>
      </div>

      {/* Summary KPI Strip (Unboxed) */}
      <div className="border-b border-border pb-6 divide-y sm:divide-y-0 sm:divide-x divide-border grid grid-cols-1 sm:grid-cols-3">
        <div className="py-2 sm:py-0 sm:px-4 first:sm:pl-0">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('datasources.configuredSources', 'Configured Sources')}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-text-main">{DATA_SOURCES.length}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Hydrological & Earth Observation</p>
        </div>
        <div className="py-2 sm:py-0 sm:px-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('datasources.healthySources', 'Provider Specifications Declared')}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-text-main">{healthy} of {DATA_SOURCES.length}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Marked healthy in registry configuration. This is not a live ingestion check.</p>
        </div>
        <div className="py-2 sm:py-0 sm:px-4 last:sm:pr-0">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('datasources.liveConnectivity', 'Live Database Synchronization')}</p>
          <p className={`mt-1 text-2xl sm:text-3xl font-bold ${isLiveConnected ? 'text-emerald-700' : 'text-teal-700'}`}>
            {isLiveConnected ? `Connected (${liveBlocksCount} blocks returned)` : 'Not connected'}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">Check Time: {lastCheckTime || 'Active'}</p>
        </div>
      </div>

      {/* Registry Articles - Clean Hairline Dividers (De-boxed) */}
      <div className="space-y-8">
        {DATA_SOURCES.map((source, idx) => (
          <article key={source.id} className={`pt-6 space-y-4 ${idx !== 0 ? 'border-t border-border' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b border-border/60">
              <div>
                <h2 className="text-base font-bold text-text-main">{source.name}</h2>
                <p className="text-xs text-text-muted mt-0.5">{source.provider}</p>
              </div>
              <div className="text-right text-xs text-text-muted">
                <div>Observed: <span className="font-semibold text-text-main">{source.latestObservationDate}</span></div>
                <div className="text-[11px]">Ingested: <span className="font-medium text-text-main">{source.lastSuccessfulIngestion}</span></div>
              </div>
            </div>

            <dl className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-text-muted font-medium">{t('datasources.spatialRes', 'Spatial resolution')}</dt>
                <dd className="mt-0.5 font-bold text-text-main">{source.spatialResolution}</dd>
              </div>
              <div>
                <dt className="text-text-muted font-medium">{t('datasources.temporalCadence', 'Temporal cadence')}</dt>
                <dd className="mt-0.5 font-bold text-text-main">{source.temporalCadence}</dd>
              </div>
              <div>
                <dt className="text-text-muted font-medium">{t('datasources.latestObs', 'Latest observation date')}</dt>
                <dd className="mt-0.5 font-bold text-text-main">{source.latestObservationDate}</dd>
              </div>
              <div>
                <dt className="text-text-muted font-medium">{t('datasources.lastIngestion', 'Last successful ingestion')}</dt>
                <dd className="mt-0.5 font-bold text-text-main">{source.lastSuccessfulIngestion}</dd>
              </div>
              <div>
                <dt className="text-text-muted font-medium">{t('datasources.missingRate', 'Missing data rate')}</dt>
                <dd className="mt-0.5 font-bold text-text-main">{source.missingDataRatePct}%</dd>
              </div>
              <div>
                <dt className="text-text-muted font-medium">{t('datasources.license', 'License / terms')}</dt>
                <dd className="mt-0.5 font-bold text-text-main">{source.licenseTerms}</dd>
              </div>
            </dl>

            <div className="border-l-2 border-primary pl-3 py-1 bg-subtle/30 text-xs">
              <span className="font-bold text-text-main uppercase tracking-wide text-[10px] block mb-0.5">
                {t('datasources.provenanceTitle', 'Provenance & Limitations')}:
              </span>
              <p className="text-text-muted leading-relaxed">{source.provenanceDetails}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
