import type { ComponentProps } from 'react'
import type { LabServerScope } from '../../playground/LabServer'
import { aliasIds, type IdAliases } from './aliasIds'

/** What a docs example's fake DHIS2 is made of; the playground's labs build the same parts. */
export type MockServer = Pick<
    ComponentProps<typeof LabServerScope>,
    'resources' | 'respond' | 'systemInfo' | 'apiVersion'
>

/**
 * Each lab types the requests it reads its own way, a narrower `params` than
 * the network's. The block sends the same JSON either way, so the lab's server
 * is used as the host's.
 */
const asHost = <Request extends object>(
    respond: (
        request: Request,
        type: 'read' | 'create' | 'update' | 'replace' | 'delete'
    ) => object | Promise<object>
): MockServer['respond'] =>
    // SAFETY: LabServerScope passes the request exactly as app-runtime sends it to the lab.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions
    respond as unknown as MockServer['respond']

const aliased = (server: MockServer, aliases: IdAliases): MockServer => ({
    ...server,
    resources: server.resources.map((resource) => nameOf(resource, aliases)),
    respond: aliasIds(server.respond, aliases),
})

/** A resource path that names a lab id, as the example asks for it by its own uid. */
const nameOf = (resource: string, aliases: IdAliases) =>
    Object.entries(aliases).reduce(
        (name, [exampleId, labId]) =>
            labId.length >= 8 ? name.replaceAll(labId, exampleId) : name,
        resource
    )

const PERSON = 'Y8aEiTpHSSQ'
const RMNCH = 'WSGAb5XwJ3Y'
const CHILD_PROGRAMME = 'IpHINAT79UW'
const NGELEHUN_CHC = 'y77LiPqLMoq'

/** The lab answers one program by id; a picker asks for the list of them. */
const withProgramList =
    (
        respond: MockServer['respond'],
        programId: string,
        orgUnitId: string
    ): MockServer['respond'] =>
    async (request, type) =>
        request.resource === 'programs' && request.id === undefined
            ? {
                  programs: [
                      {
                          id: programId,
                          displayName: 'Child Programme',
                          organisationUnits: [{ id: orgUnitId }],
                      },
                  ],
              }
            : respond(request, type)

const workingListTable = async (): Promise<MockServer> => {
    const { createLabServer, RESOURCES } =
        await import('../../playground/working-list/table/labServer')
    const { DEFAULT_CONFIG } =
        await import('../../playground/working-list/table/presets')
    const { generateWorld, LAB_PROGRAM, LAB_ORG_UNIT } =
        await import('../../playground/working-list/table/labData')
    const { data, server } = DEFAULT_CONFIG
    return aliased(
        {
            resources: RESOURCES,
            respond: withProgramList(
                asHost(createLabServer({ data, server }, generateWorld(data))),
                LAB_PROGRAM,
                LAB_ORG_UNIT
            ),
            apiVersion: server.apiVersion,
        },
        { [CHILD_PROGRAMME]: LAB_PROGRAM, [NGELEHUN_CHC]: LAB_ORG_UNIT }
    )
}

const workingListCalendar = async (): Promise<MockServer> => {
    const { answer, RESOURCES } =
        await import('../../playground/working-list/calendar/labServer')
    const { DEFAULT_CONFIG } =
        await import('../../playground/working-list/calendar/presets')
    const { generateWorld, LAB_PROGRAM, LAB_ORG_UNIT } =
        await import('../../playground/working-list/calendar/labData')
    const world = generateWorld(DEFAULT_CONFIG.data)
    return aliased(
        {
            resources: RESOURCES,
            respond: asHost((request: Parameters<typeof answer>[2]) =>
                answer(DEFAULT_CONFIG, world, request)
            ),
            apiVersion: DEFAULT_CONFIG.server.apiVersion,
        },
        { [CHILD_PROGRAMME]: LAB_PROGRAM, [NGELEHUN_CHC]: LAB_ORG_UNIT }
    )
}

const observationCards = async (): Promise<MockServer> => {
    const { answer, RESOURCES } =
        await import('../../playground/observation-cards/labServer')
    const { generateLabData, LAB_PERSON, LAB_PROGRAM, CARD_ELEMENTS } =
        await import('../../playground/observation-cards/labData')
    const { DEFAULT_SETTINGS } =
        await import('../../playground/observation-cards/presets')
    const data = generateLabData(DEFAULT_SETTINGS)
    return aliased(
        {
            resources: RESOURCES,
            respond: asHost(answer(DEFAULT_SETTINGS, data)),
            systemInfo: data.systemInfo,
        },
        {
            [PERSON]: LAB_PERSON,
            [RMNCH]: LAB_PROGRAM,
            vANAXwtLwcT: CARD_ELEMENTS[0] ?? '',
            sWoqcoByYmD: CARD_ELEMENTS[1] ?? '',
            EyfTU3ibMmJ: CARD_ELEMENTS[2] ?? '',
        }
    )
}

const trackedEntityHeader = async (): Promise<MockServer> => {
    const { answer, RESOURCES } =
        await import('../../playground/tracked-entity-header/labServer')
    const { generateLabData, LAB_PERSON } =
        await import('../../playground/tracked-entity-header/labData')
    const { DEFAULT_SETTINGS } =
        await import('../../playground/tracked-entity-header/presets')
    const attributes =
        await import('../../playground/tracked-entity-header/labAttributes')
    const { LAB_PROGRAM, CARD_ELEMENTS } =
        await import('../../playground/observation-cards/labData')
    const data = generateLabData(DEFAULT_SETTINGS)
    return aliased(
        {
            resources: RESOURCES,
            respond: asHost(answer(DEFAULT_SETTINGS, data)),
            systemInfo: data.observations.systemInfo,
        },
        {
            [PERSON]: LAB_PERSON,
            [RMNCH]: LAB_PROGRAM,
            w75KJ2mc4zz: attributes.FIRST_NAME,
            zDhUuAYrxNC: attributes.LAST_NAME,
            gHGyrwKPzej: attributes.BIRTH_DATE,
            lZGmxYbs97q: attributes.UNIQUE_ID,
            gu1fqsmoU8r: attributes.ALLERGIES,
            vANAXwtLwcT: CARD_ELEMENTS[0] ?? '',
        }
    )
}

const timeline = async (): Promise<MockServer> => {
    const { answer, resourcesOf } =
        await import('../../playground/timeline/labServer')
    const { generateLabData, LAB_PERSON } =
        await import('../../playground/timeline/labData')
    const { DEFAULT_SETTINGS } =
        await import('../../playground/timeline/presets')
    const data = generateLabData(DEFAULT_SETTINGS)
    return aliased(
        {
            resources: resourcesOf(data),
            respond: asHost(answer(DEFAULT_SETTINGS, data)),
            systemInfo: data.systemInfo,
        },
        { [PERSON]: LAB_PERSON }
    )
}

const orgUnitSwitcher = async (): Promise<MockServer> => {
    const { answer, RESOURCES } =
        await import('../../playground/org-unit-switcher/labServer')
    const { generateLabData } =
        await import('../../playground/org-unit-switcher/labData')
    const { DEFAULT_SETTINGS } =
        await import('../../playground/org-unit-switcher/presets')
    const data = generateLabData(DEFAULT_SETTINGS)
    return {
        resources: RESOURCES,
        respond: asHost(answer(DEFAULT_SETTINGS, data)),
    }
}

const trackedEntityFinder = async (): Promise<MockServer> => {
    const { answer, RESOURCES } =
        await import('../../playground/tracked-entity-finder/labServer')
    const { LAB_PROGRAM } =
        await import('../../playground/tracked-entity-finder/labData')
    const { DEFAULT_SETTINGS } =
        await import('../../playground/tracked-entity-finder/presets')
    return aliased(
        {
            resources: RESOURCES,
            respond: asHost(answer(DEFAULT_SETTINGS)),
        },
        {
            [RMNCH]: LAB_PROGRAM,
            // The second program of the picker example has its own attributes.
            ur1Edk5Oe2n: LAB_PROGRAM,
            lZGmxYbs97q: 'nationalId',
            xs8A6tQJY0s: 'nationalId',
            w75KJ2mc4zz: 'firstName',
            zDhUuAYrxNC: 'lastName',
            gHGyrwKPzej: 'dob',
        }
    )
}

/** The tracker data entry lab's example for each docs example; its data already uses the demo database's ids. */
const trackerDataEntry =
    (example: 'inpatient' | 'person' | 'immunisation') =>
    async (): Promise<MockServer> => {
        const { answer, RESOURCES } =
            await import('../../playground/tracker-data-entry/labServer')
        const { generateLabData } =
            await import('../../playground/tracker-data-entry/labData')
        const { DEFAULT_SETTINGS } =
            await import('../../playground/tracker-data-entry/presets')
        const settings = { ...DEFAULT_SETTINGS, example }
        return {
            resources: RESOURCES,
            respond: asHost(answer(settings, generateLabData(settings))),
        }
    }

const servers = {
    'working-list/default': workingListTable,
    'working-list/program-picker': workingListTable,
    'working-list/calendar': workingListCalendar,
    'observation-cards/person-vitals': observationCards,
    'tracked-entity-header/person-banner': trackedEntityHeader,
    'timeline/case-history': timeline,
    'org-unit-switcher/sidebar': orgUnitSwitcher,
    'tracker-data-entry/event-program': trackerDataEntry('inpatient'),
    'tracker-data-entry/person-events': trackerDataEntry('person'),
    'tracker-data-entry/tracker-register': trackerDataEntry('person'),
    'tracker-data-entry/cohort-anc-register': trackerDataEntry('person'),
    'tracker-data-entry/value-types': trackerDataEntry('person'),
    'tracker-data-entry/immunisation-register':
        trackerDataEntry('immunisation'),
    'tracked-entity-finder/find-person': trackedEntityFinder,
    'tracked-entity-finder/custom-rows': trackedEntityFinder,
    'tracked-entity-finder/program-picker': trackedEntityFinder,
} satisfies Record<string, () => Promise<MockServer>>

/** The fake DHIS2 for a docs example, loaded when its card first renders. */
export const loadMockServer = (slug: string): Promise<MockServer> => {
    const load = Object.entries(servers).find(([name]) => name === slug)?.[1]
    if (!load) throw new Error(`No mock DHIS2 for the example ${slug}`)
    return load()
}
