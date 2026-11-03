import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef } from 'react'
import { useEventsRules } from '@/components/program-rules'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { CellKey, DataRecord } from '../model/types'
import type { LoadedForm } from '../sources/types'
import { connectRules } from './connectRules'
import { FORM_MESSAGES } from './context'
import type { OpenForm } from './openForm'

interface RuleEffectsOptions {
    open?: OpenForm
    form?: LoadedForm
    /** The open form's records, as the provider renders them. */
    records: ReadonlyMap<string, DataRecord>
    settings: ValueSettings
    announce(text: string): void
    /** Starts the form's DOM ids. */
    idScope: string
}

/**
 * Program rules over the open form's rows, as Capture runs them: hidden fields and options, assigned values, required
 * fields and messages on their cells, messages without a field on their row. A form without rules runs none.
 */
export const useRuleEffects = ({
    open,
    form,
    records,
    settings,
    announce,
    idScope,
}: RuleEffectsOptions) => {
    // Event rules: the stages and people of the event records; a register's enrolments run enrolment rules too.
    const held = [...records.values()].flatMap((record) =>
        record.kind === 'event' ? [record] : []
    )
    const enrollments = [...records.values()].flatMap((record) =>
        record.kind === 'enrollment' ? [record.id] : []
    )
    // A new person cannot be on DHIS2 yet: their rules run on what the grid holds, offline too.
    const newEnrollmentIds = [...records.values()].flatMap((record) =>
        record.kind === 'enrollment' && record.isNew ? [record.id] : []
    )
    const target = form?.rules
    const { rules, status } = useEventsRules({
        programId: target?.programId ?? '',
        // A page may bring records of another stage.
        programStageIds: [
            ...(target?.programStageIds ?? []),
            ...held.map(({ programStageId }) => programStageId),
        ],
        tracker: target?.tracker ?? false,
        // The records' people, new rows and pages included; a one-person grid names its person before it has a row.
        enrollmentIds: [
            ...(target?.enrollmentIds ?? []),
            ...held.flatMap(({ enrollmentId }) => enrollmentId ?? []),
            ...enrollments,
        ],
        newEnrollmentIds,
        enrollments: form?.rowKind === 'person',
        enabled: target !== undefined,
    })

    // A form with rules completes nothing until they are ready; rules that failed block it, as a form-level error.
    useEffect(() => {
        if (open === undefined || target === undefined || status === 'ready') {
            return undefined
        }
        const failed = status === 'error'
        const reason = failed
            ? i18n.t('Program rules could not be loaded')
            : i18n.t('Program rules are still loading')
        const refuse = () => reason
        open.beforeComplete.add(refuse)
        const withFormError = (error: boolean) =>
            open.effects.setState(({ rowMessages }) => {
                const next = new Map(rowMessages)
                if (error) {
                    next.set(FORM_MESSAGES, [
                        { kind: 'error', text: reason, source: 'rule' },
                    ])
                } else {
                    next.delete(FORM_MESSAGES)
                }
                return { rowMessages: next }
            })
        if (failed) {
            withFormError(true)
        }
        return () => {
            open.beforeComplete.delete(refuse)
            if (failed) {
                withFormError(false)
            }
        }
    }, [open, target, status])

    // One per open form, so what rules cleared and noted and the rows people touched outlive the people refetching.
    const session = useRef<{
        open: OpenForm
        cleared: Map<CellKey, string>
        touched: Set<string>
        ruleNotes: Map<string, ReadonlyArray<string>>
    }>(undefined)
    useEffect(() => {
        if (open === undefined || form === undefined || rules === undefined) {
            return undefined
        }
        if (session.current?.open !== open) {
            session.current = {
                open,
                cleared: new Map(),
                touched: new Set(),
                ruleNotes: new Map(),
            }
        }
        const { cleared, touched, ruleNotes } = session.current
        return connectRules({
            open,
            form,
            rules,
            settings,
            announce,
            cleared,
            touched,
            ruleNotes,
            idScope,
        })
    }, [open, form, rules, settings, announce, idScope])
}
