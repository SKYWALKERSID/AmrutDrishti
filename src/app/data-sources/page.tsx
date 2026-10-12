'use client';

import React from 'react';
import { DATA_SOURCES } from "@/lib/data/dataSources";
import { useLanguage } from '@/lib/context/LanguageContext';

export default function DataSourcesPage() {
  const { t } = useLanguage();
  const healthy = DATA_SOURCES.filter((source) => source.status === "healthy").length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t('datasources.provenanceTitle', 'Data provenance & limitations')}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
          <h1 className="text-2xl font-bold">{t('datasources.title', 'Data Sources & Evidence Registry')}</h1>
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 w-fit">
            Prototype Demonstration Mode — Simulated Data
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          {t('datasources.subtitle', "Review the declared providers, spatial resolution, observation cadence, provenance notes and limitations for JalDrishti's configured evidence sources.")}
        </p>
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-900">
          <span className="font-semibold">Genuine Historical Data Integrated:</span> 305 accepted CGWB/NWIC quarterly monitoring observations across 34 stations in Tikamgarh and Chhatarpur are published in the Supabase database. These observations cover historical records and preserve null measurements. UI high-level block indicators and operational alerts remain in prototype demonstration mode.
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">{t('datasources.configuredSources', 'Configured Sources')}</p>
          <p className="mt-2 text-3xl font-bold">{DATA_SOURCES.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">{t('datasources.healthySources', 'Provider Specifications Declared')}</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{healthy}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-muted">{t('datasources.liveConnectivity', 'Live Ingestion Verified Here')}</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{t('datasources.notVerified', 'Not verified')}</p>
        </div>
      </section>

      <section className="space-y-4">
        {DATA_SOURCES.map((source) => (
          <article key={source.id} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{source.name}</h2>
                <p className="mt-1 text-sm text-text-muted">{source.provider}</p>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                Specification: {source.status} (Live ingestion unverified)
              </span>
            </div>

            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-text-muted">{t('datasources.spatialRes', 'Spatial resolution')}</dt>
                <dd className="mt-1 font-medium">{source.spatialResolution}</dd>
              </div>
              <div>
                <dt className="text-text-muted">{t('datasources.temporalCadence', 'Temporal cadence')}</dt>
                <dd className="mt-1 font-medium">{source.temporalCadence}</dd>
              </div>
              <div>
                <dt className="text-text-muted">{t('datasources.latestObs', 'Latest observation date')}</dt>
                <dd className="mt-1 font-medium">{source.latestObservationDate}</dd>
              </div>
              <div>
                <dt className="text-text-muted">{t('datasources.lastIngestion', 'Last successful ingestion')}</dt>
                <dd className="mt-1 font-medium">{source.lastSuccessfulIngestion}</dd>
              </div>
              <div>
                <dt className="text-text-muted">{t('datasources.missingRate', 'Missing data rate')}</dt>
                <dd className="mt-1 font-medium">{source.missingDataRatePct}%</dd>
              </div>
              <div>
                <dt className="text-text-muted">{t('datasources.license', 'License / terms')}</dt>
                <dd className="mt-1 font-medium">{source.licenseTerms}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-md bg-subtle p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide">{t('datasources.provenanceTitle', 'Provenance and limitations')}</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">{source.provenanceDetails}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
