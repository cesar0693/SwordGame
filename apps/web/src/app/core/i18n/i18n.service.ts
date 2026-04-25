import { Injectable, signal } from '@angular/core';
import { DICTIONARY, SUPPORTED_LANGS, type Lang } from './dictionary';

const STORAGE_KEY = 'sg.lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.readStoredLang());

  set(lang: Lang): void {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // private browsing — silent
    }
  }

  /** Translate `key`. Falls back to FR, then to the key itself. */
  t(key: string): string {
    const lang = this.lang();
    return DICTIONARY[lang][key] ?? DICTIONARY.fr[key] ?? key;
  }

  private readStoredLang(): Lang {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && (SUPPORTED_LANGS as string[]).includes(raw)) return raw as Lang;
    } catch {
      // ignore
    }
    return 'fr';
  }
}
