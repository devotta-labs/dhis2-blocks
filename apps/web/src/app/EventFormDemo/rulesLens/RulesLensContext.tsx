import { useEventFormState } from '@dhis2-blocks/event-form'
import React, { createContext, useContext, type ReactNode } from 'react'
import type { createAppWorkingListClient } from '../../AppShell/createAppWorkingListClient'
import i18n from '../../../i18n'
import type { EffectKind } from './effects'
import { useLensMetadata, type LensMetadata } from './metadata'

/** Interpolated values are labels and answers, not HTML; React escapes them. */
export const raw = { escapeValue: false }

interface LensValue {
    metadata?: LensMetadata
    metadataError?: Error
    label(fieldId: string): string
    sectionName(sectionId: string): string
    ruleName(ruleId: string, fallback?: string): string
    /**
     * A stage answer as the user sees it: Yes or No for booleans, "empty" when there is none.
     * Undefined for a field that is not in the stage, such as a tracked entity attribute.
     */
    answer(fieldId: string): string | undefined
}

const LensContext = createContext<LensValue | null>(null)

export const useLens = (): LensValue => {
    const value = useContext(LensContext)
    if (value === null) {
        throw new Error('Rules lens parts must be inside RulesLensProvider')
    }
    return value
}

export const showValue = (value: string | undefined | null) => {
    if (value === undefined || value === null || value === '') {
        return i18n.t('empty')
    }
    if (value === 'true') {
        return i18n.t('Yes')
    }
    if (value === 'false') {
        return i18n.t('No')
    }
    return value
}

/** Metadata and labels for the lens parts. Render it inside `EventForm`. */
export const RulesLensProvider = ({
    client,
    programId,
    programStageId,
    children,
}: {
    client: ReturnType<typeof createAppWorkingListClient>
    programId: string
    programStageId: string
    children: ReactNode
}) => {
    const query = useLensMetadata(client, programId, programStageId)
    const { values } = useEventFormState()
    const metadata = query.data
    const stageFields = new Set(
        metadata?.sections.flatMap((section) => section.fieldIds)
    )
    const value: LensValue = {
        metadata,
        metadataError: query.error ?? undefined,
        label: (fieldId) =>
            fieldId === 'form'
                ? i18n.t('the event')
                : (metadata?.labels.get(fieldId) ?? fieldId),
        sectionName: (sectionId) =>
            metadata?.sections.find((section) => section.id === sectionId)
                ?.name ?? sectionId,
        ruleName: (ruleId, fallback) =>
            metadata?.rules.get(ruleId)?.name ?? fallback ?? ruleId,
        answer: (fieldId) =>
            stageFields.has(fieldId) ? showValue(values[fieldId]) : undefined,
    }
    return <LensContext.Provider value={value}>{children}</LensContext.Provider>
}

/**
 * A program rule's name, set apart from the prose around it: rule names are metadata, often
 * cut off at 50 characters, and read badly as part of a sentence.
 */
export const RuleName = ({ children }: { children: ReactNode }) => (
    <span
        className="rounded-dhis2-sm bg-dhis2-grey-200 px-1 py-px font-mono text-[0.85em] font-normal break-words text-dhis2-grey-900"
        title={i18n.t('Program rule')}
    >
        {children}
    </span>
)

/** "A, B, C and 3 more" */
export const listOf = (names: readonly string[]) =>
    names.length <= 3
        ? names.join(', ')
        : i18n.t('{{names}} and {{count}} more', {
              names: names.slice(0, 3).join(', '),
              count: names.length - 3,
              interpolation: raw,
          })

/** What an acting rule action is doing, as a tag. */
export const kindTag = (kind: EffectKind) => {
    switch (kind) {
        case 'hidden':
        case 'hiddenSection':
            return i18n.t('Hidden')
        case 'assigned':
            return i18n.t('Calculated')
        case 'mandatory':
            return i18n.t('Required by a rule')
        case 'error':
            return i18n.t('Rule error')
        case 'warning':
            return i18n.t('Rule warning')
        case 'options':
            return i18n.t('Options limited')
    }
}

/** What a rule could do to a field, from its action types, for a rule not acting now. */
export const wouldDo = (actionTypes: readonly string[] = []) => {
    if (actionTypes.includes('HIDEFIELD')) {
        return i18n.t('Would hide it when')
    }
    if (actionTypes.includes('ASSIGN')) {
        return i18n.t('Would calculate it when')
    }
    if (actionTypes.includes('SETMANDATORYFIELD')) {
        return i18n.t('Would make it required when')
    }
    if (
        actionTypes.some((type) =>
            ['HIDEOPTION', 'HIDEOPTIONGROUP', 'SHOWOPTIONGROUP'].includes(type)
        )
    ) {
        return i18n.t('Would limit its options when')
    }
    if (
        actionTypes.some((type) =>
            [
                'SHOWERROR',
                'SHOWWARNING',
                'ERRORONCOMPLETE',
                'WARNINGONCOMPLETE',
            ].includes(type)
        )
    ) {
        return i18n.t('Would show a message when')
    }
    return i18n.t('Would change it when')
}
