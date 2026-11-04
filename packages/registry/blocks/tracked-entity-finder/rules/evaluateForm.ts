import { errorCodeOf, fieldSchema } from './fieldSchema'
import { attributeOf, canSendMatch, RANGE_KINDS } from './programModel'
import { seal } from './seal'
import type {
    FieldErrorCode,
    FieldValue,
    FinderAttribute,
    FormField,
    FormVerdict,
    MetadataError,
    ProgramModel,
    SearchCondition,
} from './types'

type Match = FormField['match']

/** What one field contributes: nothing, an error, or the conditions to send. */
type Reading =
    | { readonly state: 'empty' }
    | { readonly state: 'error'; readonly code: FieldErrorCode }
    | { readonly state: 'filled'; readonly conditions: SearchCondition[] }

const EMPTY: Reading = { state: 'empty' }
const failed = (code: FieldErrorCode): Reading => ({ state: 'error', code })
const fill = (conditions: SearchCondition[]): Reading => ({
    state: 'filled',
    conditions,
})

const metadataErrorOf = (
    model: ProgramModel,
    { attribute: id, match }: FormField
): MetadataError['kind'] | undefined => {
    const attribute = attributeOf(model, id)
    if (!attribute) {
        return 'unknown-attribute'
    }
    if (!attribute.searchable) {
        return 'not-searchable'
    }
    if (attribute.kind === 'unsupported') {
        return 'unsupported-type'
    }
    if (
        match === 'range' &&
        (attribute.unique || !RANGE_KINDS.has(attribute.kind))
    ) {
        return 'range-not-supported'
    }
    if (!canSendMatch(attribute, attribute.blocked, match)) {
        return 'operators-blocked'
    }
    return undefined
}

/**
 * Attribute ids composed both as an exact field and as a range in one form.
 * They would share one value of two shapes, so neither is searched.
 */
const rangeConflicts = (fields: readonly FormField[]): Set<string> => {
    const exact = new Set<string>()
    const range = new Set<string>()
    for (const { attribute, match } of fields) {
        ;(match === 'range' ? range : exact).add(attribute)
    }
    return new Set([...exact].filter((id) => range.has(id)))
}

const readField = (
    attribute: FinderAttribute,
    match: Match,
    value: FieldValue | undefined
): Reading => {
    const result = fieldSchema(attribute, match).safeParse(value)
    if (!result.success) {
        // Anything but a field error is a value of the wrong shape: empty.
        const code = errorCodeOf(result.error)
        return code ? failed(code) : EMPTY
    }
    return result.data ? fill([...result.data]) : EMPTY
}

const verdict = (
    fields: Omit<FormVerdict, 'metadataErrors' | 'errors'> & {
        metadataErrors: MetadataError[]
        errors: Record<string, FieldErrorCode>
    }
): FormVerdict =>
    Object.freeze({
        ...fields,
        metadataErrors: Object.freeze(
            fields.metadataErrors.map((error) => Object.freeze(error))
        ),
        errors: Object.freeze(fields.errors),
    })

/** A composed field the program allows, with its attribute. */
interface UsableField {
    attribute: FinderAttribute
    match: Match
}

/**
 * Splits one form's composed fields into the ones the program allows and the
 * metadata errors of the rest. Composed ids are re-checked against the
 * metadata here, so a field the program does not allow never reaches a search.
 */
const sortFields = (model: ProgramModel, fields: readonly FormField[]) => {
    const conflicts = rangeConflicts(fields)
    const metadataErrors: MetadataError[] = []
    const reported = new Set<string>()
    const usable: UsableField[] = []
    const seen = new Set<string>()

    for (const field of fields) {
        if (seen.has(field.attribute)) {
            continue
        }
        const kind = conflicts.has(field.attribute)
            ? 'shape-conflict'
            : metadataErrorOf(model, field)
        if (kind) {
            if (!reported.has(field.attribute)) {
                reported.add(field.attribute)
                metadataErrors.push({ kind, attribute: field.attribute })
            }
            continue
        }
        const attribute = attributeOf(model, field.attribute)
        if (attribute) {
            seen.add(field.attribute)
            usable.push({ attribute, match: field.match })
        }
    }
    return { usable, metadataErrors }
}

/**
 * Judges one form's composed fields and values against the program's search
 * rules: each value through its field schema, then the form as a whole.
 */
export const evaluateForm = (
    model: ProgramModel,
    fields: readonly FormField[],
    values: Readonly<Record<string, FieldValue | undefined>>
): FormVerdict => {
    const { usable, metadataErrors } = sortFields(model, fields)

    const needed = Math.max(model.minAttributes, 1)
    const uniques = usable.filter(({ attribute }) => attribute.unique)
    if (!uniques.length && usable.length < needed) {
        metadataErrors.push({ kind: 'form-cannot-search' })
    }

    const errors: Record<string, FieldErrorCode> = {}
    const filledFields: {
        attribute: FinderAttribute
        conditions: SearchCondition[]
    }[] = []
    for (const { attribute, match } of usable) {
        const value = Object.hasOwn(values, attribute.id)
            ? values[attribute.id]
            : undefined
        const reading = readField(attribute, match, value)
        if (reading.state === 'error') {
            errors[attribute.id] = reading.code
        } else if (reading.state === 'filled') {
            filledFields.push({ attribute, conditions: reading.conditions })
        }
    }

    const filledUnique = filledFields.filter(
        ({ attribute }) => attribute.unique
    )
    const filledOthers = filledFields.filter(
        ({ attribute }) => !attribute.unique
    )
    const missing = Math.max(0, needed - filledOthers.length)
    const base = { metadataErrors, errors, missing }

    if (metadataErrors.some(({ kind }) => kind === 'form-cannot-search')) {
        return verdict({ ...base, reason: 'metadata-error' })
    }
    if (Object.keys(errors).length) {
        return verdict({ ...base, reason: 'has-errors' })
    }
    if (filledUnique.length > 1) {
        return verdict({ ...base, reason: 'two-ids' })
    }
    const [id] = filledUnique
    if (id) {
        return verdict({
            ...base,
            reason: 'ready',
            searchingBy: id.attribute.id,
            dropped: filledOthers.length,
            search: seal([
                { attribute: id.attribute.id, conditions: id.conditions },
            ]),
        })
    }
    if (!filledOthers.length) {
        return verdict({ ...base, reason: 'empty' })
    }
    if (missing > 0) {
        return verdict({ ...base, reason: 'needs-more' })
    }
    return verdict({
        ...base,
        reason: 'ready',
        search: seal(
            filledOthers.map(({ attribute, conditions }) => ({
                attribute: attribute.id,
                conditions,
            }))
        ),
    })
}
