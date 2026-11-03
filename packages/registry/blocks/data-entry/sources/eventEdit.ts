import i18n from '@dhis2/d2-i18n'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import type { EventStatus } from '../model/types'
import { completionExpired, expiryStart } from './expiry'

// Translated when used, so the reasons follow the user's language.
const READ_ONLY = {
    categories: () =>
        i18n.t(
            'Programs with attribute categories are not supported in this grid'
        ),
    noWrite: () => i18n.t('You do not have access to enter data in this stage'),
    skipped: () => i18n.t('Skipped events cannot be edited'),
    blocked: () => i18n.t('Completed events in this stage cannot be edited'),
    expiredPeriod: () => i18n.t('This event is in an expired period'),
    expiredCompletion: () =>
        i18n.t('This event was completed too long ago to edit'),
}

/** Why a completed event of a stage that blocks its entry form cannot be edited. */
export const blockedReason = READ_ONLY.blocked

/** What the edit rules read of an event. */
export interface EditedEvent {
    programStage: string
    status: EventStatus
    occurredAt?: string
    scheduledAt?: string
    completedAt?: string
}

/**
 * Capture's edit rules for a program's events: why one is read-only, and whether the user may reopen it. `today` is
 * the date (`YYYY-MM-DD`) expiry is checked against; expiry periods are built in the server's calendar.
 */
export const eventEditRules = ({
    program,
    stages,
    authorities,
    calendar,
    today,
}: {
    program: {
        categoryCombo: { isDefault: boolean }
        expiryPeriodType?: string
        expiryDays?: number
        completeEventsExpiryDays?: number
    }
    stages: ReadonlyMap<
        string,
        { blockEntryForm: boolean; access: { data: { write: boolean } } }
    >
    authorities: ReadonlyArray<string>
    calendar: string | undefined
    today: string
}) => {
    const has = (authority: string) =>
        authorities.includes('ALL') || authorities.includes(authority)
    const writable = (stageId: string) =>
        program.categoryCombo.isDefault &&
        stages.get(stageId)?.access.data.write === true
    // DHIS2 never expires an event by its period when the program gives no expiry days.
    const opensOn = program.expiryDays
        ? expiryStart(
              program.expiryPeriodType,
              program.expiryDays,
              today,
              parseDhis2Calendar(calendar)
          )
        : undefined
    const expiredReason = (event: EditedEvent) => {
        if (has('F_EDIT_EXPIRED')) {
            return undefined
        }
        const date = (event.occurredAt ?? event.scheduledAt)?.slice(0, 10)
        if (opensOn !== undefined && date !== undefined && date < opensOn) {
            return READ_ONLY.expiredPeriod()
        }
        return completionExpired(
            event.completedAt,
            program.completeEventsExpiryDays,
            today
        )
            ? READ_ONLY.expiredCompletion()
            : undefined
    }
    return {
        has,
        writable,
        /** Why the event cannot be edited, if it cannot. */
        readOnlyReason(event: EditedEvent) {
            if (!program.categoryCombo.isDefault) {
                return READ_ONLY.categories()
            }
            if (!writable(event.programStage)) {
                return READ_ONLY.noWrite()
            }
            if (event.status === 'SKIPPED') {
                return READ_ONLY.skipped()
            }
            if (
                event.status === 'COMPLETED' &&
                stages.get(event.programStage)?.blockEntryForm
            ) {
                return READ_ONLY.blocked()
            }
            return expiredReason(event)
        },
        /** Whether the user may reopen the completed event (`F_UNCOMPLETE_EVENT`, stage write access, not expired). */
        mayReopen: (event: EditedEvent) =>
            event.status === 'COMPLETED' &&
            has('F_UNCOMPLETE_EVENT') &&
            writable(event.programStage) &&
            expiredReason(event) === undefined,
    }
}
