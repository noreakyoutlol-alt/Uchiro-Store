import { km, LocaleStrings } from './km';
import { en } from './en';

export { km, en };
export type { LocaleStrings };

export function getLocale(lang: string = 'km'): LocaleStrings {
  return lang === 'en' ? en : km;
}
