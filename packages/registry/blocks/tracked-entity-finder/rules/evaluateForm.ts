import { attributeOf } from './programModel'
import { seal } from './seal'
import type {
    ConfigProblem,
    FieldIssue,
    FieldValue,
    FinderAttribute,
    FormField,
    FormVerdict,
    ProgramModel,
    SearchCondition,
    SearchOperator,
} from './types'

type Match = FormField['match']

/** What one field contributes: nothing, an issue, or the conditions to send. */
type Reading =
    | { readonly state: 'empty' }
    | { readonly state: 'issue'; readonly issue: FieldIssue }
    | { readonly state: 'filled'; readonly conditions: SearchCondition[] }

const EMPTY: Reading = { state: 'empty' }
const issue = (found: FieldIssue): Reading => ({ state: 'issue', issue: found })
const fill = (conditions: SearchCondition[]): Reading => ({
    state: 'filled',
    conditions,
})

const RANGE_KINDS = new Set(['number', 'date', 'dateTime'])
const DAY_START = 'T00:00:00.000'
const DAY_END = 'T23:59:59.999'

/** The operators a field of this kind and match sends; all must be allowed. */
const operatorsFor = (
    attribute: FinderAttribute,
    match: Match
): readonly (SearchOperator | undefined)[] => {
    if (match === 'range' || attribute.kind === 'dateTime') {
        return attribute.unique ? ['eq'] : ['ge', 'le']
    }
    if (attribute.kind === 'text' && !attribute.unique) {
        return [attribute.textOperator]
    }
    return ['eq']
}

const problemOf = (
    model: ProgramModel,
    { attribute: id, match }: FormField
): ConfigProblem['kind'] | undefined => {
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
    const operators = operatorsFor(attribute, match)
    if (operators.some((op) => op === undefined || attribute.blocked.has(op))) {
        return 'operators-blocked'
    }
    return undefined
}

/** Attribute ids composed both as an exact field and as a range. */
export const findRangeConflicts = (
    fields: readonly FormField[]
): readonly string[] => {
    const exact = new Set<string>()
    const range = new Set<string>()
    for (const { attribute, match } of fields) {
        ;(match === 'range' ? range : exact).add(attribute)
    }
    return Object.freeze([...exact].filter((id) => range.has(id)))
}

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** A valid value: the trimmed text as typed (sent unchanged) and its order. */
type Parsed =
    | {
          readonly ok: true
          readonly text: string
          readonly order: number | string
      }
    | { readonly ok: false; readonly issue: FieldIssue }
    | undefined

const parseNumber = (raw: string, attribute: FinderAttribute): Parsed => {
    const text = raw.trim()
    if (text === '') {
        return undefined
    }
    if (!NUMBER.test(text)) {
        return { ok: false, issue: 'invalid-number' }
    }
    const value = Number(text)
    if (attribute.valueType.startsWith('INTEGER') && !Number.isInteger(value)) {
        return { ok: false, issue: 'not-integer' }
    }
    return { ok: true, text, order: value }
}

const parseDate = (raw: string | undefined): Parsed => {
    const text = raw?.trim() ?? ''
    if (text === '') {
        return undefined
    }
    const match = ISO_DATE.exec(text)
    if (!match) {
        return { ok: false, issue: 'invalid-date' }
    }
    const [year, month, day] = match.slice(1).map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    const real =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    return real
        ? { ok: true, text, order: text }
        : { ok: false, issue: 'invalid-date' }
}

/** Reads a From–To pair: either side alone fills; `from > to` is reversed. */
const readRange = (
    from: Parsed,
    to: Parsed,
    toValue: (text: string, side: 'from' | 'to') => string
): Reading => {
    for (const side of [from, to]) {
        if (side && !side.ok) {
            return issue(side.issue)
        }
    }
    const low = from?.ok ? from : undefined
    const high = to?.ok ? to : undefined
    if (low && high && low.order > high.order) {
        return issue('reversed')
    }
    const conditions: SearchCondition[] = []
    if (low) {
        conditions.push({ op: 'ge', value: toValue(low.text, 'from') })
    }
    if (high) {
        conditions.push({ op: 'le', value: toValue(high.text, 'to') })
    }
    return conditions.length ? fill(conditions) : EMPTY
}

const readField = (
    attribute: FinderAttribute,
    match: Match,
    value: FieldValue | undefined
): Reading => {
    if (!value) {
        return EMPTY
    }
    const dayBound = (day: string, side: 'from' | 'to') =>
        attribute.kind === 'dateTime'
            ? day + (side === 'from' ? DAY_START : DAY_END)
            : day
    switch (value.kind) {
        case 'text': {
            if (attribute.kind !== 'text') {
                return EMPTY
            }
            const text = value.text.trim()
            if (text === '') {
                return EMPTY
            }
            if (text.length < attribute.minCharacters) {
                return issue('too-short')
            }
            const op = attribute.unique ? 'eq' : attribute.textOperator
            return op ? fill([{ op, value: text }]) : EMPTY
        }
        case 'option':
            return attribute.kind === 'option' &&
                attribute.options?.some(({ code }) => code === value.code)
                ? fill([{ op: 'eq', value: value.code ?? '' }])
                : EMPTY
        case 'boolean':
            return attribute.kind === 'boolean' && value.value
                ? fill([{ op: 'eq', value: value.value }])
                : EMPTY
        case 'trueOnly':
            return attribute.kind === 'trueOnly' && value.checked
                ? fill([{ op: 'eq', value: 'true' }])
                : EMPTY
        case 'number': {
            if (attribute.kind !== 'number' || match !== 'exact') {
                return EMPTY
            }
            const parsed = parseNumber(value.value, attribute)
            if (!parsed) {
                return EMPTY
            }
            return parsed.ok
                ? fill([{ op: 'eq', value: parsed.text }])
                : issue(parsed.issue)
        }
        case 'numberRange':
            return attribute.kind === 'number' && match === 'range'
                ? readRange(
                      parseNumber(value.min, attribute),
                      parseNumber(value.max, attribute),
                      (text) => text
                  )
                : EMPTY
        case 'date': {
            const isDate =
                attribute.kind === 'date' || attribute.kind === 'dateTime'
            if (!isDate || match !== 'exact') {
                return EMPTY
            }
            const parsed = parseDate(value.date)
            if (!parsed) {
                return EMPTY
            }
            if (!parsed.ok) {
                return issue(parsed.issue)
            }
            return attribute.kind === 'dateTime' && !attribute.unique
                ? fill([
                      { op: 'ge', value: dayBound(parsed.text, 'from') },
                      { op: 'le', value: dayBound(parsed.text, 'to') },
                  ])
                : fill([{ op: 'eq', value: parsed.text }])
        }
        case 'dateRange': {
            const isDate =
                attribute.kind === 'date' || attribute.kind === 'dateTime'
            return isDate && match === 'range'
                ? readRange(
                      parseDate(value.from),
                      parseDate(value.to),
                      dayBound
                  )
                : EMPTY
        }
    }
}

const verdict = (
    fields: Omit<FormVerdict, 'problems' | 'issues'> & {
        problems: ConfigProblem[]
        issues: Record<string, FieldIssue>
    }
): FormVerdict =>
    Object.freeze({
        ...fields,
        problems: Object.freeze(fields.problems.map((p) => Object.freeze(p))),
        issues: Object.freeze(fields.issues),
    })

/**
 * Judges one form's composed fields and values against the program's search
 * rules. Composed ids are re-checked against the metadata here, so a field the
 * program does not allow never reaches a search.
 */
export const evaluateForm = (
    model: ProgramModel,
    fields: readonly FormField[],
    values: Readonly<Record<string, FieldValue>>
): FormVerdict => {
    const conflicts = new Set(findRangeConflicts(fields))
    const problems: ConfigProblem[] = []
    const reported = new Set<string>()
    const usable: { attribute: FinderAttribute; match: Match }[] = []
    const seen = new Set<string>()

    for (const field of fields) {
        if (seen.has(field.attribute)) {
            continue
        }
        const kind = conflicts.has(field.attribute)
            ? 'shape-conflict'
            : problemOf(model, field)
        if (kind) {
            if (!reported.has(field.attribute)) {
                reported.add(field.attribute)
                problems.push({ kind, attribute: field.attribute })
            }
            continue
        }
        const attribute = attributeOf(model, field.attribute)
        if (attribute) {
            seen.add(field.attribute)
            usable.push({ attribute, match: field.match })
        }
    }

    const needed = Math.max(model.minAttributes, 1)
    const uniques = usable.filter(({ attribute }) => attribute.unique)
    if (!uniques.length && usable.length < needed) {
        problems.push({ kind: 'form-cannot-search' })
    }

    const issues: Record<string, FieldIssue> = {}
    const filledFields: {
        attribute: FinderAttribute
        conditions: SearchCondition[]
    }[] = []
    for (const { attribute, match } of usable) {
        const value = Object.hasOwn(values, attribute.id)
            ? values[attribute.id]
            : undefined
        const reading = readField(attribute, match, value)
        if (reading.state === 'issue') {
            issues[attribute.id] = reading.issue
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
    const base = { problems, issues, missing }

    if (problems.some(({ kind }) => kind === 'form-cannot-search')) {
        return verdict({ ...base, reason: 'not-set-up' })
    }
    if (Object.keys(issues).length) {
        return verdict({ ...base, reason: 'has-issues' })
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
