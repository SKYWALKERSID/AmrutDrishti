'use client';

import React from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { PLAIN_LANGUAGE_GLOSSARY, GlossaryEntry } from '@/lib/data/glossary';

interface InlineExplanationProps {
  termId: string;
  className?: string;
  /**
   * If true, displays the full 'whatItMeans' detail along with units.
   * If false (default), displays the concise one-sentence shortSummary.
   */
  variant?: 'summary' | 'detailed' | 'note';
}

/**
 * ALWAYS-VISIBLE INLINE PLAIN-LANGUAGE EXPLANATION COMPONENT
 *
 * Replaces interactive popovers, question-mark icons, and click-to-reveal help.
 * Directly renders the plain-language meaning underneath or beside metrics,
 * chart headers, indicators, and maps so any citizen or official immediately understands.
 */
export const InlineExplanation: React.FC<InlineExplanationProps> = ({
  termId,
  className = '',
  variant = 'summary',
}) => {
  const { language } = useLanguage();
  const entry: GlossaryEntry | undefined = PLAIN_LANGUAGE_GLOSSARY[termId];

  if (!entry) return null;

  const shortSummary = language === 'hi' ? entry.shortSummaryHi : entry.shortSummaryEn;
  const whatItMeans = language === 'hi' ? entry.whatItMeansHi : entry.whatItMeansEn;
  const units = language === 'hi' ? entry.unitsHi : entry.unitsEn;

  if (variant === 'detailed') {
    return (
      <div className={`text-[11px] text-text-muted leading-relaxed space-y-0.5 ${className}`}>
        <p className="font-medium text-text-main/90">{shortSummary}</p>
        <p className="text-[11px] text-text-muted">{whatItMeans}</p>
        {units && <p className="text-[10px] text-text-muted font-mono">Unit: {units}</p>}
      </div>
    );
  }

  if (variant === 'note') {
    return (
      <p className={`text-[11px] text-text-muted leading-normal ${className}`}>
        {whatItMeans} {units ? `(${units})` : ''}
      </p>
    );
  }

  // Default 'summary' variant: clean, concise, always visible
  return (
    <span className={`block text-[11px] font-normal normal-case text-text-muted leading-tight tracking-normal mt-0.5 ${className}`}>
      {shortSummary}
    </span>
  );
};

// Aliases for seamless drop-in rendering with no interactivity or popups
export const TermHelp: React.FC<{ termId: string; className?: string; showBadge?: boolean }> = ({
  termId,
  className = '',
}) => {
  return <InlineExplanation termId={termId} className={className} variant="summary" />;
};

interface WhatAmILookingAtProps {
  title?: string;
  what: string;
  meaning: string;
  whyCare: string;
  recentAndReliable?: string;
  nextSteps?: string;
  initiallyOpen?: boolean;
  className?: string;
}

/**
 * INLINE SECTION EXPLANATION
 * 
 * Renders the explanatory content as simple, naturally flowing paragraphs
 * with comfortable line spacing and clear separation between paragraphs,
 * strictly conforming to DBIM typography standards (no boxes, borders, or multi-columns).
 */
export const WhatAmILookingAt: React.FC<WhatAmILookingAtProps> = ({
  what,
  meaning,
  whyCare,
  recentAndReliable,
  nextSteps,
  className = '',
}: WhatAmILookingAtProps & { className?: string }) => {
  return (
    <div className={`my-4 max-w-4xl space-y-3.5 text-text-muted ${className}`}>
      {what && (
        <p className="dbim-paragraph leading-relaxed">
          {what}
        </p>
      )}
      {meaning && (
        <p className="dbim-paragraph leading-relaxed">
          {meaning}
        </p>
      )}
      {whyCare && (
        <p className="dbim-paragraph leading-relaxed">
          {whyCare}
        </p>
      )}
      {recentAndReliable && (
        <p className="dbim-paragraph leading-relaxed">
          {recentAndReliable}
        </p>
      )}
      {nextSteps && (
        <p className="dbim-paragraph leading-relaxed">
          {nextSteps}
        </p>
      )}
    </div>
  );
};

interface PlainStatusMessageProps {
  type: 'loading' | 'empty' | 'error' | 'stale' | 'no_forecast' | 'info';
  title?: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const PlainStatusMessage: React.FC<PlainStatusMessageProps> = ({
  type,
  title,
  message,
  actionText,
  onAction,
  className = '',
}) => {
  const { language } = useLanguage();

  const getBorderAndBg = () => {
    switch (type) {
      case 'error':
        return 'bg-rose-50 border-rose-200 text-rose-900';
      case 'loading':
        return 'bg-subtle border-border text-text-main animate-pulse';
      case 'empty':
        return 'bg-surface border-border text-text-muted';
      case 'stale':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'no_forecast':
        return 'bg-sky-50 border-sky-200 text-sky-900';
      default:
        return 'bg-subtle border-border text-text-main';
    }
  };

  const defaultTitles: Record<string, { en: string; hi: string }> = {
    loading: { en: 'Loading information...', hi: 'जानकारी लोड हो रही है...' },
    empty: { en: 'No matching records found', hi: 'कोई मेल खाता रिकॉर्ड नहीं मिला' },
    error: { en: 'Could not load data right now', hi: 'अभी डेटा लोड नहीं हो सका' },
    stale: { en: 'Older record shown', hi: 'पिछला उपलब्ध रिकॉर्ड दिखाया जा रहा है' },
    no_forecast: { en: 'Forecast not available for this area', hi: 'इस क्षेत्र के लिए अभी पूर्वानुमान उपलब्ध नहीं है' },
    info: { en: 'Notice', hi: 'सूचना' },
  };

  const displayTitle = title || (language === 'hi' ? defaultTitles[type]?.hi : defaultTitles[type]?.en);

  return (
    <div className={`p-4 rounded border text-xs ${getBorderAndBg()} ${className}`}>
      {displayTitle && <h4 className="font-bold text-sm mb-1">{displayTitle}</h4>}
      <p className="leading-relaxed">{message}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-2.5 px-3 py-1 bg-surface border border-border rounded text-xs font-semibold text-text-main hover:bg-subtle transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
