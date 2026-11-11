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
    switch (field.id) {
        case 'enrollmentStatus':
            return i18n.t('Enrollment status')
        case 'enrolledAt':
            return i18n.t('Enrollment date')
        case 'enrollmentOccurredAt':
            return i18n.t('Incident date')
        case 'followUp':
            return i18n.t('Follow up')
        case 'assignedUser':
        case 'eventAssignedUser':
            return i18n.t('Assigned to')
        case 'eventOccurredAt':
            return i18n.t('Report date')
        case 'eventStatus':
            return i18n.t('Event status')
        case 'eventScheduledAt':
            return i18n.t('Scheduled date')
        case 'programStage':
            return i18n.t('Program stage')
        case 'createdAt':
            return i18n.t('Registration date')
        case 'programOwnerId':
            return i18n.t('Owner organisation unit')
        case 'eventOrgUnit':
            return i18n.t('Event organisation unit')
        default:
            return field.displayName
    }
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
