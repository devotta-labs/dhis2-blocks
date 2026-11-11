import type { RelationshipLabel } from '@/components/tracked-entity-header'
import { FIRST_NAME, LAST_NAME, specOf } from './labAttributes'

/** Which links the lab person has, as one of the relationship examples. */
export type RelationshipScenario =
    | 'none'
    | 'mother'
    | 'focus'
    | 'unreadable'
    | 'events'
    | 'raw'
    | 'rawRelabelled'

/** The relationship parts the canvases place; they only appear for a scenario that has links. */
export interface RelationshipParts {
    key?: {
        relationshipType: string
        end?: 'from' | 'to'
        label?: RelationshipLabel
    }
    labels?: Readonly<Record<string, RelationshipLabel>>
}

const MOTHER_CHILD = 'labMothChld'
const FOCUS = 'labFocusCas'
const EVENT = 'labLinkEvnt'
const PERSON_TYPE = 'labPersonTyp'
const RAW_NAME = 'Mother-Child_a-to-b_(Person-Person)'

export const relationshipPartsFor = (
    scenario: RelationshipScenario
): RelationshipParts | undefined => {
    switch (scenario) {
        case 'mother':
            return {
                key: {
                    relationshipType: MOTHER_CHILD,
                    end: 'from',
                    label: { from: 'Baby', to: 'Mother' },
                },
            }
        case 'rawRelabelled':
            return {
                labels: { [MOTHER_CHILD]: { from: 'Baby', to: 'Mother' } },
            }
        case 'none':
            return undefined
        default:
            return {}
    }
}

const VIEW = [FIRST_NAME, LAST_NAME]
const constraint = (typeName: string) => ({
    relationshipEntity: 'TRACKED_ENTITY_INSTANCE',
    trackedEntityType: { id: PERSON_TYPE, displayName: typeName },
    trackerDataView: { attributes: VIEW },
})

/** One end of a relationship, as DHIS2 sends it. */
interface End {
    trackedEntity?: {
        trackedEntity: string
        trackedEntityType: string
        attributes?: Array<{ attribute: string; value: string }>
    }
    event?: { event: string }
}

interface TypeExtras {
    fromToName?: string
    toConstraint?: { relationshipEntity: string }
}

const type = (id: string, name: string, extra: TypeExtras = {}) => ({
    id,
    displayName: name,
    bidirectional: false,
    fromConstraint: constraint('Person'),
    toConstraint: constraint('Person'),
    ...extra,
})

const person = (id: string, first: string, last: string) => ({
    trackedEntity: {
        trackedEntity: id,
        trackedEntityType: PERSON_TYPE,
        attributes: [
            { attribute: FIRST_NAME, value: first },
            { attribute: LAST_NAME, value: last },
        ],
    },
})

const LAST_NAMES = ['Kamara', 'Sesay', 'Koroma', 'Conteh', 'Bangura']

const link = (n: number, relationshipType: string, from: End, to: End) => ({
    relationship: `labRelatn${String(n).padStart(3, '0')}`,
    relationshipType,
    from,
    to,
})

/** The relationships, their types and the attributes the types' views name, for this scenario's person. */
export const generateRelationshipData = (
    scenario: RelationshipScenario,
    self: string
) => {
    const me = person(self, 'Linda', 'Bailey')
    const other = (n: number) =>
        person(
            `labLinked${String(n).padStart(3, '0')}`,
            `Case ${n}`,
            LAST_NAMES[n % 5] ?? ''
        )
    switch (scenario) {
        case 'none':
            return { relationships: [], types: [] }
        case 'mother':
        case 'raw':
        case 'rawRelabelled':
            return {
                relationships: [
                    link(
                        1,
                        MOTHER_CHILD,
                        me,
                        person('labBaby0001', 'Aminata', 'Bailey')
                    ),
                ],
                types: [
                    type(
                        MOTHER_CHILD,
                        scenario === 'mother' ? 'Mother-Child' : RAW_NAME
                    ),
                ],
            }
        case 'focus':
            return {
                relationships: Array.from({ length: 300 }, (_, i) =>
                    link(i + 1, FOCUS, me, other(i + 1))
                ),
                types: [type(FOCUS, 'Focus to Case', { fromToName: 'Cases' })],
            }
        case 'unreadable':
            return {
                relationships: [
                    link(1, FOCUS, me, {
                        // No attributes: the viewer may not read this record.
                        trackedEntity: {
                            trackedEntity: 'labHidden001',
                            trackedEntityType: PERSON_TYPE,
                        },
                    }),
                ],
                types: [
                    type(FOCUS, 'Referred to', { fromToName: 'Referred to' }),
                ],
            }
        case 'events':
            return {
                relationships: [1, 2].map((n) =>
                    link(n, EVENT, me, { event: { event: `labVisitEv${n}` } })
                ),
                types: [
                    type(EVENT, 'Linked visit', {
                        toConstraint: {
                            relationshipEntity: 'PROGRAM_STAGE_INSTANCE',
                        },
                    }),
                ],
            }
    }
}

/** The attributes of the types' views, as `trackedEntityAttributes` answers them. */
export const viewAttribute = (id: string) => {
    const { label, valueType } = specOf(id)
    return { id, displayFormName: label, valueType }
}
