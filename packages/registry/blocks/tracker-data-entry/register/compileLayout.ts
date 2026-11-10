import i18n from '@dhis2/d2-i18n'
import type { Field } from '@/components/dhis2-value-types'
import type { HeaderCell } from '@/components/spreadsheet'
import type { TrackerColumn } from '../model/types'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import { isGroup } from './layout'
import type {
    EventSlot,
    FieldRef,
    LayoutColumn,
    LayoutNode,
    RegisterLayout,
} from './layout'
import type { RegisterMetadata, RegisterStage } from './metadata'

/** One group of a row's cells that saves to one record. */
export interface SlotDef {
    /** `person`, `enrollment`, `<stage>`, `<stage>#<n>` or `<stage>?<de>=<code>&…` (keys sorted). */
    name: string
    stageId?: string
    kind: 'person' | 'enrollment' | 'single' | 'occurrence' | 'where'
    occurrence?: number
    where?: Readonly<Record<string, string>>
    hasDateColumn: boolean
    /** "Second antenatal care visit 2", "Vaccination: DPT 2". */
    label: string
    /** The stage's name, on every event slot. */
    stageName?: string
    /** A `where` slot's option names as the label shows them: "DPT 2". */
    valuesLabel?: string
}

export interface CompiledLayout {
    /** Id `${slot}:${fieldId}`; the label is the paper's, else the field's. */
    columns: Array<
        TrackerColumn & Required<Pick<TrackerColumn, 'slot' | 'fieldId'>>
    >
    headerRows: HeaderCell[][]
    /** The person and enrolment, then the event slots in column order. */
    slots: SlotDef[]
    rowLabel: ReadonlyArray<{ slot: string; fieldId: string }>
}

type Resolved = {
    slot: SlotDef
    fieldId: string
    name: string
    field: Field
}

const DATE: Field = { valueType: 'DATE' }
// Names and ids are said as they are, not HTML-escaped.
const AS_IS = { escapeValue: false }
/** The slots of a register row's person and enrolment; every other slot is an event's. */
export const PERSON = 'person'
export const ENROLLMENT = 'enrollment'

/** The slot a stage's column names: its name, kind and label. */
const eventSlotOf = (
    stageId: string,
    stage: RegisterStage,
    { occurrence, where }: EventSlot
): SlotDef => {
    const base = {
        stageId,
        stageName: stage.name,
        occurrence,
        where,
        hasDateColumn: false,
    }
    if (occurrence !== undefined) {
        return {
            ...base,
            name: `${stageId}#${occurrence}`,
            kind: 'occurrence',
            label: `${stage.name} ${occurrence}`,
        }
    }
    if (where === undefined) {
        return { ...base, name: stageId, kind: 'single', label: stage.name }
    }
    const values = []
    for (const [id, { field }] of stage.dataElements) {
        const code = where[id]
        if (code !== undefined) {
            // The paper shows an option's name, as its heading does.
            values.push(
                field.options?.find((o) => o.code === code)?.name ?? code
            )
        }
    }
    const pairs = Object.keys(where)
        .sort()
        .map((id) => `${id}=${where[id]}`)
    return {
        ...base,
        name: `${stageId}?${pairs.join('&')}`,
        kind: 'where',
        label: `${stage.name}: ${values.join(' ')}`,
        valuesLabel: values.join(' '),
    }
}

const depthOf = (nodes: LayoutNode[]): number =>
    Math.max(
        0,
        ...nodes.map((node) => (isGroup(node) ? 1 + depthOf(node.children) : 1))
    )

const leavesOf = (nodes: LayoutNode[]): LayoutColumn[] =>
    nodes.flatMap((node) => (isGroup(node) ? leavesOf(node.children) : [node]))

/**
 * The paper's heading rows: a group is a cell as wide as its columns, and a column under fewer groups than the deepest
 * spans the rows below it.
 */
const headerRowsOf = (
    nodes: LayoutNode[],
    heads: Map<LayoutColumn, { id: string; label: string }>
): HeaderCell[][] => {
    const rows: HeaderCell[][] = Array.from(
        { length: depthOf(nodes) },
        () => []
    )
    const walk = (list: LayoutNode[], depth: number, path: string) =>
        list.forEach((node, index) => {
            const id = `${path}${index}`
            if (isGroup(node)) {
                rows[depth]?.push({
                    id: `group:${id}`,
                    label: node.group,
                    span: leavesOf(node.children).length,
                })
                walk(node.children, depth + 1, `${id}.`)
            } else {
                rows[depth]?.push({
                    ...(heads.get(node) ?? { id, label: '' }),
                    span: 1,
                    ...(depth < rows.length - 1 && {
                        rowSpan: rows.length - depth,
                    }),
                })
            }
        })
    walk(nodes, 0, '')
    return rows
}

/**
 * Turns the paper's layout into the grid's slotted columns and heading rows, or says what the program cannot do for
 * it. Nothing here reads DHIS2.
 */
export const compileLayout = (
    layout: RegisterLayout,
    metadata: RegisterMetadata
): { ok: true; compiled: CompiledLayout } | { ok: false; errors: string[] } => {
    const errors: string[] = []
    const person: SlotDef = {
        name: PERSON,
        kind: 'person',
        hasDateColumn: false,
        label: metadata.programName,
    }
    const enrollment: SlotDef = {
        name: ENROLLMENT,
        kind: 'enrollment',
        hasDateColumn: false,
        label: metadata.enrolmentDateName,
    }
    const slots = new Map<string, SlotDef>([
        [PERSON, person],
        [ENROLLMENT, enrollment],
    ])
    // The slot already made for this name, else this one; a column that is kept registers its slot.
    const slotOf = (def: SlotDef) => slots.get(def.name) ?? def

    // The column's field in its slot, or why the program has none; `label` heads the message.
    const resolve = (
        ref: FieldRef,
        label: string | undefined
    ): Resolved | undefined => {
        const missing = (id: string) => {
            errors.push(
                i18n.t('Column "{{label}}": the program has no field {{id}}', {
                    label: label ?? id,
                    id,
                    interpolation: AS_IS,
                })
            )
            return undefined
        }
        if ('attribute' in ref) {
            const attribute = metadata.attributes.get(ref.attribute)
            return attribute === undefined
                ? missing(ref.attribute)
                : {
                      slot: person,
                      fieldId: ref.attribute,
                      name: attribute.name,
                      field: attribute.field,
                  }
        }
        if ('enrollment' in ref) {
            const name =
                ref.enrollment === 'enrolledAt'
                    ? metadata.enrolmentDateName
                    : metadata.incidentDate?.name
            return name === undefined
                ? missing(ref.enrollment)
                : {
                      slot: enrollment,
                      fieldId: ref.enrollment,
                      name,
                      field: DATE,
                  }
        }
        const stage = metadata.stages.get(ref.stage)
        if (stage === undefined) {
            return missing(ref.stage)
        }
        const { occurrence, where } = ref
        if (
            (occurrence !== undefined || where !== undefined) &&
            !stage.repeatable
        ) {
            errors.push(
                i18n.t('Column "{{label}}": {{stage}} is not repeatable', {
                    label: label ?? stage.name,
                    stage: stage.name,
                    interpolation: AS_IS,
                })
            )
            return undefined
        }
        // A repeatable stage has many events: a column names which, or it would take whichever comes first.
        if (
            occurrence === undefined &&
            where === undefined &&
            stage.repeatable
        ) {
            errors.push(
                i18n.t(
                    'Column "{{label}}": {{stage}} is repeatable, so the column needs an occurrence or a where',
                    {
                        label: label ?? stage.name,
                        stage: stage.name,
                        interpolation: AS_IS,
                    }
                )
            )
            return undefined
        }
        const unknown = Object.keys(where ?? {}).find(
            (id) => !stage.dataElements.has(id)
        )
        if (unknown !== undefined) {
            return missing(unknown)
        }
        for (const [id, code] of Object.entries(where ?? {})) {
            const { name, field } = stage.dataElements.get(id) ?? {}
            // A field with no options takes any value.
            if (
                field?.options?.length &&
                !field.options.some((o) => o.code === code)
            ) {
                const error = i18n.t('{{code}} is not an option of {{field}}', {
                    code,
                    field: name,
                    interpolation: AS_IS,
                })
                // Every column of the slot says it: once is enough.
                if (!errors.includes(error)) {
                    errors.push(error)
                }
                return undefined
            }
        }
        const slot = slotOf(eventSlotOf(ref.stage, stage, ref))
        if ('eventDate' in ref) {
            return {
                slot,
                fieldId: EVENT_DATE_COLUMN,
                name: i18n.t('Event date'),
                field: DATE,
            }
        }
        const dataElement = stage.dataElements.get(ref.dataElement)
        return dataElement === undefined
            ? missing(ref.dataElement)
            : {
                  slot,
                  fieldId: ref.dataElement,
                  name: dataElement.name,
                  field: dataElement.field,
              }
    }

    const heads = new Map<LayoutColumn, { id: string; label: string }>()
    const columns: CompiledLayout['columns'] = []
    for (const leaf of leavesOf(layout.columns)) {
        const resolved = resolve(leaf.field, leaf.label)
        if (resolved === undefined) {
            continue
        }
        const { slot, fieldId, name, field } = resolved
        const id = `${slot.name}:${fieldId}`
        const label = leaf.label ?? name
        if (columns.some((c) => c.id === id)) {
            errors.push(
                i18n.t('Column "{{label}}": {{id}} appears more than once', {
                    label,
                    id,
                    interpolation: AS_IS,
                })
            )
            continue
        }
        slots.set(slot.name, slot)
        heads.set(leaf, { id, label })
        // The enrolment's date is `enrolledAt`; its `occurredAt` is the incident date.
        const dateField =
            slot.kind === 'enrollment' ? 'enrolledAt' : EVENT_DATE_COLUMN
        if (slot.kind !== 'person' && fieldId === dateField) {
            slot.hasDateColumn = true
        }
        columns.push({
            id,
            label,
            field,
            slot: slot.name,
            fieldId,
        })
    }

    const has = (slot: string, fieldId: string) =>
        columns.some((c) => c.slot === slot && c.fieldId === fieldId)

    const rowLabel =
        layout.rowLabel?.flatMap((ref) => {
            const resolved = resolve(ref, undefined)
            if (resolved === undefined) {
                return []
            }
            const { slot, fieldId, name } = resolved
            if (!has(slot.name, fieldId)) {
                errors.push(
                    i18n.t(
                        'The row label uses {{field}}, which the layout has no column for',
                        { field: name, interpolation: AS_IS }
                    )
                )
                return []
            }
            return [{ slot: slot.name, fieldId }]
        }) ??
        columns
            .filter(
                (c) =>
                    c.slot === PERSON &&
                    c.field.valueType === 'TEXT' &&
                    !c.field.options?.length
            )
            .slice(0, 2)
            .map(({ slot, fieldId }) => ({ slot, fieldId }))

    // A repeatable stage's slot needs its date: a later visit must not be dated at registration. A single stage's slot
    // takes the enrolment date.
    for (const slot of slots.values()) {
        const stage = metadata.stages.get(slot.stageId ?? '')
        if (
            stage?.repeatable &&
            !slot.hasDateColumn &&
            columns.some((c) => c.slot === slot.name)
        ) {
            errors.push(
                i18n.t('{{slot}} has data columns but no date column', {
                    slot: slot.label,
                    interpolation: AS_IS,
                })
            )
        }
    }

    // What DHIS2 refuses a new row without. Generated attributes are reserved when the row is added.
    const required = (name: string) =>
        errors.push(
            i18n.t(
                'The layout leaves out {{field}}, which a new row cannot be saved without',
                { field: name, interpolation: AS_IS }
            )
        )
    for (const [id, { name, mandatory, generated }] of metadata.attributes) {
        if (mandatory && !generated && !has(PERSON, id)) {
            required(name)
        }
    }
    if (!has(ENROLLMENT, 'enrolledAt')) {
        required(metadata.enrolmentDateName)
    }
    for (const slot of slots.values()) {
        const stage = metadata.stages.get(slot.stageId ?? '')
        if (stage?.validationStrategy !== 'ON_UPDATE_AND_INSERT') {
            continue
        }
        for (const [id, { name, compulsory }] of stage.dataElements) {
            // A where slot's own values are what its new events are created with.
            if (
                compulsory &&
                !has(slot.name, id) &&
                slot.where?.[id] === undefined
            ) {
                required(name)
            }
        }
    }

    return errors.length > 0
        ? { ok: false, errors }
        : {
              ok: true,
              compiled: {
                  columns,
                  headerRows: headerRowsOf(layout.columns, heads),
                  slots: [...slots.values()],
                  rowLabel,
              },
          }
}
