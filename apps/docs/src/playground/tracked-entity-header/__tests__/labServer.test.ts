import {
    OrgUnitResponseSchema,
    ProgramAttributesResponseSchema,
    TrackedEntityResponseSchema,
    TypeAttributesResponseSchema,
} from '@/components/tracked-entity-header/api/schemas'
import {
    RelationshipsResponseSchema,
    RelationshipTypesResponseSchema,
    ViewAttributesResponseSchema,
} from '@/components/tracked-entity-header/api/relationshipSchemas'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { generateLabData, LAB_PERSON } from '../labData'
import { partsFor, SUBJECTS } from '../labSubjects'
import { answer } from '../labServer'
import { DEFAULT_SETTINGS, PRESETS } from '../presets'

const TODAY = '2026-11-02'

const settingsOf = (name: string) => {
    const found = PRESETS.find((preset) => preset.name === name)
    if (!found) throw new Error(`No preset ${name}`)
    return found.settings
}

const serverFor = (settings = DEFAULT_SETTINGS) =>
    answer(settings, generateLabData(settings, TODAY))

const recordOf = (settings = DEFAULT_SETTINGS, withProgram = true) =>
    TrackedEntityResponseSchema.parse(
        serverFor(settings)({
            resource: 'tracker/trackedEntities',
            id: LAB_PERSON,
            params: withProgram
                ? { program: SUBJECTS[settings.record].program }
                : {},
        })
    )

const HttpErrorSchema = z.object({
    details: z.object({ httpStatusCode: z.number() }),
})

const statusOf = (run: () => object): number | undefined => {
    try {
        run()
    } catch (error) {
        return HttpErrorSchema.parse(error).details.httpStatusCode
    }
    return undefined
}

describe('the tracked entity header lab server', () => {
    it('answers the person, program, type and org unit in the shapes the block parses', () => {
        const settings = settingsOf('Pregnancy')
        const { program, type } = SUBJECTS[settings.record]
        const respond = serverFor(settings)
        expect(recordOf(settings).attributes.length).toBeGreaterThan(0)
        expect(
            ProgramAttributesResponseSchema.parse(
                respond({ resource: 'programs', id: program })
            ).attributes.size
        ).toBeGreaterThan(0)
        expect(
            TypeAttributesResponseSchema.parse(
                respond({ resource: 'trackedEntityTypes', id: type })
            ).typeName
        ).not.toBe('')
        expect(
            OrgUnitResponseSchema.parse(
                respond({ resource: 'organisationUnits', id: 'labOrgUnit1' })
            )
        ).not.toBe('')
    })

    it('answers the person type’s attributes alone without a program', () => {
        const withProgram = recordOf(settingsOf('Pregnancy'))
        const without = recordOf(settingsOf('Pregnancy'), false)
        expect(without.attributes.length).toBeLessThan(
            withProgram.attributes.length
        )
    })

    it('gives the child an enrollment, and its date of birth is the incident date', () => {
        const settings = settingsOf('Child')
        const [enrollment] = recordOf(settings).enrollments
        expect(enrollment?.occurredAt).toBeDefined()
        expect(
            ProgramAttributesResponseSchema.parse(
                serverFor(settings)({
                    resource: 'programs',
                    id: SUBJECTS.child.program,
                })
            ).incidentDateLabel
        ).toBe('Date of birth')
    })

    it('answers a completed enrollment and leaves values out for the adult', () => {
        const settings = settingsOf('Adult, completed')
        const person = recordOf(settings)
        expect(person.enrollments[0]?.status).toBe('COMPLETED')
        const metadata = ProgramAttributesResponseSchema.parse(
            serverFor(settings)({
                resource: 'programs',
                id: SUBJECTS.adult.program,
            })
        )
        const given = new Set(
            person.attributes.map(({ attribute }) => attribute)
        )
        expect(
            [...metadata.attributes.keys()].some((id) => !given.has(id))
        ).toBe(true)
    })

    it('carries the person-level flags', () => {
        expect(recordOf(settingsOf('Inactive')).inactive).toBe(true)
        expect(
            recordOf(settingsOf('Possible duplicate')).potentialDuplicate
        ).toBe(true)
        expect(recordOf().inactive).toBe(false)
    })

    it('refuses the person with a 403 for Restricted, and only then', () => {
        const request = {
            resource: 'tracker/trackedEntities',
            id: LAB_PERSON,
            params: { program: SUBJECTS.pregnancy.program },
        }
        expect(
            statusOf(() => serverFor(settingsOf('Restricted'))(request))
        ).toBe(403)
        expect(statusOf(() => serverFor()(request))).toBeUndefined()
    })

    it('has a Failed preset whose person request fails with a 500, and a Slow one', () => {
        expect(
            settingsOf('Failed').network.endpoints['tracker/trackedEntities']
                ?.behaviour
        ).toBe('fails')
        expect(settingsOf('Slow').network.delay).toBeGreaterThanOrEqual(2000)
    })

    it('answers the observation resources for the pregnancy person', () => {
        const respond = serverFor(settingsOf('Pregnancy'))
        const events = respond({
            resource: 'tracker/events',
            params: {
                trackedEntity: LAB_PERSON,
                program: SUBJECTS.pregnancy.program,
                page: 1,
                pageSize: 200,
            },
        })
        expect(events).toHaveProperty('events')
    })

    it('sets the system calendar', () => {
        expect(
            generateLabData(
                { ...DEFAULT_SETTINGS, calendar: 'ethiopian' },
                TODAY
            ).systemInfo.calendar
        ).toBe('ethiopian')
    })

    it('generates the same data for the same settings', () => {
        expect(generateLabData(settingsOf('Child'), TODAY)).toEqual(
            generateLabData(settingsOf('Child'), TODAY)
        )
    })

    it('answers 404 for a program the person is not enrolled in, as DHIS2 does', () => {
        expect(
            statusOf(() =>
                serverFor()({
                    resource: 'tracker/trackedEntities',
                    id: LAB_PERSON,
                    params: { program: SUBJECTS.child.program },
                })
            )
        ).toBe(404)
    })

    it('answers nothing for another person', () => {
        expect(
            statusOf(() =>
                serverFor()({
                    resource: 'tracker/trackedEntities',
                    id: 'someoneElse',
                })
            )
        ).toBe(404)
    })

    describe('edge-case presets', () => {
        it('keeps an unbroken identifier, a leap-day birth and an option code the set no longer has', () => {
            const values = new Map(
                recordOf(settingsOf('Long values')).attributes.map(
                    ({ attribute, value }) => [attribute, value]
                )
            )
            expect(values.get('labUniqueId')).not.toContain(' ')
            expect(values.get('labBirthDat')).toBe('1988-02-29')
            expect(values.get('labAllergie')).toContain('LATEX')
        })

        it('records nothing for the person with nothing recorded', () => {
            expect(recordOf(settingsOf('Nothing recorded')).attributes).toEqual(
                []
            )
        })

        it('serves option sets the block cannot read for broken metadata', () => {
            const settings = settingsOf('Broken metadata')
            const metadata = ProgramAttributesResponseSchema.parse(
                serverFor(settings)({
                    resource: 'programs',
                    id: SUBJECTS[settings.record].program,
                })
            )
            expect([...metadata.invalid.keys()]).toEqual([
                'labLastBrkn',
                'labAllerBrk',
            ])
        })

        it('answers 404 with the program when not enrolled, and the person without it', () => {
            const settings = settingsOf('Not enrolled')
            expect(statusOf(() => recordOf(settings))).toBe(404)
            expect(recordOf(settings, false).attributes.length).toBeGreaterThan(
                0
            )
        })

        it('gives the person enrolled again a completed and an active enrollment', () => {
            expect(
                recordOf(settingsOf('Enrolled again')).enrollments.map(
                    ({ status }) => status
                )
            ).toEqual(['COMPLETED', 'ACTIVE'])
        })

        it('fails only the owner request when the owner fails', () => {
            expect(settingsOf('Owner fails').network.endpoints).toEqual({
                organisationUnits: { behaviour: 'fails' },
            })
        })

        it('writes the Amharic person in Ge’ez script on the Ethiopian calendar', () => {
            const settings = settingsOf('Amharic, Ethiopian calendar')
            expect(settings.calendar).toBe('ethiopian')
            expect(
                recordOf(settings).attributes.find(
                    ({ attribute }) => attribute === 'labFirstNam'
                )?.value
            ).toMatch(/^[\u1200-\u137F]+$/)
        })

        it('lays the Arabic person out right to left', () => {
            const settings = settingsOf('Arabic, right to left')
            expect(settings.rtl).toBe(true)
            expect(
                recordOf(settings).attributes.find(
                    ({ attribute }) => attribute === 'labFirstNam'
                )?.value
            ).toMatch(/^[\u0600-\u06FF]+$/)
        })
    })

    it('answers 404 with and without the program for Not found', () => {
        const settings = settingsOf('Not found')
        expect(statusOf(() => recordOf(settings))).toBe(404)
        expect(statusOf(() => recordOf(settings, false))).toBe(404)
    })

    describe('layout presets', () => {
        const programOf = (settings: ReturnType<typeof settingsOf>) =>
            ProgramAttributesResponseSchema.parse(
                serverFor(settings)({
                    resource: 'programs',
                    id: SUBJECTS[settings.record].program,
                })
            )
        const placedBy = (settings: ReturnType<typeof settingsOf>) => {
            const { name, date, identifier, fact, more } = partsFor(settings)
            return [
                ...name,
                'attribute' in date ? date.attribute : '',
                identifier,
                fact,
                ...more,
            ]
        }

        it('gives the host one button, or several', () => {
            expect(partsFor(DEFAULT_SETTINGS).actions).toEqual(['Record visit'])
            expect(
                partsFor(settingsOf('Several actions')).actions.length
            ).toBeGreaterThan(2)
        })

        it('places eight more attributes on line one, none of them twice', () => {
            const settings = settingsOf('Many values on line one')
            const placed = placedBy(settings)
            expect(partsFor(settings).more).toHaveLength(8)
            expect(new Set(placed).size).toBe(placed.length)
            for (const id of partsFor(settings).more) {
                expect(programOf(settings).attributes.has(id)).toBe(true)
            }
        })

        it('leaves many attributes for the details, and none for No details', () => {
            const unplaced = (name: string) => {
                const settings = settingsOf(name)
                const placed = placedBy(settings)
                return [...programOf(settings).attributes.keys()].filter(
                    (id) => !placed.includes(id)
                )
            }
            expect(unplaced('Many details').length).toBeGreaterThan(10)
            expect(unplaced('No details')).toEqual([])
        })

        it('serves a vaccine shipment with its own type, date label and buttons', () => {
            const settings = settingsOf('Vaccine shipment')
            const respond = serverFor(settings)
            expect(
                TypeAttributesResponseSchema.parse(
                    respond({
                        resource: 'trackedEntityTypes',
                        id: SUBJECTS.shipment.type,
                    })
                ).typeName
            ).toBe('Shipment')
            expect(programOf(settings).incidentDateLabel).toBe('Dispatched')
            expect(partsFor(settings).actions).toContain('Receive')
            expect(recordOf(settings).attributes.length).toBeGreaterThan(5)
        })
    })

    describe('relationship presets', () => {
        const relationshipsOf = (name: string) => {
            const settings = settingsOf(name)
            const respond = serverFor(settings)
            const links = RelationshipsResponseSchema.parse(
                respond({
                    resource: 'tracker/relationships',
                    params: { trackedEntity: LAB_PERSON },
                })
            )
            const typeIds = [...new Set(links.map((l) => l.relationshipType))]
            const types = RelationshipTypesResponseSchema.parse(
                respond({
                    resource: 'relationshipTypes',
                    params: { filter: `id:in:[${typeIds.join(',')}]` },
                })
            )
            return { settings, links, types, respond }
        }

        it('leaves the other presets without relationship parts', () => {
            expect(partsFor(settingsOf('Pregnancy')).relationships).toBe(
                undefined
            )
        })

        it('has the mother at the from end of a one-way Mother-Child type, labelled for the baby', () => {
            const { settings, links, types, respond } =
                relationshipsOf('Mother and baby')
            expect(links).toHaveLength(1)
            expect(types.get(links[0]?.relationshipType ?? '')).toMatchObject({
                name: 'Mother-Child',
                bidirectional: false,
            })
            expect(links[0]?.from.entityId).toBe(LAB_PERSON)
            expect(partsFor(settings).relationships?.key).toMatchObject({
                end: 'from',
                label: { from: 'Baby', to: 'Mother' },
            })
            const view = types.get('labMothChld')?.ends.to.view ?? []
            expect(
                ViewAttributesResponseSchema.parse(
                    respond({
                        resource: 'trackedEntityAttributes',
                        params: { filter: `id:in:[${view.join(',')}]` },
                    })
                ).size
            ).toBe(view.length)
        })

        it('has 300 links of one type and a moreHref', () => {
            const { links } = relationshipsOf('Focus with 300 cases')
            expect(links).toHaveLength(300)
            expect(new Set(links.map((l) => l.relationshipType)).size).toBe(1)
        })

        it('has a linked record the block cannot read', () => {
            const { links } = relationshipsOf('Linked record without access')
            expect(links.map((l) => l.to.linked.kind)).toEqual(['unreadable'])
        })

        it('has two linked events', () => {
            const { links } = relationshipsOf('Linked events only')
            expect(links.map((l) => l.to.linked.kind)).toEqual([
                'event',
                'event',
            ])
        })

        it('names the raw types as the demo does, with and without labels', () => {
            const raw = relationshipsOf('Raw type names')
            const name = raw.types.get('labMothChld')?.name
            expect(name).toBe('Mother-Child_a-to-b_(Person-Person)')
            expect(partsFor(raw.settings).relationships?.labels).toBe(undefined)
            const relabelled = relationshipsOf('Raw type names, relabelled')
            expect(relabelled.types.get('labMothChld')?.name).toBe(name)
            expect(
                partsFor(relabelled.settings).relationships?.labels
            ).toHaveProperty('labMothChld')
        })
    })
})
