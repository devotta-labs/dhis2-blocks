import type { LabNetwork } from '../network'

/**
 * Everything the finder lab can vary: the program's metadata, how the fake
 * server answers, and how the finder's parts are composed. Presets are whole
 * settings, so picking one and then tweaking it never mixes two cases.
 */

export const LAB_PROGRAM = 'labProgram1'

export const CALENDARS = [
    ['gregorian', 'Gregorian'],
    ['ethiopian', 'Ethiopian'],
    ['nepali', 'Nepali'],
    ['islamic', 'Islamic'],
    ['persian', 'Persian'],
    ['thai', 'Thai'],
] as const

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
}

export interface LabProgram {
    name: string
    minAttributes: number
    /** 0 = no cap. */
    maxResults: number
    attributes: LabAttribute[]
}

export interface LabServer {
    /** How many people every search matches, across all pages. */
    matches: number
    calendar: (typeof CALENDARS)[number][0]
}

export interface LabField {
    attribute: string
    range: boolean
    label?: string
    placeholder?: string
    description?: string
}

export interface LabComposition {
    forms: LabField[][]
    /** `swap` shows one form at a time, with links between them. */
    formLayout: 'stacked' | 'swap'
    /**
     * `parts`: the finder's own parts. `own-rows`: result rows and state
     * texts of your own. `hooks`: fields and results built from the hooks.
     */
    build: 'parts' | 'own-rows' | 'hooks'
    /** Own rows and hooks only: the attributes each row shows. */
    rowAttributes: string[]
}

export interface LabSettings {
    program: LabProgram
    server: LabServer
    composition: LabComposition
    network: LabNetwork
    rtl: boolean
}

const FIRST_NAMES = ['Amina', 'Fatmata', 'Mohamed', 'Isata', 'Abu', 'Mariama']
const LAST_NAMES = ['Bangura', 'Kamara', 'Sesay', 'Conteh', 'Koroma', 'Turay']

const isoDate = (index: number) =>
    `${1960 + ((index * 7) % 60)}-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + ((index * 3) % 28)).padStart(2, '0')}`

/** A value for person `index` that reads like what the attribute holds. */
const sampleValue = (attribute: LabAttribute, index: number): string => {
    const options = attribute.options ?? []
    if (attribute.valueType === 'MULTI_TEXT') {
        // One or two codes, stored comma-separated as DHIS2 does.
        return options
            .filter((_, at) => (index + at) % 3 === 0)
            .map(({ code }) => code)
            .join(',')
    }
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
                preferredSearchOperator: null,
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
    return {
        trackedEntities,
        pager: { page, pageSize, total: server.matches },
    }
}
