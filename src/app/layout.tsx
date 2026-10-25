import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { RoleProvider } from '@/lib/context/RoleContext';
import { LanguageProvider } from '@/lib/context/LanguageContext';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'JalDrishti (जलदृष्टि) | Groundwater Intelligence & Governance Platform',
  description: 'India-focused groundwater intelligence and decision-support platform for 9 active states: Karnataka, Telangana, Tamil Nadu, Madhya Pradesh, Rajasthan, Haryana, Punjab, Meghalaya, and Tripura.',
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
            <main className="flex-1 w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
              {children}
            </main>
            <Footer />
          </RoleProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

