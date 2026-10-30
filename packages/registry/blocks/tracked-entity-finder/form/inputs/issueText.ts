import i18n from '@dhis2/d2-i18n'
import type { FieldIssue, FinderAttribute } from '../../rules/types'

/** What the user can do about a value that cannot be searched as is. */
export const issueText = (
    issue: FieldIssue,
    attribute: FinderAttribute
): string => {
    switch (issue) {
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
