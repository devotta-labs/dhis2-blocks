import i18n from '@dhis2/d2-i18n'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { WorkingListField } from './model'

export const usesMultipleOptionSelection = (
    field: WorkingListField,
    capabilities: WorkingListCapabilities
) => capabilities.multipleOptionValues && field.source !== 'system'

export const fieldDisplayName = (field: WorkingListField) => {
    if (field.displayNameIsMetadata) {
        return field.displayName
    }
    const labels = new Map([
        ['enrollmentStatus', i18n.t('Enrollment status')],
        ['enrolledAt', i18n.t('Enrollment date')],
        ['enrollmentOccurredAt', i18n.t('Incident date')],
        ['followUp', i18n.t('Follow up')],
        ['assignedUser', i18n.t('Assigned to')],
        ['eventOccurredAt', i18n.t('Report date')],
        ['eventStatus', i18n.t('Event status')],
        ['eventScheduledAt', i18n.t('Scheduled date')],
        ['eventAssignedUser', i18n.t('Assigned to')],
        ['programStage', i18n.t('Program stage')],
        ['createdAt', i18n.t('Registration date')],
        ['programOwnerId', i18n.t('Owner organisation unit')],
        ['eventOrgUnit', i18n.t('Event organisation unit')],
    ])
    return labels.get(field.id) ?? field.displayName
}

export const optionDisplayName = (
    field: WorkingListField,
    option: { code: string; displayName: string }
) => {
    if (field.source !== 'system') {
        return option.displayName
    }
    switch (option.code) {
        case 'ACTIVE':
            return i18n.t('Active')
        case 'COMPLETED':
            return i18n.t('Completed')
        case 'CANCELLED':
            return i18n.t('Cancelled')
        case 'SCHEDULE':
            return i18n.t('Scheduled')
        case 'OVERDUE':
            return i18n.t('Overdue')
        case 'SKIPPED':
            return i18n.t('Skipped')
        case 'VISITED':
            return i18n.t('Visited')
        default:
            return option.displayName
    }
}

export const localizedField = (field: WorkingListField): WorkingListField => ({
    ...field,
    displayName: fieldDisplayName(field),
    options: field.options?.map((option) => ({
        ...option,
        displayName: optionDisplayName(field, option),
    })),
})
