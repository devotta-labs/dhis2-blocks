import i18n from '@dhis2/d2-i18n'
import type {
    Attribution,
    EventsRuleRow,
    RuleEffects,
    RuleEnrollmentInput,
    RuleEventInput,
} from '@/components/program-rules'
import { cellKey } from '@/components/spreadsheet'
import type { CellStoreState } from '@/components/spreadsheet'
import { formOf } from '../model/types'
import type { DataRecord, EnrollmentRecord, PersonRecord } from '../model/types'
import { ENROLLED_AT } from '../register/registerLoad'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { LoadedForm } from '../sources/types'
import type { TrackerEffects, TrackerMessage } from './effects'

/** What a record's forms hold, for reading its rule effects. */
interface RowFields {
    /** The forms' fields, shown or not; effects on any other field are dropped. */
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

/**
 * What a record's rules act on: every field of its forms, shown in a column or not. An event has its stage; an
 * enrolment its program and its person's tracked entity type, whose rules run together.
 */
export const stageFields = (
    form: Pick<LoadedForm, 'fields' | 'fieldsByForm' | 'required' | 'sections'>,
    formIds: ReadonlyArray<string>,
    optionGroups: RowFields['optionGroups']
): RowFields => {
    const union = (sets: ReadonlyMap<string, ReadonlySet<string>>) =>
        formIds.length === 1
            ? (sets.get(formIds[0]) ?? NONE)
            : new Set(formIds.flatMap((id) => [...(sets.get(id) ?? NONE)]))
    const ids = union(form.fieldsByForm)
    const fields = Array.from(ids, (id) => ({ id, field: form.fields.get(id) }))
    return {
        stageFields: ids,
        required: union(form.required),
        options: new Map(
            fields.flatMap(({ id, field }) =>
                field?.options === undefined
                    ? []
                    : [[id, new Set(field.options.map(({ code }) => code))]]
            )
        ),
        multiText: new Set(
            fields
                .filter(({ field }) => field?.valueType === 'MULTI_TEXT')
                .map(({ id }) => id)
        ),
        optionGroups,
        // Sections are a stage's.
        sections: form.sections.get(formIds[0]) ?? new Map(),
    }
}

// Rule names are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

export type RuleLabelKind = 'hidden' | 'assigned' | 'cleared'
export type RuleLabelCache = Map<RuleLabelKind, Map<string, string>>

const RULE_LABEL_KEYS = {
    hidden: 'Hidden by rule: {{rule}}',
    assigned: 'Assigned by rule: {{rule}}',
    cleared: 'Cleared by rule: {{rule}}',
} satisfies Record<RuleLabelKind, string>

export const createRuleLabelCache = (): RuleLabelCache => new Map()

export const ruleLabel = (
    cache: RuleLabelCache,
    kind: RuleLabelKind,
    ruleName: string
) => {
    let labels = cache.get(kind)
    const cached = labels?.get(ruleName)
    if (cached !== undefined) {
        return cached
    }
    const text = i18n.t(RULE_LABEL_KEYS[kind], {
        nsSeparator: '::',
        rule: ruleName,
        interpolation: AS_IS,
    })
    if (labels === undefined) {
        labels = new Map()
        cache.set(kind, labels)
    }
    labels.set(ruleName, text)
    return text
}

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
export const rowRuleOutcome = (
    effects: RuleEffects,
    row: RowFields,
    labels: RuleLabelCache = createRuleLabelCache()
) => {
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
            ({ kind, text }): TrackerMessage =>
                kind === 'errorOnComplete' || kind === 'warningOnComplete'
                    ? {
                          tone:
                              kind === 'errorOnComplete' ? 'error' : 'warning',
                          text,
                          source: 'rule',
                          onComplete: true,
                      }
                    : { tone: kind, text, source: 'rule' }
        )

    const cells = new Map<string, TrackerEffects>()
    for (const field of stageFields) {
        const hidden = hiddenBy.get(field)
        const assigned = effects.assignedValues.get(field)
        cells.set(field, {
            required: isRequired(field),
            hiddenBy: hidden && ruleLabel(labels, 'hidden', hidden.ruleName),
            readOnly:
                assigned && ruleLabel(labels, 'assigned', assigned.by.ruleName),
            messages: messagesOf(field),
            hiddenOptions: hiddenOptionsOf(field),
        })
    }

    const notes = [...effects.displayTexts, ...effects.keyValuePairs].map(
        ({ label, value }) => [label, value].filter(Boolean).join(' ')
    )

    return { cells, assignments, rowMessages: messagesOf('form'), notes }
}

/** A person's enrolment as the rules read it: its live dates and the person's attributes that have a value. */
const ruleEnrollmentOf = (
    enrollment: EnrollmentRecord,
    person: PersonRecord,
    cells: CellStoreState['cells'],
    fieldsByForm: LoadedForm['fieldsByForm']
): RuleEnrollmentInput => {
    const valueOf = (recordId: string, field: string) =>
        cells[cellKey(recordId, field)]?.value
    return {
        id: enrollment.id,
        // An empty enrolment date is today's, as the engine has it for a person being registered.
        enrolledAt: valueOf(enrollment.id, ENROLLED_AT) ?? '',
        occurredAt: valueOf(enrollment.id, EVENT_DATE_COLUMN) || undefined,
        orgUnitId: enrollment.orgUnitId,
        status: enrollment.status,
        attributes: Object.fromEntries(
            [...(fieldsByForm.get(person.trackedEntityTypeId) ?? NONE)].flatMap(
                (field): Array<[string, string]> => {
                    const value = valueOf(person.id, field)
                    return value ? [[field, value]] : []
                }
            )
        ),
    }
}

/** The enrolment record and its person, when the form holds both. */
const enrollmentAndPerson = (
    records: ReadonlyMap<string, DataRecord>,
    enrollmentId: string
) => {
    const enrollment = records.get(enrollmentId)
    const person =
        enrollment?.kind === 'enrollment'
            ? records.get(enrollment.trackedEntityId)
            : undefined
    return enrollment?.kind === 'enrollment' && person?.kind === 'trackedEntity'
        ? { enrollment, person }
        : undefined
}

/** A slot's new event nobody typed in, or whose date and values were all cleared: no event yet, to the rules. */
export const isEmptySlot = (
    record: DataRecord,
    cells: CellStoreState['cells'],
    fieldsByForm: LoadedForm['fieldsByForm']
) =>
    record.kind === 'event' &&
    record.isNew === true &&
    record.slot !== undefined &&
    ![EVENT_DATE_COLUMN, ...(fieldsByForm.get(formOf(record)) ?? NONE)].some(
        (field) => cells[cellKey(record.id, field)]?.value
    )

/**
 * Every event record as the rules read it: each field of its form that has a value, shown in a column or not, and its
 * event date; the live values, empty ones left out. An event whose enrolment and person the form holds carries them
 * live. A slot's new event carries its `createdWith` values unless its cells say otherwise: a cell that holds a change,
 * cleared included, replaces the value; a draft alone does not, as the payload sends `createdWith` then. A slot's new
 * event nobody typed in is left out: it never changes which event is newest or previous.
 */
export const ruleRowsOf = (
    records: ReadonlyMap<string, DataRecord>,
    fieldsByForm: LoadedForm['fieldsByForm'],
    cells: CellStoreState['cells']
): EventsRuleRow[] => {
    const enrollments = new Map<string, RuleEnrollmentInput | undefined>()
    const enrollmentOf = (id: string) => {
        if (!enrollments.has(id)) {
            const both = enrollmentAndPerson(records, id)
            enrollments.set(
                id,
                both &&
                    ruleEnrollmentOf(
                        both.enrollment,
                        both.person,
                        cells,
                        fieldsByForm
                    )
            )
        }
        return enrollments.get(id)
    }
    return Array.from(records.values()).flatMap((record) => {
        if (record.kind !== 'event') {
            return []
        }
        if (isEmptySlot(record, cells, fieldsByForm)) {
            return []
        }
        const valueOf = (field: string) =>
            cells[cellKey(record.id, field)]?.value
        const fields = fieldsByForm.get(formOf(record)) ?? NONE
        const occurredAt = valueOf(EVENT_DATE_COLUMN) || undefined
        const typed = Object.fromEntries(
            [...fields].flatMap((field): Array<[string, string]> => {
                const value = valueOf(field)
                return value ? [[field, value]] : []
            })
        )
        // A where-slot's new event carries its where values, as the payload sends them, unless a cell holds a change.
        const changed = (field: string) => {
            const cell = cells[cellKey(record.id, field)]
            return (
                cell !== undefined &&
                (cell.value !== undefined || cell.sync !== 'idle')
            )
        }
        const dataValues = {
            ...Object.fromEntries(
                Object.entries(record.createdWith ?? {}).filter(
                    ([field]) => !changed(field)
                )
            ),
            ...typed,
        }
        const enrollment =
            record.enrollmentId === undefined
                ? undefined
                : enrollmentOf(record.enrollmentId)
        return {
            event: {
                id: record.id,
                programStageId: record.programStageId,
                orgUnitId: record.orgUnitId,
                status: record.status,
                occurredAt,
                dataValues,
            },
            enrollmentId: record.enrollmentId,
            ...(enrollment !== undefined && { enrollment }),
        }
    })
}

/**
 * `ruleRowsOf` for one form, built again only when the records or the cells are other objects than last time: every
 * slice and edit in between reads the same array, which the rules index once.
 */
export const ruleRowsCache = (fieldsByForm: LoadedForm['fieldsByForm']) => {
    let built:
        | {
              records: ReadonlyMap<string, DataRecord>
              cells: CellStoreState['cells']
              rows: EventsRuleRow[]
          }
        | undefined
    return (
        records: ReadonlyMap<string, DataRecord>,
        cells: CellStoreState['cells']
    ) => {
        if (built?.records !== records || built.cells !== cells) {
            built = {
                records,
                cells,
                rows: ruleRowsOf(records, fieldsByForm, cells),
            }
        }
        return built.rows
    }
}

/** Every event of the enrolment. */
const eventsOf = (
    records: ReadonlyMap<string, DataRecord>,
    enrollmentId: string
) =>
    [...records.values()]
        .filter(
            (other) =>
                other.kind === 'event' && other.enrollmentId === enrollmentId
        )
        .map(({ id }) => id)

/**
 * The records whose rules a change of the whole record can change: an event's, every event of its enrolment (else its
 * own id), and the enrolment when the form holds it; an enrolment's, itself and its events; a person's, each enrolment
 * of theirs with its events.
 */
export const personRows = (
    records: ReadonlyMap<string, DataRecord>,
    record: DataRecord
): string[] => {
    switch (record.kind) {
        case 'event': {
            if (record.enrollmentId === undefined) {
                return [record.id]
            }
            // A register's enrolment rules read its events.
            const enrollment = records.get(record.enrollmentId)
            return enrollment?.kind === 'enrollment'
                ? personRows(records, enrollment)
                : eventsOf(records, record.enrollmentId)
        }
        case 'enrollment':
            return [record.id, ...eventsOf(records, record.id)]
        case 'trackedEntity':
            return [...records.values()].flatMap((other) =>
                other.kind === 'enrollment' &&
                other.trackedEntityId === record.id
                    ? personRows(records, other)
                    : []
            )
    }
}

/** The records a record's rule effects land on: its own, and an enrolment's person, whose attributes its rules act on. */
export const partsOf = (
    records: ReadonlyMap<string, DataRecord>,
    record: DataRecord
): DataRecord[] => {
    const person =
        record.kind === 'enrollment'
            ? enrollmentAndPerson(records, record.id)?.person
            : undefined
    return person === undefined ? [record] : [record, person]
}

/** Each enrolment's events among the rule rows, by enrolment id. */
export const eventsByEnrollment = (rows: ReadonlyArray<EventsRuleRow>) => {
    const byEnrollment = new Map<string, RuleEventInput[]>()
    for (const { event, enrollmentId } of rows) {
        if (enrollmentId !== undefined) {
            byEnrollment.set(enrollmentId, [
                ...(byEnrollment.get(enrollmentId) ?? []),
                event,
            ])
        }
    }
    return byEnrollment
}

/**
 * What an enrolment's rules run on: its person's live attributes and its dates, and its events (`events`), none for a
 * person being registered, as in Capture. Undefined when the form does not hold the enrolment and its person.
 */
export const enrollmentUnitOf = (
    records: ReadonlyMap<string, DataRecord>,
    enrollmentId: string,
    cells: CellStoreState['cells'],
    fieldsByForm: LoadedForm['fieldsByForm'],
    events: () => RuleEventInput[]
) => {
    const both = enrollmentAndPerson(records, enrollmentId)
    return (
        both && {
            enrollment: ruleEnrollmentOf(
                both.enrollment,
                both.person,
                cells,
                fieldsByForm
            ),
            events: both.enrollment.isNew ? [] : events(),
        }
    )
}
