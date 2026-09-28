// Optional brand images from src/assets/brand (detected at build time, so no 404 when absent).
const heroImages = import.meta.glob<string>('../assets/brand/login-hero.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})
const logoImages = import.meta.glob<string>('../assets/brand/logo.{svg,png,webp}', {
  eager: true,
  import: 'default',
})

export const loginHeroImage: string | undefined = Object.values(heroImages)[0]
export const logoImage: string | undefined = Object.values(logoImages)[0]
