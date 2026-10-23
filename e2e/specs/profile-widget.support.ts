import type {
    APIRequestContext,
    Locator,
    Page,
    PlaywrightWorkerArgs,
} from '@playwright/test'
import { z } from 'zod'
import { expect, test as base } from '../fixtures/test'

const PROGRAM = 'PwE2ePrg001'
const TRACKED_ENTITY_TYPE = 'PwE2eTet001'
export const TRACKED_ENTITY_TYPE_NAME = 'Profile E2E person'
const ORG_UNIT = 'DiszpKrYNg8'
export const GEOMETRY = {
    type: 'Point',
    coordinates: [-11.4197, 8.1039],
} as const
const CREATED_AT_CLIENT = '2025-01-01T10:00:00.000'

export const ATTRIBUTE = {
    firstName: { id: 'PwAtFirs001', label: 'Profile E2E first name' },
    lastName: { id: 'PwAtLast001', label: 'Profile E2E last name' },
    nickname: { id: 'PwAtNick001', label: 'Profile E2E nickname' },
    typeOnlyHidden: {
        id: 'PwAtSecr001',
        label: 'Profile E2E type-only hidden',
    },
    visitNote: { id: 'PwAtNote001', label: 'Profile E2E visit note' },
    consent: { id: 'PwAtCons001', label: 'Profile E2E consent' },
    programHidden: { id: 'PwAtHide001', label: 'Profile E2E program hidden' },
} as const

type AttributeKey = keyof typeof ATTRIBUTE

const ATTRIBUTE_KEYS: readonly AttributeKey[] = [
    'firstName',
    'lastName',
    'nickname',
    'typeOnlyHidden',
    'visitNote',
    'consent',
    'programHidden',
]

const VALUE_TYPES = {
    firstName: 'TEXT',
    lastName: 'TEXT',
    nickname: 'TEXT',
    typeOnlyHidden: 'TEXT',
    visitNote: 'TEXT',
    consent: 'BOOLEAN',
    programHidden: 'TEXT',
} as const satisfies Record<AttributeKey, string>

const TYPE_ATTRIBUTES: readonly (readonly [AttributeKey, boolean])[] = [
    ['firstName', true],
    ['lastName', true],
    ['nickname', true],
    ['typeOnlyHidden', false],
]
const PROGRAM_ATTRIBUTES: readonly (readonly [AttributeKey, boolean])[] = [
    ['firstName', true],
    ['lastName', true],
    ['visitNote', true],
    ['consent', true],
    ['programHidden', false],
]

const DEFAULT_ATTRIBUTE_VALUES = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    nickname: 'Countess',
    typeOnlyHidden: 'Not in the list',
    consent: 'true',
    programHidden: 'Not in the list either',
} as const satisfies Partial<Record<AttributeKey, string>>

const linkId = (prefix: string, key: AttributeKey) =>
    `${prefix}${ATTRIBUTE[key].id.slice(4)}`

const buildProfileWidgetMetadata = (serverMinor: number) => ({
    trackedEntityAttributes: ATTRIBUTE_KEYS.map((key) => ({
        id: ATTRIBUTE[key].id,
        name: ATTRIBUTE[key].label,
        shortName: ATTRIBUTE[key].label,
        valueType: VALUE_TYPES[key],
        aggregationType: 'NONE',
    })),
    trackedEntityTypes: [
        {
            id: TRACKED_ENTITY_TYPE,
            name: TRACKED_ENTITY_TYPE_NAME,
            shortName: TRACKED_ENTITY_TYPE_NAME,
            featureType: 'POINT',
            allowAuditLog: false,
            enableChangeLog: serverMinor >= 43 ? true : undefined,
            publicAccess: 'rwrw----',
            sharing: { public: 'rwrw----' },
            trackedEntityTypeAttributes: TYPE_ATTRIBUTES.map(
                ([key, displayInList]) => ({
                    id: linkId('PwTa', key),
                    trackedEntityAttribute: { id: ATTRIBUTE[key].id },
                    displayInList,
                    searchable: false,
                })
            ),
        },
    ],
    programs: [
        {
            id: PROGRAM,
            name: 'Profile E2E program',
            shortName: 'Profile E2E program',
            programType: 'WITH_REGISTRATION',
            publicAccess: 'rwrw----',
            sharing: { public: 'rwrw----' },
            trackedEntityType: { id: TRACKED_ENTITY_TYPE },
            organisationUnits: [{ id: ORG_UNIT }],
            programTrackedEntityAttributes: PROGRAM_ATTRIBUTES.map(
                ([key, displayInList], index) => ({
                    id: linkId('PwPa', key),
                    trackedEntityAttribute: { id: ATTRIBUTE[key].id },
                    displayInList,
                    mandatory: false,
                    searchable: false,
                    sortOrder: index + 1,
                })
            ),
        },
    ],
})

const SystemInfoSchema = z.object({ version: z.string() })
const ImportReportSchema = z
    .object({
        status: z.string().optional(),
        response: z.object({ status: z.string() }).optional(),
    })
    .passthrough()
const TrackedEntitySchema = z
    .object({
        trackedEntity: z.string(),
        inactive: z.boolean(),
        potentialDuplicate: z.boolean().optional(),
        createdAtClient: z.string().optional(),
        geometry: z
            .object({
                type: z.string(),
                coordinates: z.array(z.number()),
            })
            .nullable()
            .optional(),
        attributes: z.array(
            z.object({ attribute: z.string(), value: z.string() })
        ),
    })
    .passthrough()

const DHIS2_URL = process.env?.E2E_DHIS2_URL
const ADMIN_USERNAME = process.env?.E2E_DHIS2_USERNAME ?? 'admin'
const ADMIN_PASSWORD = process.env?.E2E_DHIS2_PASSWORD ?? 'district'

export const createAdminApi = async (
    playwright: PlaywrightWorkerArgs['playwright']
) => {
    if (!DHIS2_URL) {
        throw new Error(
            'E2E_DHIS2_URL is required. Start a target with scripts/e2e/up.sh first.'
        )
    }
    return playwright.request.newContext({
        baseURL: DHIS2_URL,
        extraHTTPHeaders: {
            Accept: 'application/json',
            Authorization: `Basic ${globalThis.btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`)}`,
        },
    })
}

export const readServerMinor = async (api: APIRequestContext) => {
    const response = await api.get('/api/system/info?fields=version')
    expect(response.ok()).toBe(true)
    const { version } = SystemInfoSchema.parse(await response.json())
    const minor = Number(version.split('.')[1]?.replace(/\D.*$/, ''))
    if (!Number.isFinite(minor)) {
        throw new Error(`Unrecognised DHIS2 version ${version}`)
    }
    return minor
}

const expectImportOk = async (
    response: Awaited<ReturnType<APIRequestContext['post']>>,
    description: string
) => {
    const body = await response.text()
    expect(response.ok(), `${description}: ${body}`).toBe(true)
    const report = ImportReportSchema.parse(JSON.parse(body))
    expect(report.status ?? report.response?.status, body).toBe('OK')
}

export const importProfileWidgetMetadata = async (
    api: APIRequestContext,
    serverMinor: number
) =>
    expectImportOk(
        await api.post(
            '/api/metadata?importStrategy=CREATE_AND_UPDATE&atomicMode=ALL&importReportMode=ERRORS',
            { data: buildProfileWidgetMetadata(serverMinor) }
        ),
        'Profile widget metadata import'
    )

const UID_ALPHABET =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const generateUid = () =>
    `Pw${Array.from(
        { length: 9 },
        () => UID_ALPHABET[Math.floor(Math.random() * UID_ALPHABET.length)]
    ).join('')}`

const toAttributeValues = (
    values: Readonly<Partial<Record<AttributeKey, string>>>
) =>
    ATTRIBUTE_KEYS.flatMap((key) => {
        const value = values[key]
        return value === undefined
            ? []
            : [{ attribute: ATTRIBUTE[key].id, value }]
    })

interface TrackedEntityPayload {
    trackedEntity: string
    trackedEntityType?: string
    orgUnit?: string
    geometry?: typeof GEOMETRY
    potentialDuplicate?: boolean
    createdAtClient?: string
    attributes?: readonly { attribute: string; value: string }[]
    enrollments?: readonly {
        program: string
        orgUnit: string
        enrolledAt: string
        occurredAt: string
        status: 'ACTIVE'
    }[]
}

const postTracker = async (
    api: APIRequestContext,
    importStrategy: 'CREATE' | 'UPDATE' | 'DELETE',
    trackedEntities: readonly TrackedEntityPayload[]
) =>
    api.post(
        `/api/tracker?async=false&importStrategy=${importStrategy}&atomicMode=ALL`,
        { data: { trackedEntities } }
    )

export interface TrackedEntityFactory {
    create: () => Promise<string>
    updateFirstName: (
        trackedEntityId: string,
        values: readonly string[]
    ) => Promise<void>
    read: (
        trackedEntityId: string
    ) => Promise<z.infer<typeof TrackedEntitySchema>>
    status: (trackedEntityId: string) => Promise<number>
}

export const test = base.extend<{ trackedEntities: TrackedEntityFactory }>({
    trackedEntities: async ({ dhis2 }, use) => {
        const created: string[] = []

        await use({
            create: async () => {
                const trackedEntity = generateUid()
                await expectImportOk(
                    await postTracker(dhis2, 'CREATE', [
                        {
                            trackedEntity,
                            trackedEntityType: TRACKED_ENTITY_TYPE,
                            orgUnit: ORG_UNIT,
                            geometry: GEOMETRY,
                            potentialDuplicate: true,
                            createdAtClient: CREATED_AT_CLIENT,
                            attributes: toAttributeValues(
                                DEFAULT_ATTRIBUTE_VALUES
                            ),
                            enrollments: [
                                {
                                    program: PROGRAM,
                                    orgUnit: ORG_UNIT,
                                    enrolledAt: '2025-01-01',
                                    occurredAt: '2025-01-01',
                                    status: 'ACTIVE',
                                },
                            ],
                        },
                    ]),
                    `Create tracked entity ${trackedEntity}`
                )
                created.push(trackedEntity)
                return trackedEntity
            },
            updateFirstName: async (trackedEntity, values) => {
                for (const value of values) {
                    await expectImportOk(
                        await postTracker(dhis2, 'UPDATE', [
                            {
                                trackedEntity,
                                trackedEntityType: TRACKED_ENTITY_TYPE,
                                orgUnit: ORG_UNIT,
                                geometry: GEOMETRY,
                                potentialDuplicate: true,
                                createdAtClient: CREATED_AT_CLIENT,
                                attributes: toAttributeValues({
                                    firstName: value,
                                }),
                            },
                        ]),
                        `Update tracked entity ${trackedEntity}`
                    )
                }
            },
            read: async (trackedEntity) => {
                const response = await dhis2.get(
                    `/api/tracker/trackedEntities/${trackedEntity}`,
                    {
                        params: {
                            fields: 'trackedEntity,inactive,potentialDuplicate,createdAtClient,geometry,attributes[attribute,value]',
                        },
                    }
                )
                expect(response.ok(), await response.text()).toBe(true)
                return TrackedEntitySchema.parse(await response.json())
            },
            status: async (trackedEntity) =>
                (
                    await dhis2.get(
                        `/api/tracker/trackedEntities/${trackedEntity}`,
                        { params: { fields: 'trackedEntity' } }
                    )
                ).status(),
        })

        for (const trackedEntity of created) {
            await postTracker(dhis2, 'DELETE', [{ trackedEntity }])
        }
    },
})

export { expect }

const showcaseHash = (trackedEntityId: string, programId?: string) => {
    const parameters = new URLSearchParams({ trackedEntityId })
    if (programId) {
        parameters.set('programId', programId)
    }
    return `/#/profile-widget-showcase?${parameters.toString()}`
}

const settleAppShell = (page: Page) => page.waitForLoadState('networkidle')

export const openEnrollmentProfile = async (
    page: Page,
    trackedEntityId: string,
    programId: string = PROGRAM
) => {
    await settleAppShell(page)
    await page.goto(showcaseHash(trackedEntityId, programId))
    const widget = page.getByTestId('profile-widget-enrollment')
    await expect(widget.getByRole('term').first()).toBeVisible({
        timeout: 30_000,
    })
    return widget
}

export const openProfileMenu = async (page: Page, widget: Locator) => {
    await widget.getByRole('button', { name: 'More actions' }).click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    return menu
}

export const changelogRows = (dialog: Locator) => dialog.locator('tbody tr')
