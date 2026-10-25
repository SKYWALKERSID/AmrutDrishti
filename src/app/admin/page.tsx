'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRole } from '@/lib/context/RoleContext';
import { useLanguage } from '@/lib/context/LanguageContext';
import { ShieldCheckIcon, UserRoleIcon, InfoIcon } from '@/components/ui/Icons';

interface EndpointHealth {
  endpoint: string;
  name: string;
  status: 'ONLINE' | 'DEGRADED' | 'FAILED' | 'PENDING';
  code: number | null;
  latencyMs: number | null;
  details: string;
  source: string;
}

export default function AdminPage() {
  const { activeRole } = useRole();
  const { t } = useLanguage();
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, EndpointHealth>>({
    geospatial: { endpoint: '/api/geospatial/blocks', name: 'Geospatial Block API', status: 'PENDING', code: null, latencyMs: null, details: 'Not tested yet', source: 'PostgreSQL / PostGIS / DWLR' },
    alerts: { endpoint: '/api/alerts/dispatch', name: 'Alerts & Governance Dispatch', status: 'PENDING', code: null, latencyMs: null, details: 'Not tested yet', source: 'Simulated advisory dispatch boundary' },
    audit: { endpoint: '/api/audit?limit=5', name: 'Audit Events Ingestion', status: 'PENDING', code: null, latencyMs: null, details: 'Not tested yet', source: 'PostgreSQL audit_events' },
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setIsCheckingHealth(true);
    const updated: Record<string, EndpointHealth> = { ...healthMap };

    // 1. Test Geospatial Blocks
    const t0 = performance.now();
    try {
      const res = await fetch('/api/geospatial/blocks');
      const lat = Math.round(performance.now() - t0);
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : (data.blocks?.length || 0);
        updated.geospatial = {
          endpoint: '/api/geospatial/blocks',
          name: 'Geospatial Block API',
          status: 'ONLINE',
          code: res.status,
          latencyMs: lat,
          details: `${count} blocks loaded across the 9 active target states in 4 project regions`,
          source: 'PostgreSQL / DWLR & Remote Sensing',
        };
      } else {
        updated.geospatial = {
          endpoint: '/api/geospatial/blocks',
          name: 'Geospatial Block API',
          status: 'DEGRADED',
          code: res.status,
          latencyMs: lat,
          details: `HTTP ${res.status} response from geospatial endpoint`,
          source: 'PostgreSQL / DWLR',
        };
      }
    } catch (e: any) {
      updated.geospatial = {
        endpoint: '/api/geospatial/blocks',
        name: 'Geospatial Block API',
        status: 'FAILED',
        code: 500,
        latencyMs: Math.round(performance.now() - t0),
        details: e.message || 'Geospatial fetch failed',
        source: 'PostgreSQL / DWLR',
      };
    }

    // 2. Test Alerts
    const t1 = performance.now();
    try {
      const res = await fetch('/api/alerts/dispatch', {
        headers: { 'x-jaldrishti-role': activeRole },
      });
      const lat = Math.round(performance.now() - t1);
      if (res.ok) {
        const data = await res.json();
        updated.alerts = {
          endpoint: '/api/alerts/dispatch',
          name: 'Alerts & Governance Dispatch',
          status: 'ONLINE',
          code: res.status,
          latencyMs: lat,
          details: data.simulationDefault
            ? 'Dispatch boundary is available; simulated delivery remains the default.'
            : 'Dispatch boundary is available.',
          source: 'Simulated advisory dispatch boundary',
        };
      } else {
        updated.alerts = {
          endpoint: '/api/alerts/dispatch',
          name: 'Alerts & Governance Dispatch',
          status: res.status === 403 ? 'DEGRADED' : 'FAILED',
          code: res.status,
          latencyMs: lat,
          details: `HTTP ${res.status}: ${res.statusText}`,
          source: 'Simulated advisory dispatch boundary',
        };
      }
    } catch (e: any) {
      updated.alerts = {
        endpoint: '/api/alerts/dispatch',
        name: 'Alerts & Governance Dispatch',
        status: 'FAILED',
        code: 500,
        latencyMs: Math.round(performance.now() - t1),
        details: e.message || 'Alerts fetch failed',
        source: 'Simulated advisory dispatch boundary',
      };
    }

    // 3. Test Audit
    const t2 = performance.now();
    try {
      const res = await fetch('/api/audit?limit=5', {
        headers: { 'x-jaldrishti-role': activeRole },
      });
      const lat = Math.round(performance.now() - t2);
      if (res.ok) {
        const data = await res.json();
        const evtCount = Array.isArray(data.events) ? data.events.length : 0;
        updated.audit = {
          endpoint: '/api/audit?limit=5',
          name: 'Audit Events Ingestion',
          status: 'ONLINE',
          code: res.status,
          latencyMs: lat,
          details: `${evtCount} audit records inspected`,
          source: 'PostgreSQL public.audit_events',
        };
      } else {
        updated.audit = {
          endpoint: '/api/audit?limit=5',
          name: 'Audit Events Ingestion',
          status: res.status === 403 ? 'DEGRADED' : 'FAILED',
          code: res.status,
          latencyMs: lat,
          details: `HTTP ${res.status}: Access restricted`,
          source: 'PostgreSQL public.audit_events',
        };
      }
    } catch (e: any) {
      updated.audit = {
        endpoint: '/api/audit?limit=5',
        name: 'Audit Events Ingestion',
        status: 'FAILED',
        code: 500,
        latencyMs: Math.round(performance.now() - t2),
        details: e.message || 'Audit fetch failed',
        source: 'PostgreSQL public.audit_events',
      };
    }

    setHealthMap(updated);
    setIsCheckingHealth(false);
    setLastCheckTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  useEffect(() => {
    fetch('/api/audit?limit=20', {
      headers: { 'x-jaldrishti-role': activeRole },
    })
      .then(res => res.json())
      .then(data => {
        if (data.events) {
          setAuditEvents(data.events);
        }
      })
      .catch(() => {});

    runDiagnostics();
  }, [activeRole]);

  const isSuperUser = activeRole === 'admin';

  if (!isSuperUser) {
    return (
      <div className="space-y-6">
        <section className="border-l-4 border-l-amber-600 border border-amber-200 bg-amber-50/70 p-6 text-amber-900">
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
              className="inline-block bg-primary hover:bg-primary-hover text-text-inverted text-xs font-semibold px-4 py-2 transition-colors"
            >
              {t('admin.returnOverview', '← Return to Overview Dashboard')}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header - Open Editorial Layout */}
      <div className="border-b border-border pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
              <p className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <UserRoleIcon className="w-4 h-4 text-primary" /> {t('nav.admin', 'Administration')}
              </p>
              <span aria-hidden="true">•</span>
              <span>Governance Scope (9 Approved States)</span>
              <span aria-hidden="true">•</span>
              <span>Telemetry: <strong className="text-text-main font-semibold">{lastCheckTime ? `Checked ${lastCheckTime}` : 'Active'}</strong></span>
            </div>
            <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
              {t('admin.title', 'System Administration Superuser Workspace')}
            </h1>
            <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-relaxed text-text-muted">
              {t('admin.subtitle', 'Platform-wide administration interface for System Administrators with full access.')}
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 shrink-0">
            ● {t('admin.modeActive', 'Superuser Mode Active')}
          </span>
        </div>
      </div>

      {/* Governance & Architecture Specifications - Clean Open List */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 border-b border-border pb-8">
        <article className="space-y-1.5">
          <h2 className="font-bold text-text-main text-sm">Simulated Role Context Switcher</h2>
          <p className="text-xs leading-5 text-text-muted">
            The top navigation role selector provides instant client-side evaluation context for all prototype personas.
          </p>
          <p className="text-xs font-semibold text-emerald-700">Status: Client-Side Demonstration Active</p>
        </article>

        <article className="space-y-1.5">
          <h2 className="font-bold text-text-main text-sm">Audit Trail & Access Logging</h2>
          <p className="text-xs leading-5 text-text-muted">
            Inspect or log administrative changes, human risk overrides, and notification dispatches across all administrative jurisdictions.
          </p>
          <p className="text-xs font-semibold text-text-main">Status: PostgreSQL audit_events Table Active</p>
        </article>

        <article className="space-y-1.5">
          <h2 className="font-bold text-text-main text-sm">Geospatial & Ingestion Pipelines</h2>
          <p className="text-xs leading-5 text-text-muted">
            Review data source cadence, provider licenses, and spatial resolution metadata across configured GEE, IMD, and CGWB pipelines.
          </p>
          <Link href="/data-sources" className="inline-block text-xs font-semibold text-primary hover:underline">
            Inspect Data Sources Registry →
          </Link>
        </article>

        <article className="space-y-1.5">
          <h2 className="font-bold text-text-main text-sm">Operational Scientific Safeguards</h2>
          <p className="text-xs leading-5 text-text-muted">
            All predictive scores and advisories require authorized human review and ground piezometer validation before emergency financial sanctions.
          </p>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <ShieldCheckIcon className="w-4 h-4 text-primary" /> Safeguard Gates Enforced
          </div>
        </article>
      </section>

      {/* Real Integration Health & Telemetry Diagnostics - Open Section */}
      <section className="space-y-4 border-b border-border pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-main">Connected Integration Health & API Diagnostics</h2>
              <span className="text-xs text-text-muted">• Status: <strong className="text-emerald-700 font-semibold">Live Probe</strong></span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Real-time verification of connected backend endpoints, data feeds, and role-enforced access controls.
            </p>
          </div>
          <button
            type="button"
            onClick={runDiagnostics}
            disabled={isCheckingHealth}
            className="text-xs font-semibold text-primary hover:underline px-3 py-1.5 bg-subtle border border-border transition-colors disabled:opacity-50"
          >
            {isCheckingHealth ? 'Pinging Endpoints...' : 'Run Diagnostics'}
          </button>
        </div>

        <div className="overflow-x-auto border border-border">
          <table className="w-full text-left text-xs border-collapse dbim-table">
            <thead>
              <tr className="border-b border-border bg-subtle/50 text-text-muted font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 text-left">Service / Endpoint</th>
                <th className="py-2.5 px-3 text-left">Underlying Source</th>
                <th className="py-2.5 px-3 text-left">Health Status</th>
                <th className="py-2.5 px-3 text-right">HTTP Code</th>
                <th className="py-2.5 px-3 text-right">Latency</th>
                <th className="py-2.5 px-3 text-left">Diagnostic Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(healthMap).map(([key, item]) => {
                return (
                  <tr key={key} className="hover:bg-subtle/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-text-main">{item.name}</div>
                      <code className="text-[11px] text-text-muted font-mono">{item.endpoint}</code>
                    </td>
                    <td className="py-2.5 px-3 text-text-muted text-[11px]">{item.source}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        item.status === 'ONLINE' ? 'text-emerald-700' : item.status === 'DEGRADED' ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        <span className="text-[9px]">●</span> {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[11px]">
                      {item.code ? (
                        <span className={item.code < 400 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                          {item.code}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-muted text-[11px]">
                      {item.latencyMs !== null ? `${item.latencyMs} ms` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-text-main text-[11px]">{item.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Live Audit Log Section - Open Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-main">Recent System & Role Audit Events</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Live audit events from PostgreSQL table <code className="bg-subtle px-1.5 py-0.5 text-[11px]">public.audit_events</code>
            </p>
          </div>
          <button
            onClick={() => {
              fetch('/api/audit?limit=20', {
                headers: { 'x-jaldrishti-role': activeRole },
              })
                .then(r => r.json())
                .then(d => setAuditEvents(d.events || []))
                .catch(() => {});
            }}
            className="text-xs font-semibold text-primary hover:underline px-2.5 py-1 bg-subtle border border-border"
          >
            Refresh Logs
          </button>
        </div>

        <div className="overflow-x-auto border border-border">
          <table className="w-full text-left text-xs border-collapse dbim-table">
            <thead>
              <tr className="border-b border-border bg-subtle/50 text-text-muted font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 text-left">Timestamp</th>
                <th className="py-2.5 px-3 text-left">Actor Role</th>
                <th className="py-2.5 px-3 text-left">Action</th>
                <th className="py-2.5 px-3 text-left">Target</th>
                <th className="py-2.5 px-3 text-left">Details</th>
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
                      <span className="font-semibold text-text-main uppercase text-[11px]">
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
