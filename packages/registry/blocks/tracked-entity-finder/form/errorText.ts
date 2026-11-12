import i18n from '@dhis2/d2-i18n'
import { isProduction } from '../provider/env'
import type { FieldErrorCode, FinderAttribute } from '../rules/types'

/** What the user can do about a value that cannot be searched as is. */
export const errorText = (
    code: FieldErrorCode,
    attribute: FinderAttribute
): string => {
    switch (code) {
        case 'too-short':
            return i18n.t('Enter at least {{count}} characters', {
                count: attribute.minCharacters,
            })
        case 'invalid-number':
            return i18n.t('Enter a number')
        case 'not-integer':
            return i18n.t('Enter a whole number')
        case 'invalid-date':
            return i18n.t('Enter a valid date')
        case 'reversed':
            return i18n.t('From must not be after To')
    }
}

/**
 * A metadata error as shown on screen: the full setup message in
 * development, a short one in production, where end users read it.
 */
export const metadataErrorText = (message: string): string =>
    isProduction() ? i18n.t("This search isn't set up correctly") : message
