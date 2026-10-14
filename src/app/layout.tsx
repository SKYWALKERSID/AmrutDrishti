import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { RoleProvider } from '@/lib/context/RoleContext';
import { LanguageProvider } from '@/lib/context/LanguageContext';

export const metadata: Metadata = {
  title: 'JalDrishti (जलदृष्टि) | Groundwater Intelligence & Governance Platform',
  description: 'Satellite-assisted groundwater early warning and decision-support platform for Bundelkhand, Madhya Pradesh, India.',
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
        <LanguageProvider>
          <RoleProvider>
            <Navigation />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </main>
            <footer className="bg-surface border-t border-border mt-12 py-5 text-xs text-text-muted">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="font-semibold text-text-main">JalDrishti (जलदृष्टि) — Satellite-Assisted Groundwater Intelligence Platform</p>
                  <div className="flex items-center gap-4 text-text-muted text-xs">
                    <a href="/data-sources" className="hover:underline text-[#0d5c63]">Data Sources</a>
                  </div>
                </div>
                <div className="pt-2 border-t border-border text-[11px] leading-relaxed text-text-muted">
                  <span className="font-semibold text-text-main">Disclaimer:</span> All indicators are derived from verified Central Ground Water Board (CGWB) observation wells, National Water Informatics Centre telemetry, and satellite products across 8 active states (Madhya Pradesh, Uttar Pradesh, Punjab, Rajasthan, Haryana, Arunachal Pradesh, Sikkim, Assam). Missing observations are preserved as unavailable data and never fabricated.
                </div>
              </div>
            </footer>
          </RoleProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

