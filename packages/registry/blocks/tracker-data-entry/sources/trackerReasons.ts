import i18n from '@dhis2/d2-i18n'
import type { DataRecord } from '../model/types'

// Field names are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

/** Why a change to a record DHIS2 no longer returns fails. */
export const goneReason = (kind: DataRecord['kind']) => {
    switch (kind) {
        case 'event':
            return i18n.t(
                'This event was deleted or you no longer have access to it'
            )
        case 'enrollment':
            return i18n.t(
                'This enrolment was deleted or you no longer have access to it'
            )
        case 'trackedEntity':
            return i18n.t(
                'This person was deleted or you no longer have access to it'
            )
    }
}

/** Why a new person or enrolment waits: the fields it is not saved without. */
export const waitingFor = (fields: ReadonlyArray<string>) =>
    i18n.t('Waiting for: {{fields}}', {
        nsSeparator: '::',
        fields: fields.join(', '),
        interpolation: AS_IS,
    })

/** Why an event's changes wait: the fields it is not saved without. */
export const eventWait = (fields: ReadonlyArray<string>) =>
    i18n.t('Waiting for required fields: {{fields}}', {
        nsSeparator: '::',
        fields: fields.join(', '),
        interpolation: AS_IS,
    })

/** Why the records of a person or enrolment that is not saved yet wait. */
export const waitingForParent = (kind: DataRecord['kind']) =>
    kind === 'trackedEntity'
        ? i18n.t('Waiting for the person to be saved')
        : i18n.t('Waiting for the enrolment to be saved')
