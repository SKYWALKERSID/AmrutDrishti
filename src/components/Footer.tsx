import React from 'react';
import Link from 'next/link';
import { WaterDropletIcon, ShieldCheckIcon } from '@/components/ui/Icons';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-surface border-t border-border mt-16 py-10 text-xs text-text-muted">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top: Identity, Description & Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-border">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-primary text-text-inverted flex items-center justify-center shrink-0">
                <WaterDropletIcon className="w-4 h-4 text-primary-accent" />
              </div>
              <span className="font-bold text-base text-text-main">
                JalDrishti (जलदृष्टि)
              </span>
              <span className="text-[11px] text-text-muted">v1.0</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed max-w-md">
              India-focused groundwater intelligence and decision-support platform. It brings together groundwater data, India Meteorological Department (IMD) gridded rainfall baselines, and satellite Earth observations for research and evidence-based planning across 9 approved states. Experimental station telemetry is not verified block-level groundwater evidence.
            </p>
          </div>

          <div className="md:col-span-4 space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-main">
              Platform Modules
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <Link href="/overview" className="hover:text-primary hover:underline">Overview</Link>
              <Link href="/explorer" className="hover:text-primary hover:underline">Map Explorer</Link>
              <Link href="/monitoring" className="hover:text-primary hover:underline">Monitoring</Link>
              <Link href="/risk-assessment" className="hover:text-primary hover:underline">Risk &amp; Scoring</Link>
              <Link href="/interventions" className="hover:text-primary hover:underline">Interventions</Link>
              <Link href="/alerts" className="hover:text-primary hover:underline">Alerts &amp; SMS (simulated)</Link>
              <Link href="/data-sources" className="hover:text-primary hover:underline">Data Sources</Link>
              <Link href="/admin" className="hover:text-primary hover:underline">Administration</Link>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-main">
              Governance & Policies
            </h3>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/" className="hover:text-primary hover:underline">Project Brief & Gaps</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary hover:underline">Terms of Service (Draft)</Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary hover:underline">Privacy Policy (Draft)</Link>
              </li>
              <li className="pt-2 text-[11px] text-text-muted flex items-center gap-1.5">
                <ShieldCheckIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Non-operational research prototype</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom: Asterisked Explanations for Application-Wide Limitations */}
        <div className="space-y-3 text-[11px] leading-relaxed text-text-muted">
          <p className="font-bold text-xs uppercase tracking-wider text-text-main">
            Platform Notes & Scientific Limitations
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <p>
              <strong className="text-text-main">* Data Freshness & Cadence:</strong> Telemetry updates follow published agency schedules (CGWB/NWIC daily or quarterly; satellite products operate on 5-day to monthly orbital cycles). Historical records reflect verified observation periods and may not represent instantaneous current levels.
            </p>
            <p>
              <strong className="text-text-main">** Analytical Indicators & Predictive Forecasts:</strong> The Groundwater Stress Score (GSS) is a descriptive decision-support metric. Multi-horizon depth projections are experimental research models (QuantileGB-v2.0) requiring ground verification before statutory action.
            </p>
            <p>
              <strong className="text-text-main">*** Scientific Integrity & Data Gaps:</strong> Where physical observation wells are offline or missing, records are explicitly displayed as data gaps. Missing values are preserved as nulls and are never filled with fabricated zeros or synthetic fallbacks.
            </p>
            <p>
              <strong className="text-text-main">**** Regulatory Status:</strong> All documents, terms, and intervention guidelines remain academic evaluation drafts subject to formal adoption by state groundwater authorities and the Ministry of Jal Shakti.
            </p>
          </div>
          <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-text-muted">
            <p>© 2026 JalDrishti Platform Contributors. Built for open groundwater research and evidence-based planning.</p>
            <p>Active Target Coverage: KA, TG, TN, MP, RJ, HR, PB, ML, TR (9 States across 4 Regions; Assam excluded)</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
