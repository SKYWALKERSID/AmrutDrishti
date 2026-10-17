import React from 'react';
import Link from 'next/link';
import { ShieldCheckIcon, InfoIcon } from '@/components/ui/Icons';

export const metadata = {
  title: 'Terms of Service (Draft) | JalDrishti (जलदृष्टि)',
  description: 'Terms of Service and research usage notice for the JalDrishti groundwater intelligence prototype platform.',
};

export default function TermsPage() {
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
            This document represents a conservative draft Terms of Service statement for the JalDrishti software demonstration. It is subject to legal review by relevant governing authorities before operational deployment.
          </p>
        </div>
      </div>

      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Platform Governance & Terms
        </p>
        <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
          Terms of Service & Usage Guidelines
        </h1>
        <p className="text-xs text-text-muted">
          Last revised: October 17, 2026 • Version 1.0 (Prototype Evaluation)
        </p>
      </header>

      <section className="space-y-6 text-xs text-text-main leading-relaxed">
        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">1. Nature of the Platform</h2>
          <p className="text-text-muted">
            JalDrishti is an India-focused groundwater intelligence and decision-support prototype. The platform synthesizes observational telemetry, satellite-derived indicators, geospatial aggregations, and research-stage machine learning predictions across designated priority states.
          </p>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">2. Non-Statutory Decision Support & Safeguard Disclaimers</h2>
          <p className="text-text-muted">
            All analytical outputs—including the Groundwater Stress Score (GSS), multi-quarter quantile forecasts, and algorithmic intervention suggestions—are informational indicators designed to assist human analysts. They do not constitute statutory disaster declarations, official drought notifications, or binding financial sanctions under the Central Ground Water Authority (CGWA) or State Ground Water Departments.
          </p>
          <p className="text-text-muted">
            Authorized administrative actions (such as well construction moratoriums, disaster relief funding, or artificial recharge sanctions) must be preceded by ground-level piezometric verification and certified hydrogeological surveys.
          </p>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">3. Data Provenance and Open Government Sources</h2>
          <p className="text-text-muted">
            JalDrishti ingests data published by public government agencies and open Earth observation archives:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-text-muted">
            <li>Central Ground Water Board (CGWB) & National Water Informatics Centre (NWIC) telemetry.</li>
            <li>India Meteorological Department (IMD) high-resolution gridded rainfall baselines.</li>
            <li>NASA Jet Propulsion Laboratory & GFZ Potsdam GRACE/GRACE-FO terrestrial water storage anomalies.</li>
            <li>European Space Agency (ESA) Copernicus Sentinel-2 multispectral surface reflectance.</li>
            <li>NASA Goddard Space Flight Center SMAP radiometer surface soil moisture products.</li>
          </ul>
          <p className="text-text-muted mt-2">
            The platform does not claim proprietary copyright over third-party official datasets. Source licensing, update intervals, and spatial uncertainties documented in the Data Sources registry apply.
          </p>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">4. Demonstration Safeguards & Simulated Dispatches</h2>
          <p className="text-text-muted">
            During prototype demonstration and hackathon evaluation modes:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-text-muted">
            <li>No real SMS, WhatsApp, or external telecom broadcasts are transmitted.</li>
            <li>Advisory dispatches generated in the interface are stored as simulated records only.</li>
            <li>Simulated role-switching operates client-side to demonstrate persona workflows without bypassing production authentication controls.</li>
          </ul>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">5. Limitation of Liability</h2>
          <p className="text-text-muted">
            The developers and evaluators provide this software &ldquo;as is&rdquo;, without warranty of any kind, express or implied. Under no circumstances shall the project maintainers be liable for any direct, indirect, incidental, or consequential damages resulting from water management actions taken solely on the basis of model inferences.
          </p>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-bold text-text-main">6. Contact & Review Information</h2>
          <p className="text-text-muted">
            For academic inquiries, methodological verification, or institutional review, please consult the project documentation or inspect the <Link href="/data-sources" className="text-primary underline">Data Sources Registry</Link>.
          </p>
        </article>
      </section>

      <footer className="pt-6 border-t border-border flex items-center justify-between text-xs text-text-muted">
        <Link href="/" className="text-primary hover:underline font-semibold">
          ← Return to Project Brief
        </Link>
        <Link href="/privacy" className="text-primary hover:underline">
          View Privacy Policy Draft →
        </Link>
      </footer>
    </div>
  );
}
