import i18n from '@dhis2/d2-i18n'
import type {
    Attribution,
    EventsRuleRow,
    RuleEffects,
} from '@/components/program-rules'
import { cellKey } from '../model/types'
import type { GridTable } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import type { DataEntryState } from '../store/store'
import type { CellEffects, CellMessage } from './effects'

/** What a row's stage holds, for reading its rule effects. */
interface RowFields {
    /** The stage's data elements; effects on any other field are dropped. */
    stageFields: ReadonlySet<string>
    /** The stage's compulsory data elements. */
    required: ReadonlySet<string>
    /** Field id → its option codes. */
    options: ReadonlyMap<string, ReadonlySet<string>>
    /** `MULTI_TEXT` fields, whose value is a comma-separated list of option codes. */
    multiText: ReadonlySet<string>
    /** Option group id → its option codes. */
    optionGroups: ReadonlyMap<string, ReadonlySet<string>>
    /** The stage's sections: section id → its field ids. */
    sections: ReadonlyMap<string, ReadonlyArray<string>>
}

const NONE: ReadonlySet<string> = new Set()

/** What a stage's rows hold in the table: its columns but the event date and those closed to the stage. */
export const stageFields = (
    form: Pick<LoadedForm, 'closedByStage' | 'required' | 'sections'>,
    table: GridTable,
    stageId: string,
    optionGroups: RowFields['optionGroups']
): RowFields => {
    const closed = form.closedByStage.get(stageId) ?? NONE
    const columns = table.columns.filter(
        ({ id }) => id !== EVENT_DATE_COLUMN && !closed.has(id)
    )
    return {
        stageFields: new Set(columns.map(({ id }) => id)),
        required: form.required.get(stageId) ?? NONE,
        options: new Map(
            columns.flatMap(({ id, field: { options } }) =>
                options === undefined
                    ? []
                    : [[id, new Set(options.map(({ code }) => code))]]
            )
        ),
        multiText: new Set(
            columns
                .filter(({ field }) => field.valueType === 'MULTI_TEXT')
                .map(({ id }) => id)
        ),
        optionGroups,
        sections: form.sections.get(stageId) ?? new Map(),
    }
}

// Rule names are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

/** The value an ASSIGN saves; `null` clears, and DHIS2 refuses a value outside the field's options, so it clears too. */
const assignable = (field: string, value: string | null, row: RowFields) => {
    if (value === null || value === '') {
        return null
    }
    const codes = row.options.get(field)
    if (codes === undefined) {
        return value
    }
    const parts = row.multiText.has(field) ? value.split(',') : [value]
    return parts.every((part) => codes.has(part)) ? value : null
}

/**
 * One row's rule effects as cell effects, values to assign, messages without a field, and notes (display texts and
 * key-value pairs). A required field (by metadata or by a rule) is never hidden. A HIDEFIELD clears its field's
 * value unless an ASSIGN targets it; a hidden section hides its fields and keeps their values.
 */
export const rowRuleOutcome = (effects: RuleEffects, row: RowFields) => {
    const { stageFields, optionGroups } = row
    const isRequired = (field: string) =>
        row.required.has(field) || effects.mandatoryFields.has(field)

    // Hidden fields first, so a field's own HIDEFIELD names it rather than its section's.
    const hiddenBy = new Map<string, Attribution>()
    const hide = (field: string, [by]: Attribution[]) => {
        if (
            by !== undefined &&
            stageFields.has(field) &&
            !isRequired(field) &&
            !hiddenBy.has(field)
        ) {
            hiddenBy.set(field, by)
        }
    }
    for (const [field, by] of effects.hiddenFields) {
        hide(field, by)
    }
    const cleared = Array.from(hiddenBy.keys())
    for (const [section, by] of effects.hiddenSections) {
        for (const field of row.sections.get(section) ?? []) {
            hide(field, by)
        }
    }

    /** Values to commit with source `'rule'`; `null` clears. An ASSIGN wins over hiding. */
    const assignments = new Map<string, string | null>(
        cleared.map((field) => [field, null])
    )
    for (const [field, { value }] of effects.assignedValues) {
        if (stageFields.has(field)) {
            assignments.set(field, assignable(field, value, row))
        }
    }

    const codesOf = (groups: Iterable<string>) =>
        Array.from(groups).flatMap((group) => [
            ...(optionGroups.get(group) ?? []),
        ])
    const hiddenOptionsOf = (field: string) => {
        const groups = effects.optionGroups.get(field)
        const hidden = new Set([
            ...(effects.hiddenOptions.get(field) ?? []),
            ...codesOf(groups?.hidden ?? []),
        ])
        // Once a group is shown, only the shown groups' options are offered.
        if (groups !== undefined && groups.shown.size > 0) {
            const shown = new Set(codesOf(groups.shown))
            for (const code of row.options.get(field) ?? []) {
                if (!shown.has(code)) {
                    hidden.add(code)
                }
            }
        }
        return hidden.size > 0 ? hidden : undefined
    }

    const messagesOf = (field: string) =>
        (effects.messages.get(field) ?? []).map(
            ({ kind, text }): CellMessage => ({ kind, text, source: 'rule' })
        )

    const cells = new Map<string, CellEffects>()
    for (const field of stageFields) {
        const hidden = hiddenBy.get(field)
        const assigned = effects.assignedValues.get(field)
        cells.set(field, {
            required: isRequired(field),
            hiddenBy:
                hidden &&
                i18n.t('Hidden by rule: {{rule}}', {
                    rule: hidden.ruleName,
                    interpolation: AS_IS,
                }),
            readOnly:
                assigned &&
                i18n.t('Assigned by rule: {{rule}}', {
                    rule: assigned.by.ruleName,
                    interpolation: AS_IS,
                }),
            messages: messagesOf(field),
            hiddenOptions: hiddenOptionsOf(field),
        })
    }

    const notes = [...effects.displayTexts, ...effects.keyValuePairs].map(
        ({ label, value }) => [label, value].filter(Boolean).join(' ')
    )

    return { cells, assignments, rowMessages: messagesOf('form'), notes }
}

/** Every row as the rules read it: the grid's live values, empty ones left out. */
export const ruleRowsOf = (
    tables: ReadonlyArray<GridTable>,
    cells: DataEntryState['cells']
): EventsRuleRow[] =>
    tables.flatMap(({ rows, columns }) =>
        rows.flatMap(
            ({ id, programStageId, orgUnitId, status, enrollmentId }) => {
                if (programStageId === undefined || orgUnitId === undefined) {
                    return []
                }
                const { [EVENT_DATE_COLUMN]: occurredAt, ...dataValues } =
                    Object.fromEntries(
                        columns.flatMap(
                            ({ id: column }): Array<[string, string]> => {
                                const value = cells[cellKey(id, column)]?.value
                                return value ? [[column, value]] : []
                            }
                        )
                    )
                return [
                    {
                        event: {
                            id,
                            programStageId,
                            orgUnitId,
                            status: status ?? 'ACTIVE',
                            occurredAt,
                            dataValues,
                        },
                        enrollmentId,
                    },
                ]
            }
        )
    )
