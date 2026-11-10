import {
    OrgUnitResponseSchema,
    ProgramAttributesResponseSchema,
    TrackedEntityResponseSchema,
    TypeAttributesResponseSchema,
} from '@/components/tracked-entity-header/api/schemas'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { generateLabData, LAB_PERSON, SUBJECTS } from '../labData'
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

const personOf = (settings = DEFAULT_SETTINGS, withProgram = true) =>
    TrackedEntityResponseSchema.parse(
        serverFor(settings)({
            resource: 'tracker/trackedEntities',
            id: LAB_PERSON,
            params: withProgram
                ? { program: SUBJECTS[settings.person].program }
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
        const { program, type } = SUBJECTS[settings.person]
        const respond = serverFor(settings)
        expect(personOf(settings).attributes.length).toBeGreaterThan(0)
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
        const withProgram = personOf(settingsOf('Pregnancy'))
        const without = personOf(settingsOf('Pregnancy'), false)
        expect(without.attributes.length).toBeLessThan(
            withProgram.attributes.length
        )
    })

    it('gives the child an enrollment, and its date of birth is the incident date', () => {
        const settings = settingsOf('Child')
        const [enrollment] = personOf(settings).enrollments
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
        const person = personOf(settings)
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
        expect(personOf(settingsOf('Inactive')).inactive).toBe(true)
        expect(
            personOf(settingsOf('Possible duplicate')).potentialDuplicate
        ).toBe(true)
        expect(personOf().inactive).toBe(false)
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
})
