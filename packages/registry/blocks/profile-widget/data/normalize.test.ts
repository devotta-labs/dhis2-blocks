import type { ProfileField, ProfileFieldValue } from '../types'
import {
    ATTRIBUTES,
    CHILD_PROGRAM_ID,
    parseProgram,
    parseRecord,
    parseTrackedEntityType,
    programJson,
    recordJson,
    TRACKED_ENTITY_ID,
    trackedEntityTypeJson,
} from './__tests__/fixtures'
import {
    buildAttributeDefinitions,
    buildDisplayName,
    buildProfileTitle,
    resolveProfileLabels,
    toAttributeFields,
    toFormattableFields,
} from './normalize'

const program = parseProgram(programJson())
const trackedEntityType = parseTrackedEntityType(trackedEntityTypeJson())

const programDefinitions = buildAttributeDefinitions({
    trackedEntityTypeAttributes:
        program.trackedEntityType.trackedEntityTypeAttributes,
    programAttributes: program.programTrackedEntityAttributes,
})

const field = (id: string, value: ProfileFieldValue): ProfileField => ({
    id,
    label: id,
    valueType: 'TEXT',
    rawValue: null,
    value,
})
const text = (id: string, value: string) =>
    field(id, value ? { kind: 'text', text: value } : { kind: 'empty' })

describe('buildAttributeDefinitions', () => {
    it('lists program attributes first, then TET-only ones, with their origin', () => {
        expect(
            programDefinitions.map(({ id, origin, displayInList }) => ({
                id,
                origin,
                displayInList,
            }))
        ).toEqual([
            {
                id: ATTRIBUTES.lastName.id,
                origin: 'both',
                displayInList: false,
            },
            {
                id: ATTRIBUTES.firstName.id,
                origin: 'both',
                displayInList: true,
            },
            {
                id: ATTRIBUTES.gender.id,
                origin: 'program',
                displayInList: true,
            },
            {
                id: ATTRIBUTES.birthDate.id,
                origin: 'program',
                displayInList: true,
            },
            { id: ATTRIBUTES.photo.id, origin: 'program', displayInList: true },
            {
                id: ATTRIBUTES.document.id,
                origin: 'program',
                displayInList: true,
            },
            {
                id: ATTRIBUTES.homeFacility.id,
                origin: 'program',
                displayInList: true,
            },
            {
                id: ATTRIBUTES.uniqueId.id,
                origin: 'trackedEntityType',
                displayInList: false,
            },
            {
                id: ATTRIBUTES.address.id,
                origin: 'trackedEntityType',
                displayInList: true,
            },
        ])
    })

    it('drops unreadable attributes and MULTI_TEXT without an option set', () => {
        const ids = programDefinitions.map((definition) => definition.id)
        expect(ids).not.toContain(ATTRIBUTES.secret.id)
        expect(ids).not.toContain(ATTRIBUTES.tags.id)
    })

    it('keeps label, decoded value type, unique flag and bare options', () => {
        expect(programDefinitions[2]).toEqual({
            id: ATTRIBUTES.gender.id,
            label: 'Gender',
            valueType: 'TEXT',
            options: [
                { code: 'Male', displayName: 'Male' },
                { code: 'Female', displayName: 'Female' },
            ],
            origin: 'program',
            displayInList: true,
            unique: false,
        })
        expect(
            programDefinitions.find(
                (definition) => definition.id === ATTRIBUTES.uniqueId.id
            )
        ).toMatchObject({ unique: true, options: undefined })
    })

    it('uses only the TET attributes without a program', () => {
        expect(
            buildAttributeDefinitions({
                trackedEntityTypeAttributes:
                    trackedEntityType.trackedEntityTypeAttributes,
                programAttributes: null,
            }).map(({ id, origin }) => [id, origin])
        ).toEqual([
            [ATTRIBUTES.uniqueId.id, 'trackedEntityType'],
            [ATTRIBUTES.firstName.id, 'trackedEntityType'],
            [ATTRIBUTES.lastName.id, 'trackedEntityType'],
            [ATTRIBUTES.address.id, 'trackedEntityType'],
        ])
    })

    it('keeps the first occurrence of a duplicated attribute', () => {
        const [lastName] = program.programTrackedEntityAttributes
        const definitions = buildAttributeDefinitions({
            trackedEntityTypeAttributes: [],
            programAttributes: [lastName, { ...lastName, displayInList: true }],
        })
        expect(definitions).toHaveLength(1)
        expect(definitions[0]).toMatchObject({ displayInList: false })
    })
})

describe('toFormattableFields', () => {
    it('joins values by attribute id and defaults missing values to null', () => {
        const fields = toFormattableFields(
            programDefinitions,
            parseRecord(recordJson()),
            CHILD_PROGRAM_ID
        )
        expect(
            Object.fromEntries(fields.map((f) => [f.id, f.rawValue]))
        ).toEqual({
            [ATTRIBUTES.lastName.id]: 'Kelly',
            [ATTRIBUTES.firstName.id]: 'John',
            [ATTRIBUTES.gender.id]: 'Male',
            [ATTRIBUTES.birthDate.id]: '2020-03-01',
            [ATTRIBUTES.photo.id]: 'ImageFile01',
            [ATTRIBUTES.document.id]: 'FileResour1',
            [ATTRIBUTES.homeFacility.id]: 'DiszpKrYNg8',
            [ATTRIBUTES.uniqueId.id]: null,
            [ATTRIBUTES.address.id]: 'Main street 2',
        })
    })

    it('gives file and image fields a tracker endpoint, with ?program= only in program mode', () => {
        const record = parseRecord(recordJson())
        const withProgram = toFormattableFields(
            programDefinitions,
            record,
            CHILD_PROGRAM_ID
        )
        expect(
            withProgram.find((f) => f.id === ATTRIBUTES.photo.id)?.file
        ).toEqual({
            endpoint: `tracker/trackedEntities/${TRACKED_ENTITY_ID}/attributes/${ATTRIBUTES.photo.id}`,
            params: { program: CHILD_PROGRAM_ID },
        })
        expect(
            toFormattableFields(programDefinitions, record, null).find(
                (f) => f.id === ATTRIBUTES.document.id
            )?.file
        ).toEqual({
            endpoint: `tracker/trackedEntities/${TRACKED_ENTITY_ID}/attributes/${ATTRIBUTES.document.id}`,
            params: undefined,
        })
        expect(
            withProgram.find((f) => f.id === ATTRIBUTES.firstName.id)?.file
        ).toBeUndefined()
    })
})

describe('toAttributeFields', () => {
    it('adds origin, displayInList and unique in definition order', () => {
        const [lastName, firstName] = programDefinitions
        const fields = toAttributeFields(
            [lastName, firstName],
            [text(firstName.id, 'John'), text(lastName.id, 'Kelly')]
        )
        expect(fields).toEqual([
            {
                ...text(lastName.id, 'Kelly'),
                origin: 'both',
                displayInList: false,
                unique: false,
            },
            {
                ...text(firstName.id, 'John'),
                origin: 'both',
                displayInList: true,
                unique: false,
            },
        ])
    })
})

describe('buildDisplayName', () => {
    const links = trackedEntityType.trackedEntityTypeAttributes
    const { uniqueId, firstName, lastName, address } = ATTRIBUTES

    it('joins the first two displayInList TET attributes', () => {
        expect(
            buildDisplayName(links, [
                text(uniqueId.id, 'ID-1'),
                text(firstName.id, 'John'),
                text(lastName.id, 'Kelly'),
                text(address.id, 'Main street 2'),
            ])
        ).toBe('John Kelly')
    })

    it('keeps the second value when the first is empty (the ?? fix)', () => {
        expect(
            buildDisplayName(links, [
                text(firstName.id, ''),
                text(lastName.id, 'Kelly'),
            ])
        ).toBe('Kelly')
    })

    it('falls back to the first two TET attributes', () => {
        const hidden = links.map((link) => ({ ...link, displayInList: false }))
        expect(
            buildDisplayName(hidden, [
                text(uniqueId.id, 'ID-1'),
                text(firstName.id, 'John'),
            ])
        ).toBe('ID-1 John')
        expect(
            buildDisplayName(links, [
                text(uniqueId.id, 'ID-1'),
                text(address.id, 'Main street 2'),
            ])
        ).toBe('ID-1')
    })

    it('ignores values that are not text, and is empty without values', () => {
        expect(
            buildDisplayName(links, [
                field(firstName.id, {
                    kind: 'coordinate',
                    latitude: 1,
                    longitude: 2,
                }),
                text(lastName.id, 'Kelly'),
            ])
        ).toBe('Kelly')
        expect(buildDisplayName(links, [])).toBe('')
    })
})

describe('buildProfileTitle', () => {
    it('names the tracked entity type, or falls back to Profile', () => {
        expect(buildProfileTitle('Person')).toBe('Person profile')
        expect(buildProfileTitle('Malaria & <TB> case')).toBe(
            'Malaria & <TB> case profile'
        )
        expect(buildProfileTitle(undefined)).toBe('Profile')
        expect(buildProfileTitle('')).toBe('Profile')
    })
})

describe('resolveProfileLabels', () => {
    it('uses program terminology when set, otherwise the defaults', () => {
        expect(resolveProfileLabels(null)).toEqual({
            attributes: 'attributes',
            enrollments: 'enrollments',
            events: 'events',
        })
        expect(
            resolveProfileLabels(
                parseProgram(
                    programJson({
                        attributesLabel: 'details',
                        enrollmentsLabel: 'cases',
                        eventsLabel: '',
                    })
                )
            )
        ).toEqual({
            attributes: 'details',
            enrollments: 'cases',
            events: 'events',
        })
    })
})
