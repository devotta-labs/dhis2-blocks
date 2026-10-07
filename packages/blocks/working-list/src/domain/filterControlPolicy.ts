import type { WorkingListCapabilities } from '../api/capabilities'
import type { WorkingListField } from './model'

type FilterPolicyTranslate = (message: string) => string

const identityTranslate: FilterPolicyTranslate = (message) => message

export const usesMultipleOptionSelection = (
    field: WorkingListField,
    capabilities: WorkingListCapabilities
) => capabilities.multipleOptionValues && field.source !== 'system'

export const fieldDisplayName = (
    field: WorkingListField,
    translate: FilterPolicyTranslate = identityTranslate
) => {
    if (field.displayNameIsMetadata) {
        return field.displayName
    }

    const labels = new Map([
        ['enrollmentStatus', translate('Enrollment status')],
        ['enrolledAt', translate('Enrollment date')],
        ['enrollmentOccurredAt', translate('Incident date')],
        ['followUp', translate('Follow up')],
        ['assignedUser', translate('Assigned to')],
        ['eventOccurredAt', translate('Report date')],
        ['eventStatus', translate('Event status')],
        ['eventScheduledAt', translate('Scheduled date')],
        ['eventAssignedUser', translate('Assigned to')],
        ['programStage', translate('Program stage')],
        ['createdAt', translate('Registration date')],
        ['programOwnerId', translate('Owner organisation unit')],
        ['eventOrgUnit', translate('Event organisation unit')],
    ])

    return labels.get(field.id) ?? field.displayName
}

export const optionDisplayName = (
    field: WorkingListField,
    option: { code: string; displayName: string },
    translate: FilterPolicyTranslate = identityTranslate
) => {
    if (field.source !== 'system') {
        return option.displayName
    }

    switch (option.code) {
        case 'ACTIVE':
            return translate('Active')
        case 'COMPLETED':
            return translate('Completed')
        case 'CANCELLED':
            return translate('Cancelled')
        case 'SCHEDULE':
            return translate('Scheduled')
        case 'OVERDUE':
            return translate('Overdue')
        case 'SKIPPED':
            return translate('Skipped')
        case 'VISITED':
            return translate('Visited')
        default:
            return option.displayName
    }
}

export const localizedField = (
    field: WorkingListField,
    translate: FilterPolicyTranslate = identityTranslate
): WorkingListField => ({
    ...field,
    displayName: fieldDisplayName(field, translate),
    options: field.options?.map((option) => ({
        ...option,
        displayName: optionDisplayName(field, option, translate),
    })),
})
