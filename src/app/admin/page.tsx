'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRole } from '@/lib/context/RoleContext';
import { useLanguage } from '@/lib/context/LanguageContext';
import { ShieldCheckIcon, UserRoleIcon, InfoIcon } from '@/components/ui/Icons';

export default function AdminPage() {
  const { activeRole } = useRole();
  const { t } = useLanguage();
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/audit?limit=20')
      .then(res => res.json())
      .then(data => {
        if (data.events) {
          setAuditEvents(data.events);
        }
      })
      .catch(() => {});
  }, []);

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
          <p className="text-xs font-semibold text-text-main">Status: PostgreSQL audit_events Table Active</p>
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

      {/* Live Audit Log Section */}
      <section className="rounded-lg border border-border bg-surface p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-main">Recent System & Role Audit Events</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Live audit events from PostgreSQL table <code className="bg-subtle px-1.5 py-0.5 rounded text-[11px]">public.audit_events</code>
            </p>
          </div>
          <button
            onClick={() => {
              fetch('/api/audit?limit=20')
                .then(r => r.json())
                .then(d => setAuditEvents(d.events || []))
                .catch(() => {});
            }}
            className="text-xs font-semibold text-[#0d5c63] hover:underline px-2.5 py-1 rounded bg-subtle border border-border"
          >
            Refresh Logs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-subtle/50 text-text-muted">
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Actor Role</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Target</th>
                <th className="py-2.5 px-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {auditEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-text-muted">
                    No recent audit events found. Switch roles or record a review note to generate events.
                  </td>
                </tr>
              ) : (
                auditEvents.map((evt, idx) => (
                  <tr key={evt.event_id || idx} className="hover:bg-subtle/30 transition-colors">
                    <td className="py-2 px-3 text-[11px] text-text-muted whitespace-nowrap">
                      {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : 'Just now'}
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-semibold text-text-main uppercase text-[10px] bg-subtle px-1.5 py-0.5 rounded border border-border">
                        {evt.actor_role?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium text-text-main">{evt.action}</td>
                    <td className="py-2 px-3 text-text-muted font-mono text-[11px]">{evt.resource_target}</td>
                    <td className="py-2 px-3 text-text-muted text-[11px] truncate max-w-xs">
                      {JSON.stringify(evt.details || {})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
