'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { PLAIN_LANGUAGE_GLOSSARY, GlossaryEntry } from '@/lib/data/glossary';

interface TermHelpProps {
  termId: string;
  className?: string;
  showBadge?: boolean;
}

/**
 * Clickable / Hoverable info helper for any technical term across the site.
 * Explains measurements, satellites, and models in everyday farmer/citizen terms.
 */
export const TermHelp: React.FC<TermHelpProps> = ({ termId, className = '', showBadge = false }) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const entry: GlossaryEntry | undefined = PLAIN_LANGUAGE_GLOSSARY[termId];

  if (!entry) return null;

  const name = language === 'hi' ? entry.nameHi : entry.nameEn;
  const shortSummary = language === 'hi' ? entry.shortSummaryHi : entry.shortSummaryEn;
  const whatItMeans = language === 'hi' ? entry.whatItMeansHi : entry.whatItMeansEn;
  const whyItMatters = language === 'hi' ? entry.whyItMattersHi : entry.whyItMattersEn;
  const units = language === 'hi' ? entry.unitsHi : entry.unitsEn;
  const farmerTip = language === 'hi' ? entry.farmerTipHi : entry.farmerTipEn;

  return (
    <span className={`inline-flex items-center gap-1 relative ${className}`}>
      {showBadge && (
        <span className="text-xs font-medium text-text-main">
          {name}
        </span>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Explain ${name}`}
        title={`Click for simple explanation of ${name}`}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-border/80 hover:bg-primary hover:text-white text-[10px] font-bold text-text-muted transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
      >
        ?
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={name}
          className="absolute z-50 left-0 top-6 w-72 sm:w-80 p-3 bg-surface border border-border shadow-lg rounded text-left text-xs text-text-main"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-1.5 mb-2">
            <div>
              <p className="font-bold text-primary">{name}</p>
              {units && <p className="text-[10px] text-text-muted">Unit: {units}</p>}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-text-main text-sm font-bold leading-none px-1"
              aria-label="Close explanation"
            >
              ×
            </button>
          </div>

          <p className="font-medium text-text-main mb-1.5">{shortSummary}</p>
          <div className="space-y-1.5 text-[11px] text-text-muted">
            <p>
              <strong className="text-text-main">What it means:</strong> {whatItMeans}
            </p>
            <p>
              <strong className="text-text-main">Why it matters:</strong> {whyItMatters}
            </p>
            {farmerTip && (
              <p className="bg-subtle p-1.5 rounded border border-border/40 text-text-main italic text-[11px]">
                💡 {farmerTip}
              </p>
            )}
          </div>
        </div>
      )}
    </span>
  );
};

interface WhatAmILookingAtProps {
  title?: string;
  what: string;
  meaning: string;
  whyCare: string;
  recentAndReliable?: string;
  nextSteps?: string;
  initiallyOpen?: boolean;
}

/**
 * A standard 5-question guidance card placed on major dashboards and maps
 * answering:
 * 1. What am I looking at?
 * 2. What does this information mean?
 * 3. Why should I care?
 * 4. How recent and reliable is it?
 * 5. What can I do next?
 */
export const WhatAmILookingAt: React.FC<WhatAmILookingAtProps> = ({
  title,
  what,
  meaning,
  whyCare,
  recentAndReliable,
  nextSteps,
  initiallyOpen = false,
}) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  const defaultTitle = language === 'hi' 
    ? '💡 इस पृष्ठ को कैसे समझें (सरल मार्गदर्शिका)' 
    : '💡 How to Understand This Page (Quick Guide)';

  return (
    <div className="bg-subtle border border-border rounded p-3 my-3 text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left font-semibold text-text-main hover:text-primary transition-colors focus:outline-none"
      >
        <span className="flex items-center gap-1.5">
          <span>{title || defaultTitle}</span>
        </span>
        <span className="text-xs text-text-muted font-normal">
          {isOpen 
            ? (language === 'hi' ? 'छिपाएँ ▲' : 'Hide ▲') 
            : (language === 'hi' ? 'विस्तार से समझें ▼' : 'Click to learn more ▼')}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-surface p-2.5 rounded border border-border/40">
            <h4 className="font-bold text-primary mb-1">
              {language === 'hi' ? '1. आप क्या देख रहे हैं?' : '1. What am I looking at?'}
            </h4>
            <p className="text-text-muted leading-relaxed">{what}</p>
          </div>

          <div className="bg-surface p-2.5 rounded border border-border/40">
            <h4 className="font-bold text-primary mb-1">
              {language === 'hi' ? '2. इसका क्या अर्थ है?' : '2. What does this mean?'}
            </h4>
            <p className="text-text-muted leading-relaxed">{meaning}</p>
          </div>

          <div className="bg-surface p-2.5 rounded border border-border/40">
            <h4 className="font-bold text-primary mb-1">
              {language === 'hi' ? '3. मुझे इस पर क्यों ध्यान देना चाहिए?' : '3. Why should I care?'}
            </h4>
            <p className="text-text-muted leading-relaxed">{whyCare}</p>
          </div>

          {recentAndReliable && (
            <div className="bg-surface p-2.5 rounded border border-border/40">
              <h4 className="font-bold text-primary mb-1">
                {language === 'hi' ? '4. यह जानकारी कितनी ताज़ा और भरोसेमंद है?' : '4. How recent and reliable is it?'}
              </h4>
              <p className="text-text-muted leading-relaxed">{recentAndReliable}</p>
            </div>
          )}

          {nextSteps && (
            <div className="bg-surface p-2.5 rounded border border-border/40 sm:col-span-2">
              <h4 className="font-bold text-primary mb-1">
                {language === 'hi' ? '5. अब आप क्या कर सकते हैं?' : '5. What can you do next?'}
              </h4>
              <p className="text-text-muted leading-relaxed">{nextSteps}</p>
            </div>
          )}
        </div>
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

/**
 * Standard friendly feedback state for loading, missing readings, empty filters, and errors.
 * Never displays unexplained tech acronyms or silent failures.
 */
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
