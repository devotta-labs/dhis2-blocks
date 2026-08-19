import { test, expect } from '../fixtures/test'

const SEEDED_PROGRAM = 'WlE2ePrg001'
const SEEDED_STAGE = 'WlE2eStg001'
const SEEDED_ORG_UNIT = 'DiszpKrYNg8'
const SEEDED_TRACKED_ENTITY = 'WlE2eTei001'
const SEEDED_EVENT = 'WlE2eEvt001'
const environment = (
    globalThis as typeof globalThis & {
        process?: { env: Record<string, string | undefined> }
    }
).process?.env

test.describe('real DHIS2 server contract', () => {
    test('runs the requested supported server generation', async ({
        dhis2,
    }) => {
        const response = await dhis2.get(
            '/api/system/info?fields=version,revision,buildTime'
        )
        expect(response.ok()).toBe(true)

        const info = (await response.json()) as { version: string }
        const expectedMajor = environment?.E2E_EXPECTED_MAJOR
        expect(info.version).toBeTruthy()

        if (expectedMajor && expectedMajor !== 'dev') {
            expect(info.version).toMatch(
                new RegExp(`^(?:2\\.)?${expectedMajor}(?:[.-]|$)`)
            )
        } else {
            const major = Number(
                info.version.replace(/^2\./, '').match(/^\d+/)?.[0]
            )
            expect(major).toBeGreaterThan(43)
        }
    })

    test('contains the idempotently seeded value-type metadata', async ({
        dhis2,
    }) => {
        const response = await dhis2.get(
            `/api/programs/${SEEDED_PROGRAM}?fields=id,programType,programTrackedEntityAttributes[trackedEntityAttribute[id,valueType]],programStages[id,programStageDataElements[dataElement[id,valueType]]]`
        )
        expect(response.ok()).toBe(true)

        const program = (await response.json()) as {
            id: string
            programType: string
            programTrackedEntityAttributes: Array<{
                trackedEntityAttribute: { valueType: string }
            }>
            programStages: Array<{
                programStageDataElements: Array<{
                    dataElement: { valueType: string }
                }>
            }>
        }

        expect(program.id).toBe(SEEDED_PROGRAM)
        expect(program.programType).toBe('WITH_REGISTRATION')
        expect(
            program.programTrackedEntityAttributes.map(
                ({ trackedEntityAttribute }) => trackedEntityAttribute.valueType
            )
        ).toEqual(
            expect.arrayContaining([
                'TEXT',
                'INTEGER',
                'NUMBER',
                'BOOLEAN',
                'DATE',
                'DATETIME',
                'ORGANISATION_UNIT',
                'COORDINATE',
                'FILE_RESOURCE',
                'MULTI_TEXT',
                'EMAIL',
                'PHONE_NUMBER',
                'GEOJSON',
            ])
        )
        expect(
            program.programStages[0]?.programStageDataElements.map(
                ({ dataElement }) => dataElement.valueType
            )
        ).toEqual(
            expect.arrayContaining(['TEXT', 'NUMBER', 'DATE', 'FILE_RESOURCE'])
        )
    })

    test('queries seeded tracked entities through the real tracker API', async ({
        dhis2,
    }) => {
        const response = await dhis2.get('/api/tracker/trackedEntities', {
            params: {
                program: SEEDED_PROGRAM,
                orgUnits: SEEDED_ORG_UNIT,
                orgUnitMode: 'SELECTED',
                trackedEntities: SEEDED_TRACKED_ENTITY,
                page: '1',
                pageSize: '1',
                fields: 'trackedEntity,attributes[attribute,value]',
            },
        })
        expect(response.ok()).toBe(true)
        expect(await response.text()).toContain(SEEDED_TRACKED_ENTITY)
    })

    test('queries seeded programme-stage events through the real tracker API', async ({
        dhis2,
    }) => {
        const response = await dhis2.get('/api/tracker/events', {
            params: {
                program: SEEDED_PROGRAM,
                programStage: SEEDED_STAGE,
                orgUnit: SEEDED_ORG_UNIT,
                orgUnitMode: 'SELECTED',
                events: SEEDED_EVENT,
                page: '1',
                pageSize: '1',
                fields: 'event,trackedEntity,dataValues[dataElement,value]',
            },
        })
        expect(response.ok()).toBe(true)
        expect(await response.text()).toContain(SEEDED_EVENT)
    })

    test('provides both saved working-list metadata resources', async ({
        dhis2,
    }) => {
        const trackedEntityLists = await dhis2.get(
            '/api/trackedEntityInstanceFilters',
            {
                params: {
                    filter: `program.id:eq:${SEEDED_PROGRAM}`,
                    fields: 'id,displayName,entityQueryCriteria',
                },
            }
        )
        const stageLists = await dhis2.get('/api/programStageWorkingLists', {
            params: {
                filter: `program.id:eq:${SEEDED_PROGRAM}`,
                fields: 'id,displayName,programStage,programStageQueryCriteria',
            },
        })

        expect(trackedEntityLists.ok()).toBe(true)
        expect(stageLists.ok()).toBe(true)
    })
})
