import React from 'react';
import Link from 'next/link';
import { InfoIcon, ShieldCheckIcon } from '@/components/ui/Icons';

export const metadata = {
  title: 'Privacy Policy (Draft) | AMRUT DRISHTI (अमृत दृष्टि)',
  description: 'Privacy Policy and data stewardship disclosure for the AMRUT DRISHTI groundwater intelligence platform.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Notice Banner */}
      <div className="rounded border-l-4 border-l-amber-600 border border-amber-200 bg-amber-50/70 p-5 text-amber-900 flex items-start gap-3">
        <InfoIcon className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <p className="font-bold uppercase tracking-wider text-amber-950">
            Draft Policy Notice — Academic & Research Prototype
          </p>
          <p className="mt-1">
            This document outlines the data governance and privacy practices implemented in the AMRUT DRISHTI platform prototype. It is subject to legal review prior to institutional operationalization.
          </p>
        </div>
      </div>

      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Platform Governance & Data Stewardship
        </p>
        <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
          Privacy Policy & Data Handling Practices
        </h1>
        <p className="text-xs text-text-muted">
          Last revised: October 17, 2026 • Version 1.0 (Prototype Evaluation)
        </p>
      </header>

      <section className="space-y-6 text-xs text-text-main leading-relaxed">
        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">1. Scope of Data Collection</h2>
          <p className="text-text-muted">
            AMRUT DRISHTI is designed as an open-access public hydrogeological intelligence platform. We prioritize privacy by design:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-text-muted">
            <li><strong>No Personal Identification Harvesting:</strong> General public visitors are not required to provide personal identity records, phone numbers, or residential addresses to explore the platform.</li>
            <li><strong>Environmental & Telemetry Focus:</strong> The data stored and served consists entirely of environmental, meteorological, and hydrogeological parameters (e.g., piezometer water levels, precipitation deficits, satellite mass anomalies).</li>
            <li><strong>Simulated Demo Personas:</strong> The prototype role switcher operates client-side to demonstrate functional permissions without logging private user identities.</li>
          </ul>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">2. Local Storage Usage</h2>
          <p className="text-text-muted">
            The platform uses client-side Web Storage (<code className="bg-subtle px-1 rounded">localStorage</code>) strictly to preserve:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-text-muted">
            <li>Language selection preference (English / Hindi).</li>
            <li>Demonstration role context during an active browser session.</li>
            <li>Draft intervention proposals created locally by the user during interactive testing.</li>
          </ul>
          <p className="text-text-muted mt-1">
            These records reside in the user&apos;s local browser environment and are not harvested for advertising, third-party profiling, or cross-site tracking.
          </p>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">3. Server Telemetry & Access Logging</h2>
          <p className="text-text-muted">
            Administrative events (such as human review notes recorded by authorized users or diagnostic health probes) are logged in the platform&apos;s internal PostgreSQL audit table (<code className="bg-subtle px-1 rounded">public.audit_events</code>) to maintain scientific auditability and institutional accountability. These logs capture the role persona, action, timestamp, and target resource.
          </p>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">4. External Services & Remote Assets</h2>
          <p className="text-text-muted">
            Map tiles are retrieved directly from OpenStreetMap and CartoDB tile servers. Vector boundaries and geospatial features are served directly from verified local GeoJSON assets or authenticated Supabase PostGIS instances without external telemetry cookies.
          </p>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">5. Data Retention & Erasure</h2>
          <p className="text-text-muted">
            Because client session data is stored locally in the browser, users can completely clear their local draft records and role settings at any time by clearing their browser cookies and site storage for this domain.
          </p>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">6. Inquiries and Responsible Disclosure</h2>
          <p className="text-text-muted">
            Questions regarding data stewardship or requests for independent security evaluation should be directed to the project technical coordinators via repository issues or institutional channels.
          </p>
        </article>
      </section>

      <footer className="pt-6 border-t border-border flex items-center justify-between text-xs text-text-muted">
        <Link href="/" className="text-primary hover:underline font-semibold">
          ← Return to Project Brief
        </Link>
        <Link href="/terms" className="text-primary hover:underline">
          View Terms of Service Draft →
        </Link>
      </footer>
    </div>
  );
}
