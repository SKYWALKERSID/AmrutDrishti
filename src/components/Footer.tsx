'use client';

import React from 'react';
import Link from 'next/link';
import { WaterDropletIcon, ShieldCheckIcon } from '@/components/ui/Icons';
import { useLanguage } from '@/lib/context/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const navLinks: Array<[string, string]> = [
    ['/overview', 'nav.overview'],
    ['/explorer', 'nav.explorer'],
    ['/monitoring', 'nav.monitoring'],
    ['/risk-assessment', 'nav.risk'],
    ['/interventions', 'nav.interventions'],
    ['/alerts', 'nav.alerts'],
    ['/data-sources', 'nav.datasources'],
    ['/admin', 'nav.admin'],
  ];
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
                AMRUT DRISHTI (अमृत दृष्टि)
              </span>
              <span className="text-[11px] text-text-muted">v1.0</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed max-w-md">{t('footer.tagline')}</p>
          </div>

          <div className="md:col-span-4 space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-main">
              {t('footer.modules')}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {navLinks.map(([href, key]) => (
                <Link key={href} href={href} className="hover:text-primary hover:underline">{t(key)}</Link>
              ))}
            </div>
          </div>

          <div className="md:col-span-3 space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-main">
              {t('footer.governance')}
            </h3>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/" className="hover:text-primary hover:underline">{t('footer.brief')}</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary hover:underline">{t('footer.terms')}</Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary hover:underline">{t('footer.privacy')}</Link>
              </li>
              <li className="pt-2 text-[11px] text-text-muted flex items-center gap-1.5">
                <ShieldCheckIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{t('footer.nonOperational')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom: Asterisked Explanations for Application-Wide Limitations */}
        <div className="space-y-3 text-[11px] leading-relaxed text-text-muted">
          <p className="font-bold text-xs uppercase tracking-wider text-text-main">
            {t('footer.notesTitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <p>
              <strong className="text-text-main">{t('footer.freshnessLabel')}</strong> {t('footer.freshnessText')}
            </p>
            <p>
              <strong className="text-text-main">{t('footer.indicatorsLabel')}</strong> {t('footer.indicatorsText')}
            </p>
            <p>
              <strong className="text-text-main">{t('footer.integrityLabel')}</strong> {t('footer.integrityText')}
            </p>
            <p>
              <strong className="text-text-main">{t('footer.regulatoryLabel')}</strong> {t('footer.regulatoryText')}
            </p>
          </div>
          <div className="pt-2.5 pb-1 text-[11px] text-text-muted italic border-t border-border/40">
            {t('footer.renameNote')}
          </div>
          <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-text-muted">
            <p>{t('footer.copyright')}</p>
            <p>{t('footer.coverage')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
