'use client';

import React from 'react';
import Link from 'next/link';
import { InfoIcon } from '@/components/ui/Icons';
import { useLanguage } from '@/lib/context/LanguageContext';

function Banner({ body }: { body: string }) {
  const { t } = useLanguage();
  return (
    <div className="rounded border-l-4 border-l-amber-600 border border-amber-200 bg-amber-50/70 p-5 text-amber-900 flex items-start gap-3">
      <InfoIcon className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed">
        <p className="font-bold uppercase tracking-wider text-amber-950">{t('legal.draftNoticeTitle')}</p>
        <p className="mt-1">{body}</p>
      </div>
    </div>
  );
}

function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { t } = useLanguage();
  return (
    <header className="space-y-2 border-b border-border pb-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">{title}</h1>
      <p className="text-xs text-text-muted">{t('legal.lastRevised')}</p>
    </header>
  );
}

function Para({ k }: { k: string }) {
  const { t } = useLanguage();
  return <p className="text-text-muted">{t(k)}</p>;
}

function Bullets({ keys }: { keys: string[] }) {
  const { t } = useLanguage();
  return (
    <ul className="list-disc pl-5 space-y-1 text-text-muted">
      {keys.map((k) => (
        <li key={k}>{t(k)}</li>
      ))}
    </ul>
  );
}

function Section({ h, children }: { h: string; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <article className="space-y-2">
      <h2 className="text-sm font-bold text-text-main">{t(h)}</h2>
      {children}
    </article>
  );
}

function Footer({ toHref, toKey }: { toHref: string; toKey: string }) {
  const { t } = useLanguage();
  return (
    <footer className="pt-6 border-t border-border flex items-center justify-between text-xs text-text-muted">
      <Link href="/" className="text-primary hover:underline font-semibold">{t('legal.returnBrief')}</Link>
      <Link href={toHref} className="text-primary hover:underline">{t(toKey)}</Link>
    </footer>
  );
}

export function TermsBody() {
  const { t } = useLanguage();
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <Banner body={t('terms.notice')} />
      <Heading eyebrow={t('terms.eyebrow')} title={t('terms.title')} />
      <section className="space-y-6 text-xs text-text-main leading-relaxed">
        <Section h="terms.s1.h"><Para k="terms.s1.p" /></Section>
        <Section h="terms.s2.h"><Para k="terms.s2.p1" /><Para k="terms.s2.p2" /></Section>
        <Section h="terms.s3.h">
          <Para k="terms.s3.p1" />
          <Bullets keys={['terms.s3.l1', 'terms.s3.l2', 'terms.s3.l3', 'terms.s3.l4', 'terms.s3.l5']} />
          <p className="text-text-muted mt-2">{t('terms.s3.p2')}</p>
        </Section>
        <Section h="terms.s4.h">
          <Para k="terms.s4.p" />
          <Bullets keys={['terms.s4.l1', 'terms.s4.l2', 'terms.s4.l3']} />
        </Section>
        <Section h="terms.s5.h"><Para k="terms.s5.p" /></Section>
        <Section h="terms.s6.h">
          <p className="text-text-muted">
            {t('terms.s6.p')}{' '}
            <Link href="/data-sources" className="text-primary underline">{t('terms.s6.link')}</Link>.
          </p>
        </Section>
      </section>
      <Footer toHref="/privacy" toKey="terms.toPrivacy" />
    </div>
  );
}

export function PrivacyBody() {
  const { t } = useLanguage();
  const code = 'bg-subtle px-1 rounded';
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <Banner body={t('privacy.notice')} />
      <Heading eyebrow={t('privacy.eyebrow')} title={t('privacy.title')} />
      <section className="space-y-6 text-xs text-text-main leading-relaxed">
        <Section h="privacy.s1.h">
          <Para k="privacy.s1.p" />
          <ul className="list-disc pl-5 space-y-1 text-text-muted">
            {[1, 2, 3].map((n) => (
              <li key={n}><strong>{t(`privacy.s1.l${n}h`)}</strong> {t(`privacy.s1.l${n}`)}</li>
            ))}
          </ul>
        </Section>
        <Section h="privacy.s2.h">
          <p className="text-text-muted">{t('privacy.s2.p1')} <code className={code}>localStorage</code></p>
          <Bullets keys={['privacy.s2.l1', 'privacy.s2.l2', 'privacy.s2.l3']} />
          <p className="text-text-muted mt-1">{t('privacy.s2.p2')}</p>
        </Section>
        <Section h="privacy.s3.h">
          <p className="text-text-muted">{t('privacy.s3.p')} <code className={code}>public.audit_events</code></p>
        </Section>
        <Section h="privacy.s4.h"><Para k="privacy.s4.p" /></Section>
        <Section h="privacy.s5.h"><Para k="privacy.s5.p" /></Section>
        <Section h="privacy.s6.h"><Para k="privacy.s6.p" /></Section>
      </section>
      <Footer toHref="/terms" toKey="privacy.toTerms" />
    </div>
  );
}
