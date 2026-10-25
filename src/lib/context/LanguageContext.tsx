'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '@/lib/data/translations';

export type { Language };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const STORAGE_KEY_LANG = 'jaldrishti_language_v1';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const warnedMissingKeys = new Set<string>();
function warnMissingKey(key: string, language: Language): void {
  if (process.env.NODE_ENV === 'production') return;
  const id = `${language}:${key}`;
  if (warnedMissingKeys.has(id)) return;
  warnedMissingKeys.add(id);
  console.warn(`[i18n] Missing "${language}" translation for key "${key}"; using fallback.`);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to Hindi ('hi') for Hindi-first UX
  const [language, setLanguageState] = useState<Language>('hi');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      if (saved === 'hi' || saved === 'en') {
        setLanguageState(saved as Language);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
    } catch {
      // Ignore localStorage write errors
    }
  };

  const t = (key: string, fallback?: string): string => {
    const dict = translations[language];
    if (dict && dict[key]) {
      return dict[key];
    }
    warnMissingKey(key, language);
    const enDict = translations['en'];
    if (enDict && enDict[key]) {
      return enDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
