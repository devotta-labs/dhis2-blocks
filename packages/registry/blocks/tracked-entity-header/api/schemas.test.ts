import { fixture } from '../__tests__/fixtures'
import {
    ProgramAttributesResponseSchema,
    TrackedEntityResponseSchema,
    TypeAttributesResponseSchema,
} from './schemas'

describe('TrackedEntityResponseSchema', () => {
    it.each([
        ['trackedEntity.rmnch.json', 5],
        ['trackedEntity.child.json', 4],
        ['trackedEntity.noProgram.json', 3],
    ])('parses %s', (name, attributes) => {
        const person = TrackedEntityResponseSchema.parse(fixture(name))

        expect(person.attributes).toHaveLength(attributes)
        expect(person.trackedEntityType).toBe('nEenWmSyUEp')
    })

    it('reads a person with no enrollments', () => {
        const person = TrackedEntityResponseSchema.parse({
            trackedEntity: 'te1',
            trackedEntityType: 'tt1',
            attributes: [],
        })

        expect(person).toMatchObject({
            inactive: false,
            potentialDuplicate: false,
            enrollments: [],
            programOwners: [],
        })
    })

    it('drops a malformed attribute or enrollment on its own', () => {
        const person = TrackedEntityResponseSchema.parse({
            trackedEntity: 'te1',
            trackedEntityType: 'tt1',
            attributes: [{ attribute: 'a1', value: 'x' }, { attribute: 'a2' }],
            enrollments: [{ nonsense: true }],
        })

        expect(person.attributes).toEqual([{ attribute: 'a1', value: 'x' }])
        expect(person.enrollments).toEqual([])
    })
})

describe('attribute metadata', () => {
    it('parses both programs, keeping the type, labels and date labels', () => {
        const rmnch = ProgramAttributesResponseSchema.parse(
            fixture('program.rmnch.json')
        )
        const child = ProgramAttributesResponseSchema.parse(
            fixture('program.child.json')
        )

        expect(rmnch).toMatchObject({
            typeName: 'Person',
            programName: 'WHO RMNCH Tracker',
            incidentDateLabel: 'Date of incident',
        })
        expect(rmnch.attributes.get('w75KJ2mc4zz')?.label).toBe('First name')
        expect(rmnch.invalid.size).toBe(0)
        expect(child.programName).toBe('Child Programme')
        expect(child.incidentDateLabel).toBe('Date of birth')
    })

    it('lists only displayInList uids, by sortOrder', () => {
        const rmnch = ProgramAttributesResponseSchema.parse(
            fixture('program.rmnch.json')
        )

        expect(rmnch.listOrder).toEqual(
            [...rmnch.attributes.values()]
                .filter((attribute) => attribute.displayInList)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((attribute) => attribute.id)
        )
        expect(rmnch.listOrder.length).toBeGreaterThan(0)
        expect(rmnch.listOrder.length).toBeLessThan(rmnch.attributes.size)
    })

    it('puts an attribute with an unreadable option set in invalid, and keeps the rest', () => {
        const metadata = ProgramAttributesResponseSchema.parse({
            displayName: 'Programme',
            trackedEntityType: { displayName: 'Person' },
            programTrackedEntityAttributes: [
                {
                    displayInList: true,
                    sortOrder: 2,
                    trackedEntityAttribute: {
                        id: 'bad',
                        displayFormName: 'Bad',
                        valueType: 'TEXT',
                        optionSet: { options: [{ code: 'A' }] },
                    },
                },
                {
                    displayInList: true,
                    sortOrder: 1,
                    trackedEntityAttribute: {
                        id: 'good',
                        displayFormName: 'Good',
                        valueType: 'TEXT',
                    },
                },
            ],
        })

        expect([...metadata.attributes.keys()]).toEqual(['good'])
        expect(metadata.invalid.get('bad')?.label).toBe('Bad')
        expect(metadata.invalid.get('bad')?.error.message).toContain('bad')
        expect(metadata.listOrder).toEqual(['good', 'bad'])
    })

    it("reads a type's attributes in its own order", () => {
        const person = TypeAttributesResponseSchema.parse(
            fixture('trackedEntityType.person.json')
        )

        expect(person.typeName).toBe('Person')
        expect(person.programName).toBeUndefined()
        expect(person.listOrder).toEqual(['w75KJ2mc4zz', 'zDhUuAYrxNC'])
    })
})
