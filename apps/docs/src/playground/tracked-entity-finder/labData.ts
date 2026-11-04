import type { LabNetwork } from '../network'

/**
 * Everything the finder lab can vary: the program's metadata, how the fake
 * server answers, and how the finder's parts are composed. Presets are whole
 * settings, so picking one and then tweaking it never mixes two cases.
 */

export const LAB_PROGRAM = 'labProgram1'

export const VALUE_TYPES = [
    'TEXT',
    'LONG_TEXT',
    'LETTER',
    'PHONE_NUMBER',
    'EMAIL',
    'URL',
    'USERNAME',
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
    'BOOLEAN',
    'TRUE_ONLY',
    'DATE',
    'AGE',
    'DATETIME',
    'IMAGE',
    'FILE_RESOURCE',
    'COORDINATE',
    'ORGANISATION_UNIT',
] as const

export const OPERATORS = ['eq', 'like', 'sw', 'gt', 'ge', 'lt', 'le'] as const
export const TEXT_OPERATORS = ['like', 'sw', 'eq'] as const

export const CALENDARS = [
    'gregorian',
    'iso8601',
    'ethiopian',
    'coptic',
    'nepali',
    'persian',
    'islamic',
    'thai',
] as const

export const DATE_FORMATS = ['YYYY-MM-DD', 'DD-MM-YYYY'] as const

export interface LabOption {
    code: string
    name: string
}

export interface LabAttribute {
    id: string
    label: string
    valueType: string
    unique: boolean
    searchable: boolean
    displayInList: boolean
    options?: LabOption[]
    minCharacters: number
    blocked: string[]
    preferred?: string
}

export interface LabProgram {
    name: string
    minAttributes: number
    /** 0 = no cap. */
    maxResults: number
    attributes: LabAttribute[]
}

/** What a search answers when the network lets it through; a 500 or no answer is the network's call. */
export const SEARCH_ANSWERS = [
    ['ok', 'The matches'],
    ['conflict', '409 too many'],
    ['bad-request', '400 bad filter'],
] as const

export interface LabServer {
    /** How many people every search matches, across all pages. */
    matches: number
    /** Without a total, the finder pages by whether a page came back full. */
    reportsTotal: boolean
    search: (typeof SEARCH_ANSWERS)[number][0]
    calendar: (typeof CALENDARS)[number]
    dateFormat: (typeof DATE_FORMATS)[number]
}

export interface LabField {
    attribute: string
    range: boolean
    label?: string
    placeholder?: string
    description?: string
}

export const RESULTS_LAYOUTS = [
    ['default', 'Default results'],
    ['custom', 'Composed rows and states'],
    ['hooks', 'Hooks only'],
    ['none', 'No results'],
] as const

export const FORM_LAYOUTS = [
    ['stacked', 'All forms at once'],
    ['swap', 'One at a time, with links'],
] as const

export interface LabComposition {
    forms: LabField[][]
    formLayout: (typeof FORM_LAYOUTS)[number][0]
    /** Fields built from `useFinderField` instead of `FinderField`. */
    hookFields: boolean
    hint: boolean
    results: (typeof RESULTS_LAYOUTS)[number][0]
    /** Composed results only: the attributes each row shows. */
    rowAttributes: string[]
    customTexts: boolean
}

export const CANVAS_WIDTHS = [
    ['phone', 'Phone'],
    ['narrow', 'Narrow'],
    ['wide', 'Wide'],
    ['full', 'Full'],
] as const

export interface LabSettings {
    program: LabProgram
    server: LabServer
    composition: LabComposition
    network: LabNetwork
    width: (typeof CANVAS_WIDTHS)[number][0]
    rtl: boolean
}

export const SAMPLE_OPTIONS: LabOption[] = [
    { code: 'A', name: 'Option A' },
    { code: 'B', name: 'Option B' },
    { code: 'C', name: 'Option C' },
]

const FIRST_NAMES = ['Amina', 'Fatmata', 'Mohamed', 'Isata', 'Abu', 'Mariama']
const LAST_NAMES = ['Bangura', 'Kamara', 'Sesay', 'Conteh', 'Koroma', 'Turay']

const isoDate = (index: number) =>
    `${1960 + ((index * 7) % 60)}-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + ((index * 3) % 28)).padStart(2, '0')}`

/** A value for person `index` that reads like what the attribute holds. */
const sampleValue = (attribute: LabAttribute, index: number): string => {
    if (attribute.options?.length) {
        return attribute.options[index % attribute.options.length].code
    }
    const label = attribute.label.toLowerCase()
    switch (attribute.valueType) {
        case 'BOOLEAN':
            return index % 2 === 0 ? 'true' : 'false'
        case 'TRUE_ONLY':
            return index % 3 === 0 ? 'true' : ''
        case 'NUMBER':
        case 'PERCENTAGE':
            return String(40 + ((index * 13) % 50) + 0.5)
        case 'INTEGER':
        case 'INTEGER_POSITIVE':
        case 'INTEGER_ZERO_OR_POSITIVE':
            return String((index * 7) % 90)
        case 'INTEGER_NEGATIVE':
            return String(-1 - (index % 9))
        case 'DATE':
        case 'AGE':
            return isoDate(index)
        case 'DATETIME':
            return `${isoDate(index + 40)}T08:${String(index % 60).padStart(2, '0')}:00.000`
        case 'IMAGE':
        case 'FILE_RESOURCE':
            return `fileResource${index}`
        case 'COORDINATE':
            return '[-11.78,8.43]'
        default:
            if (attribute.unique) {
                return `SL-${String(1000 + index)}-${index % 90}`
            }
            if (label.includes('first') || label === 'name') {
                return FIRST_NAMES[index % FIRST_NAMES.length]
            }
            if (label.includes('last')) {
                return LAST_NAMES[(index * 5) % LAST_NAMES.length]
            }
            return `${attribute.label} ${index + 1}`
    }
}

/** The `GET programs/<uid>` response for the lab program. */
export const programJson = (program: LabProgram) => ({
    displayName: program.name,
    minAttributesRequiredToSearch: program.minAttributes,
    maxTeiCountToReturn: program.maxResults,
    trackedEntityType: { id: 'labPerson' },
    programTrackedEntityAttributes: program.attributes.map(
        (attribute, sortOrder) => ({
            searchable: attribute.searchable,
            displayInList: attribute.displayInList,
            sortOrder,
            trackedEntityAttribute: {
                id: attribute.id,
                displayName: attribute.label,
                valueType: attribute.valueType,
                unique: attribute.unique,
                optionSet: attribute.options
                    ? {
                          options: attribute.options.map(({ code, name }) => ({
                              code,
                              displayName: name,
                          })),
                      }
                    : null,
                preferredSearchOperator: attribute.preferred ?? null,
                blockedSearchOperators: attribute.blocked.map((operator) =>
                    operator.toUpperCase()
                ),
                minCharactersToSearch: attribute.minCharacters,
            },
        })
    ),
})

/** One page of the people every search matches, as `GET tracker/trackedEntities` sends it. */
export const searchJson = (
    { program, server }: Pick<LabSettings, 'program' | 'server'>,
    page: number,
    pageSize: number
) => {
    const first = (page - 1) * pageSize
    const count = Math.max(0, Math.min(pageSize, server.matches - first))
    const trackedEntities = Array.from({ length: count }, (_, offset) => {
        const index = first + offset
        return {
            trackedEntity: `labTe${String(index).padStart(6, '0')}`,
            trackedEntityType: 'labPerson',
            orgUnit: 'labOrgUnit1',
            programOwners: [{ orgUnit: 'labOrgUnit1', program: LAB_PROGRAM }],
            attributes: program.attributes.map((attribute) => ({
                attribute: attribute.id,
                value: sampleValue(attribute, index),
            })),
        }
    })
    return server.reportsTotal
        ? { trackedEntities, pager: { page, pageSize, total: server.matches } }
        : { trackedEntities, pager: { page, pageSize } }
}
