'use client';

import React from 'react';
import { DATA_SOURCES } from "@/lib/data/dataSources";
import { useLanguage } from '@/lib/context/LanguageContext';

export default function DataSourcesPage() {
  const { t } = useLanguage();
  const healthy = DATA_SOURCES.filter((source) => source.status === "healthy").length;

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded p-6 shadow-xs">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0d5c63]">
          {t('datasources.provenanceTitle', 'Data provenance & limitations')}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
          <h1 className="text-2xl font-bold text-text-main">{t('datasources.title', 'Data Sources & Evidence Registry')}</h1>
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 w-fit">
            Prototype Demonstration Mode — Simulated Data
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-text-muted">
          {t('datasources.subtitle', "Review the declared providers, spatial resolution, observation cadence, provenance notes and limitations for JalDrishti's configured evidence sources.")}
        </p>
        <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-300 rounded text-xs text-emerald-900 leading-relaxed">
          <span className="font-semibold">Empirical & Nationwide Data Integrated:</span> Published CGWB/NWIC quarterly groundwater monitoring observations across 8 active states (Madhya Pradesh, Uttar Pradesh, Punjab, Rajasthan, Haryana, Arunachal Pradesh, Sikkim, and Assam) spanning 60 administrative blocks. Historical observation series and IN-GRES Dynamic Ground Water Extraction stages reflect authentic Ministry of Jal Shakti records with explicit scientific safeguards.
        </div>
      </section>

      {/* Summary KPI Strip */}
      <section className="bg-surface border border-border rounded shadow-xs divide-y sm:divide-y-0 sm:divide-x divide-border grid grid-cols-1 sm:grid-cols-3">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('datasources.configuredSources', 'Configured Sources')}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-text-main">{DATA_SOURCES.length}</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('datasources.healthySources', 'Provider Specifications Declared')}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-700">{healthy}</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('datasources.liveConnectivity', 'Live Ingestion Verified Here')}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-700">{t('datasources.notVerified', 'Not verified')}</p>
        </div>
      </section>

      {/* Registry Articles */}
      <section className="space-y-4">
        {DATA_SOURCES.map((source) => (
          <article key={source.id} className="rounded border border-border bg-surface p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-text-main">{source.name}</h2>
                <p className="text-xs text-text-muted mt-0.5">{source.provider}</p>
              </div>
              <span className="rounded border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                Specification: {source.status} (Live ingestion unverified)
              </span>
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

            <div className="rounded bg-subtle/40 p-3.5 border border-border/60">
              <h3 className="text-[11px] font-bold text-text-main uppercase tracking-wide">{t('datasources.provenanceTitle', 'Provenance and limitations')}</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">{source.provenanceDetails}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
