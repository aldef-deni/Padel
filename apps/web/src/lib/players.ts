import type { TFunction } from 'i18next'
import { ApiRequestError } from './api'
import { errorMessage } from './errors'

/** Maps API errors of the club players endpoints to UI text. */
export function playerErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 409) {
      if (/already a member/i.test(error.message)) return t('players.errors.alreadyMember')
      if (/admin account/i.test(error.message)) return t('players.errors.adminPhone')
      if (/different accounts/i.test(error.message)) return t('players.errors.differentAccounts')
      return t('players.errors.duplicate')
    }
    if (error.status === 400 && /phone or email is required/i.test(error.message)) return t('players.errors.contactRequired')
    if (error.status === 400 && /phone/i.test(error.message)) return t('players.errors.phoneInvalid')
  }
  return errorMessage(error, t)
}
