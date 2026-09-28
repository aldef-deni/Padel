import type { TFunction } from 'i18next'
import { ApiRequestError } from './api'

export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) return t('errors.forbidden')
    if (error.status === 404) return t('errors.notFound')
    if (error.status === 409) return t('errors.conflict')
    return error.message
  }
  if (error instanceof TypeError) return t('errors.network')
  return t('errors.generic')
}
