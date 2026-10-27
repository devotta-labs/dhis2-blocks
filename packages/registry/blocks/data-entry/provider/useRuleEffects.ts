import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef } from 'react'
import { useEventsRules } from '@/components/program-rules'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { CellKey, GridTable } from '../model/types'
import type { LoadedForm } from '../sources/types'
import { connectRules } from './connectRules'
import { FORM_MESSAGES } from './context'
import type { OpenForm } from './openForm'

interface RuleEffectsOptions {
    open?: OpenForm
    form?: LoadedForm
    /** The open form's tables, as the provider renders them. */
    tables: ReadonlyArray<GridTable>
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
    tables,
    settings,
    announce,
    idScope,
}: RuleEffectsOptions) => {
    const target = form?.rules
    const { rules, status } = useEventsRules({
        programId: target?.programId ?? '',
        programStageIds: target?.programStageIds ?? [],
        tracker: target?.tracker ?? false,
        // The rows' people, new rows included; a one-person grid names its person before it has a row.
        enrollmentIds: [
            ...(target?.enrollmentIds ?? []),
            ...tables.flatMap(({ rows }) =>
                rows.flatMap(({ enrollmentId }) => enrollmentId ?? [])
            ),
        ],
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

    // One per open form, so what rules cleared and the rows people touched outlive the people refetching.
    const session = useRef<{
        open: OpenForm
        cleared: Map<CellKey, string>
        touched: Set<string>
    }>(undefined)
    useEffect(() => {
        if (open === undefined || form === undefined || rules === undefined) {
            return undefined
        }
        if (session.current?.open !== open) {
            session.current = { open, cleared: new Map(), touched: new Set() }
        }
        const { cleared, touched } = session.current
        return connectRules({
            open,
            form,
            rules,
            settings,
            announce,
            cleared,
            touched,
            idScope,
        })
    }, [open, form, rules, settings, announce, idScope])
}
