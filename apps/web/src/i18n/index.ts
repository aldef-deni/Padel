import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './en'
import { id } from './id'

export const LANGUAGES = ['id', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'padel.lang'

function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'id' || value === 'en') return value
  } catch {
    // Storage unavailable: fall back to the default.
  }
  return 'id'
}

export function setLanguage(lang: Language) {
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Ignore: the choice just won't persist.
  }
}

void i18n.use(initReactI18next).init({
  resources: { id: { translation: id }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
})
document.documentElement.lang = i18n.language

export default i18n
