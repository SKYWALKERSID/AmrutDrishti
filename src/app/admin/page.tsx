'use client';

import React from 'react';
import Link from 'next/link';
import { useRole } from '@/lib/context/RoleContext';
import { useLanguage } from '@/lib/context/LanguageContext';
import { ShieldCheckIcon, UserRoleIcon, InfoIcon } from '@/components/ui/Icons';

export default function AdminPage() {
  const { activeRole } = useRole();
  const { t } = useLanguage();
  const isSuperUser = activeRole === 'admin';

  if (!isSuperUser) {
    return (
      <div className="space-y-6">
        <section className="rounded-lg border border-amber-300 bg-amber-50/70 p-6 text-amber-900">
          <div className="flex items-center gap-2 font-bold text-sm">
            <InfoIcon className="w-5 h-5 text-amber-700 shrink-0" />
            <span>{t('admin.noticeTitle', 'Demonstration Access Notice — System Administrator Role Required')}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-amber-800">
            {t('admin.noticeText', 'The Administration workspace is reserved for System Administrators in the JalDrishti platform prototype.')}
            {' '}Your current active demo role is <strong className="uppercase">{activeRole.replace('_', ' ')}</strong>.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-block bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors"
            >
              {t('admin.returnOverview', '← Return to Overview Dashboard')}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0d5c63] flex items-center gap-1.5">
              <UserRoleIcon className="w-4 h-4 text-[#0d5c63]" /> {t('nav.admin', 'Administration')}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-text-main">{t('admin.title', 'System Administration Superuser Workspace')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
              {t('admin.subtitle', 'Platform-wide administration interface for System Administrators with full access.')}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
            {t('admin.modeActive', 'Superuser Mode Active')}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-2">
          <h2 className="font-bold text-text-main text-sm">Simulated Role Context Switcher</h2>
          <p className="text-xs leading-5 text-text-muted">
            The top navigation role selector provides instant client-side evaluation context for all prototype personas.
          </p>
          <p className="text-xs font-semibold text-emerald-700">Status: Client-Side Demonstration Active</p>
        </article>

        <article className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-2">
          <h2 className="font-bold text-text-main text-sm">Audit Trail & Access Logging</h2>
          <p className="text-xs leading-5 text-text-muted">
            Inspect or log administrative changes, human risk overrides, and notification dispatches across all administrative jurisdictions.
          </p>
          <p className="text-xs font-semibold text-text-main">Status: Local Storage Logging</p>
        </article>

        <article className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-2">
          <h2 className="font-bold text-text-main text-sm">Geospatial & Ingestion Pipelines</h2>
          <p className="text-xs leading-5 text-text-muted">
            Review data source cadence, provider licenses, and spatial resolution metadata across configured GEE, IMD, and CGWB pipelines.
          </p>
          <Link href="/data-sources" className="inline-block text-xs font-semibold text-[#0d5c63] hover:underline">
            Inspect Data Sources Registry →
          </Link>
        </article>

        <article className="rounded-lg border border-border bg-surface p-5 shadow-card space-y-2">
          <h2 className="font-bold text-text-main text-sm">Operational Scientific Safeguards</h2>
          <p className="text-xs leading-5 text-text-muted">
            All predictive scores and advisories require authorized human review and ground piezometer validation before emergency financial sanctions.
          </p>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" /> Safeguard Gates Enforced
          </div>
        </article>
      </section>
    </div>
  );
}
