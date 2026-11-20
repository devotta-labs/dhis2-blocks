import { aliasIds, type RequestType } from './aliasIds'
import type { MockServer } from './servers'

/**
 * The fake DHIS2 behind each example that needs one, built from the same
 * generators and servers as the playground's labs, so the docs and the
 * playground show the same data. Each is imported when its example mounts.
 *
 * Aliases map the demo database's ids, which the examples show, to the lab's.
 */
const servers = {
    'working-list/default': () => workingList(),
    'working-list/calendar': () => workingList(),
    'working-list/program-picker': () => workingList(true),

    'observation-cards/person-vitals': async () => {
        const [
            { answer, RESOURCES },
            { generateLabData },
            { DEFAULT_SETTINGS },
        ] = await Promise.all([
            import('../../playground/observation-cards/labServer'),
            import('../../playground/observation-cards/labData'),
            import('../../playground/observation-cards/presets'),
        ])
        // Haemoglobin, smoking and extreme pallor: a number and two yes-or-no.
        const settings = {
            ...DEFAULT_SETTINGS,
            cards: [
                DEFAULT_SETTINGS.cards[0],
                DEFAULT_SETTINGS.cards[2],
                {
                    ...DEFAULT_SETTINGS.cards[2],
                    element: 'dangerSigns' as const,
                },
            ],
        }
        return {
            resources: RESOURCES,
            respond: aliasIds(answer(settings, generateLabData(settings)), {
                WSGAb5XwJ3Y: 'labProgram1',
                Y8aEiTpHSSQ: 'labPerson01',
                vANAXwtLwcT: 'labCardDe01',
                sWoqcoByYmD: 'labCardDe02',
                EyfTU3ibMmJ: 'labCardDe03',
            }),
        }
    },

    'tracked-entity-header/person-banner': async () => {
        const [{ answer, RESOURCES }, { DEFAULT_SETTINGS }] = await Promise.all(
            [
                import('../../playground/tracked-entity-header/labServer'),
                import('../../playground/tracked-entity-header/presets'),
            ]
        )
        return {
            resources: RESOURCES,
            respond: aliasIds(answer(DEFAULT_SETTINGS), {
                WSGAb5XwJ3Y: 'labProgram1',
                Y8aEiTpHSSQ: 'labPerson01',
                w75KJ2mc4zz: 'labFirstNam',
                zDhUuAYrxNC: 'labLastName',
                gHGyrwKPzej: 'labBirthDat',
                lZGmxYbs97q: 'labUniqueId',
                gu1fqsmoU8r: 'labAllergie',
                vANAXwtLwcT: 'labCardDe01',
            }),
        }
    },

    'timeline/case-history': async () => {
        const [
            { answer, resourcesOf },
            { generateLabData },
            { DEFAULT_SETTINGS },
        ] = await Promise.all([
            import('../../playground/timeline/labServer'),
            import('../../playground/timeline/labData'),
            import('../../playground/timeline/presets'),
        ])
        const data = generateLabData(DEFAULT_SETTINGS)
        return {
            resources: resourcesOf(data).map((resource) =>
                resource.replace('labPerson01', 'Y8aEiTpHSSQ')
            ),
            respond: aliasIds(answer(DEFAULT_SETTINGS, data), {
                Y8aEiTpHSSQ: 'labPerson01',
            }),
            systemInfo: data.systemInfo,
        }
    },

    'org-unit-switcher/sidebar': async () => {
        const [
            { answer, RESOURCES },
            { generateLabData },
            { DEFAULT_SETTINGS },
        ] = await Promise.all([
            import('../../playground/org-unit-switcher/labServer'),
            import('../../playground/org-unit-switcher/labData'),
            import('../../playground/org-unit-switcher/presets'),
        ])
        return {
            resources: RESOURCES,
            respond: answer(
                DEFAULT_SETTINGS,
                generateLabData(DEFAULT_SETTINGS)
            ),
        }
    },

    'tracked-entity-finder/find-person': () => finder(),
    'tracked-entity-finder/custom-rows': () => finder('few'),
    'tracked-entity-finder/program-picker': () => finder('two'),

    'tracker-data-entry/event-program': () => dataEntry('inpatient'),
    'tracker-data-entry/person-events': () => dataEntry('person'),
    'tracker-data-entry/tracker-register': () => dataEntry('person'),
    // Builds its own source; the host only supplies the query client.
    'tracker-data-entry/value-types': () => dataEntry('inpatient'),
    'tracker-data-entry/cohort-anc-register': () => dataEntry('person'),
    'tracker-data-entry/immunisation-register': () => dataEntry('immunisation'),
} satisfies Record<string, () => Promise<MockServer>>

const byExample = new Map<string, () => Promise<MockServer>>(
    Object.entries(servers)
)

const FACILITY = { id: 'y77LiPqLMoq', displayName: 'Ngelehun CHC' }

/** The working list's table lab, which answers the lab's one program and clinic. */
const workingList = async (withPrograms = false): Promise<MockServer> => {
    const [
        { createLabServer, RESOURCES },
        { generateWorld },
        { DEFAULT_CONFIG },
    ] = await Promise.all([
        import('../../playground/working-list/table/labServer'),
        import('../../playground/working-list/table/labData'),
        import('../../playground/working-list/table/presets'),
    ])
    const lab = aliasIds(
        createLabServer(DEFAULT_CONFIG, generateWorld(DEFAULT_CONFIG.data)),
        {
            IpHINAT79UW: 'labProgram1',
            y77LiPqLMoq: 'labOrgUnit1',
        }
    )
    return {
        resources: RESOURCES,
        apiVersion: DEFAULT_CONFIG.server.apiVersion,
        respond: withPrograms
            ? // The program picker lists the programs and the user's units, which the lab leaves out.
              (
                  request: { resource: string; id?: string },
                  type: RequestType
              ) => {
                  if (request.resource === 'programs' && !request.id) {
                      return {
                          programs: [
                              {
                                  id: 'IpHINAT79UW',
                                  displayName: 'Child Programme',
                                  organisationUnits: [{ id: FACILITY.id }],
                              },
                          ],
                      }
                  }
                  if (request.resource === 'me') {
                      return { organisationUnits: [FACILITY] }
                  }
                  // SAFETY: the lab server reads the same request shape the block sends.
                  return lab(request as never, type)
              }
            : lab,
    }
}

const finder = async (
    variant: 'default' | 'few' | 'two' = 'default'
): Promise<MockServer> => {
    const [{ answer, RESOURCES }, { DEFAULT_SETTINGS }, { programJson }] =
        await Promise.all([
            import('../../playground/tracked-entity-finder/labServer'),
            import('../../playground/tracked-entity-finder/presets'),
            import('../../playground/tracked-entity-finder/labData'),
        ])
    // A search by first name alone is enough for the examples that offer only that.
    const program =
        variant === 'few'
            ? { ...DEFAULT_SETTINGS.program, minAttributes: 1 }
            : DEFAULT_SETTINGS.program
    const lab = aliasIds(answer({ ...DEFAULT_SETTINGS, program }), {
        WSGAb5XwJ3Y: 'labProgram1',
        lZGmxYbs97q: 'nationalId',
        w75KJ2mc4zz: 'firstName',
        zDhUuAYrxNC: 'lastName',
        gHGyrwKPzej: 'dob',
    })
    // The TB program: the same people, searched by its own identifier.
    const tb = programJson({
        ...program,
        name: 'TB program',
        attributes: program.attributes.map((attribute) =>
            attribute.id === 'nationalId'
                ? { ...attribute, id: 'xs8A6tQJY0s', label: 'TB identifier' }
                : attribute
        ),
    })
    return {
        resources: RESOURCES,
        respond:
            variant === 'two'
                ? (
                      request: { resource: string; id?: string },
                      type: RequestType
                  ) =>
                      request.resource === 'programs' &&
                      request.id === 'ur1Edk5Oe2n'
                          ? aliasIds(() => tb, {
                                lZGmxYbs97q: 'nationalId',
                                w75KJ2mc4zz: 'firstName',
                                zDhUuAYrxNC: 'lastName',
                                gHGyrwKPzej: 'dob',
                            })(request, type)
                          : // SAFETY: the lab server reads the same request shape the block sends.
                            lab(request as never, type)
                : lab,
    }
}

/** The data entry lab, which already answers with the demo database's ids. */
const dataEntry = async (
    example: 'inpatient' | 'person' | 'immunisation'
): Promise<MockServer> => {
    const [{ answer, RESOURCES }, { generateLabData }, { DEFAULT_SETTINGS }] =
        await Promise.all([
            import('../../playground/tracker-data-entry/labServer'),
            import('../../playground/tracker-data-entry/labData'),
            import('../../playground/tracker-data-entry/presets'),
        ])
    const settings = { ...DEFAULT_SETTINGS, example }
    return {
        resources: RESOURCES,
        respond: answer(settings, generateLabData(settings)),
    }
}

/** The fake server for an example, or nothing when it has none and runs on a live DHIS2. */
export const loadMockServer = (slug: string) => byExample.get(slug)?.()
export const hasMockServer = (slug: string) => byExample.has(slug)
