import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'JalDrishti (जलदृष्टि) | Groundwater Intelligence & Governance Platform',
  description: 'JAL DRISHTI is an India-focused groundwater intelligence and decision-support platform designed to address groundwater scarcity, depletion, and concerning groundwater conditions across India. Initial geographic priorities: Madhya Pradesh, Punjab, Rajasthan, Haryana, Uttar Pradesh, Assam, Meghalaya, and Arunachal Pradesh.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-text-main font-sans antialiased">
        <Navigation />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="bg-surface border-t border-border mt-12 py-6 text-xs text-text-muted">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-text-main">JalDrishti (जलदृष्टि) — Groundwater Intelligence Platform</p>
              <p className="text-[11px] text-text-muted">India-Focused Platform • Initial Priority States: MP, PB, RJ, HR, UP, Assam, Meghalaya, Arunachal Pradesh | Scientific & Engineering Safeguards Enforced</p>
            </div>
            <div className="flex items-center gap-4 text-text-muted text-[11px]">
              <span>Data Refresh: Oct 2026</span>
              <span>•</span>
              <span>Methodology: Descriptive Baseline v1.0</span>
              <span>•</span>
              <a href="/data-sources" className="hover:underline text-[#0d5c63]">Data Provenance</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
