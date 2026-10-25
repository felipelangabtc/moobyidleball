import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { pt } from './pt';
import { en } from './en';

export type Language = 'pt' | 'en';

const DICTS: Record<Language, Record<string, string>> = { pt, en };

interface I18nContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ initial, children }: { initial: Language; children: ReactNode }) {
  const [lang, setLang] = useState<Language>(initial);
  useEffect(() => { setLang(initial); }, [initial]);
  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  }, [lang]);
  const t = (key: string, vars?: Record<string, string | number>): string => {
    const dict = DICTS[lang];
    let value = dict[key] ?? DICTS.pt[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useT() {
  return useI18n().t;
}
