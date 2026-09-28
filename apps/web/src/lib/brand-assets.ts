import aldefLogo from '../assets/brand/aldef-logo.webp'
import aldefMark from '../assets/brand/aldef-mark.webp'

/** Aldef Tech logo: emblem + "ALDEF TECH" wordmark (transparent background). */
export const brandLogo: string = aldefLogo
/** Aldef Tech "A" emblem only, square (transparent background). */
export const brandMark: string = aldefMark

// Optional login photo from src/assets/brand (detected at build time, so no 404 when absent).
const heroImages = import.meta.glob<string>('../assets/brand/login-hero.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})
export const loginHeroImage: string | undefined = Object.values(heroImages)[0]
