/**
 * A generated event program, sized by its id: `c40r200u20o10` has 40 data elements, 200 events, 20 program rules and
 * 10 options in each option set. The same id always gives the same program and events.
 */
export type Scenario = {
    /** Data elements in the stage: the grid's columns after the event date. */
    columns: number
    /** Events the server holds; the grid reads them a page at a time. */
    rows: number
    /** Program rules; each reads one or two variables. */
    rules: number
    /** Options in each option set. */
    options: number
}

// The value types cycle, so any number of columns has the same mix: a third numbers, a fifth option sets.
const KINDS = [
    'INTEGER',
    'TEXT',
    'OPTION',
    'BOOLEAN',
    'DATE',
    'NUMBER',
    'OPTION',
    'TRUE_ONLY',
    'LONG_TEXT',
    'INTEGER_ZERO_OR_POSITIVE',
] as const

export const ORG_UNIT = 'PerfOrgUnit'
const STAGE = 'PerfStage01'

const MOST = { columns: 500, rows: 2000, rules: 2000, options: 10_000 }

export const scenarioId = ({ columns, rows, rules, options }: Scenario) =>
    `c${columns}r${rows}u${rules}o${options}`

export const parseScenario = (id: string): Scenario | undefined => {
    const match = /^c(\d+)r(\d+)u(\d+)o(\d+)$/.exec(id)
    if (match === null) {
        return undefined
    }
    const [columns, rows, rules, options] = match.slice(1).map(Number)
    // Fewer columns would leave out a value type the rules read; more than these would not fit in the server's memory.
    if (
        columns < KINDS.length ||
        options < 1 ||
        columns > MOST.columns ||
        rows > MOST.rows ||
        rules > MOST.rules ||
        options > MOST.options
    ) {
        return undefined
    }
    return { columns, rows, rules, options }
}

type Kind = (typeof KINDS)[number]

const pad = (value: number, length: number) =>
    String(value).padStart(length, '0')

export const elementId = (at: number) => `PerfDE${pad(at, 5)}`
export const eventId = (at: number) => `PerfEv${pad(at, 5)}`
const kindOf = (at: number): Kind => KINDS[at % KINDS.length]
const optionCode = (at: number) => `OPT${at}`

/** A small seeded generator (mulberry32): the same seed gives the same numbers on every run. */
const random = (seed: number) => {
    let state = seed
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
    }
}

const optionsOf = (count: number) =>
    Array.from({ length: count }, (_, at) => ({
        code: optionCode(at),
        displayName: `Option ${at + 1} of the set`,
    }))

const dataElement = (at: number, { options }: Scenario) => {
    const kind = kindOf(at)
    return {
        id: elementId(at),
        displayFormName: `${kind === 'OPTION' ? 'Choice' : 'Field'} ${at + 1}`,
        valueType: kind === 'OPTION' ? 'TEXT' : kind,
        ...(kind === 'OPTION' && {
            optionSet: { options: optionsOf(options) },
        }),
    }
}

export const program = (id: string, scenario: Scenario) => ({
    id,
    name: `Generated program ${id}`,
    displayName: `Generated program ${id}`,
    programType: 'WITHOUT_REGISTRATION',
    expiryDays: 0,
    completeEventsExpiryDays: 0,
    categoryCombo: { id: 'bjDvmb4bfuf', isDefault: true },
    programStages: [
        {
            id: STAGE,
            name: 'Generated stage',
            displayName: 'Generated stage',
            repeatable: true,
            validationStrategy: 'ON_COMPLETE',
            blockEntryForm: false,
            access: { data: { write: true } },
            programStageDataElements: Array.from(
                { length: scenario.columns },
                (_, at) => ({
                    compulsory: at % 15 === 1,
                    dataElement: dataElement(at, scenario),
                })
            ),
            programStageSections: [],
        },
    ],
})

const valueOf = (kind: Kind, next: () => number, options: number) => {
    switch (kind) {
        case 'INTEGER':
        case 'INTEGER_ZERO_OR_POSITIVE':
            return String(Math.floor(next() * 120))
        case 'NUMBER':
            return (next() * 100).toFixed(1)
        case 'TEXT':
            return `Text ${Math.floor(next() * 1000)}`
        case 'LONG_TEXT':
            return `A longer note about the visit, number ${Math.floor(next() * 1000)}`
        case 'OPTION':
            return optionCode(Math.floor(next() * options))
        case 'BOOLEAN':
            return next() < 0.5 ? 'true' : 'false'
        case 'TRUE_ONLY':
            return 'true'
        case 'DATE':
            return `2024-${pad(1 + Math.floor(next() * 12), 2)}-${pad(1 + Math.floor(next() * 28), 2)}`
    }
}

export type GeneratedEvent = {
    event: string
    program: string
    programStage: string
    orgUnit: string
    occurredAt: string
    status: string
    attributeOptionCombo: string
    dataValues: Array<{ dataElement: string; value: string }>
}

/** The events, newest first; four cells in five hold a value. */
export const events = (id: string, scenario: Scenario): GeneratedEvent[] => {
    const next = random(scenario.columns * 7919 + scenario.rows)
    const first = Date.UTC(2025, 0, 1)
    return Array.from({ length: scenario.rows }, (_, row) => ({
        event: eventId(row),
        program: id,
        programStage: STAGE,
        orgUnit: ORG_UNIT,
        occurredAt: `${new Date(first - row * 86_400_000).toISOString().slice(0, 10)}T00:00:00.000`,
        status: 'ACTIVE',
        attributeOptionCombo: 'HllvX50cXC0',
        dataValues: Array.from({ length: scenario.columns }, (_, at) => ({
            dataElement: elementId(at),
            value: valueOf(kindOf(at), next, scenario.options),
        })).filter((_, at) => at === 0 || next() < 0.8),
    }))
}

const variableName = (at: number) => `field${at}`

/** One variable for each data element, as programs set up with the maintenance app have. */
export const variables = (scenario: Scenario) =>
    Array.from({ length: scenario.columns }, (_, at) => {
        const element = dataElement(at, scenario)
        return {
            id: `PerfVr${pad(at, 5)}`,
            name: variableName(at),
            programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT',
            useCodeForOptionSet: true,
            valueType: element.valueType,
            dataElement: {
                id: element.id,
                valueType: element.valueType,
                ...(element.optionSet && {
                    optionSet: {
                        id: `PerfOS${pad(at, 5)}`,
                        options: element.optionSet.options.map(
                            ({ code, displayName }) => ({
                                code,
                                name: displayName,
                            })
                        ),
                    },
                }),
            },
        }
    })

/** The data elements of one kind, in column order. */
const ofKind = (scenario: Scenario, kind: Kind) =>
    Array.from({ length: scenario.columns }, (_, at) => at).filter(
        (at) => kindOf(at) === kind
    )

/**
 * The rules cycle through what programs mostly do: warn on a number, hide a field for an answer, assign a sum, require
 * a field, and show an error on a date. Their sources and targets move across the columns, so more rules touch more
 * of the form.
 */
export const rules = (scenario: Scenario) => {
    const integers = ofKind(scenario, 'INTEGER')
    const numbers = ofKind(scenario, 'NUMBER')
    const choices = ofKind(scenario, 'OPTION')
    const flags = ofKind(scenario, 'BOOLEAN')
    const dates = ofKind(scenario, 'DATE')
    const texts = ofKind(scenario, 'TEXT')
    const notes = ofKind(scenario, 'LONG_TEXT')
    const pick = (from: number[], at: number) => from[at % from.length]
    const templates = [
        (at: number) => ({
            condition: `#{${variableName(pick(integers, at))}} > ${60 + (at % 50)}`,
            action: {
                programRuleActionType: 'SHOWWARNING',
                content: 'Higher than expected: is it right?',
                dataElement: { id: elementId(pick(integers, at)) },
            },
        }),
        (at: number) => ({
            condition: `#{${variableName(pick(choices, at))}} == '${optionCode(at % Math.max(scenario.options, 1))}'`,
            action: {
                programRuleActionType: 'HIDEFIELD',
                dataElement: { id: elementId(pick(notes, at)) },
            },
        }),
        (at: number) => ({
            condition: `d2:hasValue(#{${variableName(pick(integers, at))}}) && d2:hasValue(#{${variableName(pick(integers, at + 1))}})`,
            action: {
                programRuleActionType: 'ASSIGN',
                data: `#{${variableName(pick(integers, at))}} + #{${variableName(pick(integers, at + 1))}}`,
                dataElement: { id: elementId(pick(numbers, at)) },
            },
        }),
        (at: number) => ({
            condition: `#{${variableName(pick(flags, at))}} == true`,
            action: {
                programRuleActionType: 'SETMANDATORYFIELD',
                dataElement: { id: elementId(pick(texts, at)) },
            },
        }),
        (at: number) => ({
            condition: `d2:hasValue(#{${variableName(pick(dates, at))}}) && d2:daysBetween(#{${variableName(pick(dates, at))}}, V{event_date}) > ${300 + (at % 60)}`,
            action: {
                programRuleActionType: 'SHOWERROR',
                content: 'More than ten months before the event',
                dataElement: { id: elementId(pick(dates, at)) },
            },
        }),
    ]
    return Array.from({ length: scenario.rules }, (_, at) => {
        const { condition, action } = templates[at % templates.length](
            Math.floor(at / templates.length)
        )
        const id = `PerfRl${pad(at, 5)}`
        return {
            id,
            name: `Rule ${at + 1}`,
            displayName: `Rule ${at + 1}`,
            condition,
            priority: at + 1,
            programRuleActions: [{ id: `PerfRA${pad(at, 5)}`, ...action }],
        }
    })
}
