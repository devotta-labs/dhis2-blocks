import {
    ProgramMetadataSchema,
    TrackedEntityRecordSchema,
    TrackedEntityTypeMetadataSchema,
    type ApiProgramMetadata,
    type ApiTrackedEntityRecord,
    type ApiTrackedEntityTypeMetadata,
} from '../../api/schemas'

/*
 * Server-shaped fixtures modelled on the Sierra Leone demo database (Child
 * Programme / Person) as DHIS2 2.43 returns them for the block's field lists.
 * They are parsed through the real boundary schemas so defaults apply.
 */

export const PERSON_TYPE_ID = 'nEenWmSyUEp'
export const CHILD_PROGRAM_ID = 'IpHINAT79UW'
export const TRACKED_ENTITY_ID = 'PQfMcpmXeFE'
export const ORG_UNIT_ID = 'DiszpKrYNg8'

const attribute = (
    id: string,
    displayFormName: string,
    valueType: string,
    extra: {
        unique?: boolean
        read?: boolean
        options?: readonly { code: string; displayName: string }[]
    } = {}
) => ({
    id,
    displayFormName,
    valueType,
    unique: extra.unique ?? false,
    access: { read: extra.read ?? true },
    optionSet: extra.options
        ? { id: `${id}Set`, options: extra.options }
        : undefined,
})

export const ATTRIBUTES = {
    uniqueId: attribute('lZGmxYbs97q', 'Unique ID', 'TEXT', { unique: true }),
    firstName: attribute('w75KJ2mc4zz', 'First name', 'TEXT'),
    lastName: attribute('zDhUuAYrxNC', 'Last name', 'TEXT'),
    gender: attribute('cejWyOfXge6', 'Gender', 'TEXT', {
        options: [
            { code: 'Male', displayName: 'Male' },
            { code: 'Female', displayName: 'Female' },
        ],
    }),
    birthDate: attribute('iESIqZ0R0R0', 'Date of birth', 'DATE'),
    address: attribute('VqEFza8wbwA', 'Address', 'TEXT'),
    photo: attribute('PhotoAttr01', 'Photo', 'IMAGE'),
    document: attribute('DocumentAt1', 'Consent form', 'FILE_RESOURCE'),
    homeFacility: attribute(
        'HomeFacilit',
        'Home facility',
        'ORGANISATION_UNIT'
    ),
    secret: attribute('SecretAttr1', 'Secret', 'TEXT', { read: false }),
    tags: attribute('TagsAttr001', 'Tags', 'MULTI_TEXT'),
} as const

export const trackedEntityTypeJson = (
    overrides: {
        enableChangeLog?: boolean
        write?: boolean
        displayName?: string
    } = {}
) => ({
    id: PERSON_TYPE_ID,
    displayName: overrides.displayName ?? 'Person',
    access: {
        read: true,
        write: true,
        data: { read: true, write: overrides.write ?? true },
    },
    enableChangeLog: overrides.enableChangeLog,
    trackedEntityTypeAttributes: [
        { displayInList: false, trackedEntityAttribute: ATTRIBUTES.uniqueId },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.firstName },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.lastName },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.address },
    ],
})

export const programJson = (
    overrides: {
        enableChangeLog?: boolean
        trackedEntityTypeWrite?: boolean
        programWrite?: boolean
        attributesLabel?: string
        enrollmentsLabel?: string
        eventsLabel?: string
    } = {}
) => ({
    id: CHILD_PROGRAM_ID,
    displayName: 'Child Programme',
    access: {
        read: true,
        write: true,
        data: { read: true, write: overrides.programWrite ?? true },
    },
    displayTrackedEntityAttributesLabel: overrides.attributesLabel,
    displayEnrollmentsLabel: overrides.enrollmentsLabel,
    displayEventsLabel: overrides.eventsLabel,
    trackedEntityType: trackedEntityTypeJson({
        enableChangeLog: overrides.enableChangeLog,
        write: overrides.trackedEntityTypeWrite,
    }),
    programTrackedEntityAttributes: [
        { displayInList: false, trackedEntityAttribute: ATTRIBUTES.lastName },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.firstName },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.gender },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.birthDate },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.photo },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.document },
        {
            displayInList: true,
            trackedEntityAttribute: ATTRIBUTES.homeFacility,
        },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.secret },
        { displayInList: true, trackedEntityAttribute: ATTRIBUTES.tags },
    ],
})

export const recordJson = (
    overrides: {
        inactive?: boolean
        orgUnit?: string | null
        attributes?: readonly { attribute: string; value: string }[]
    } = {}
) => ({
    trackedEntity: TRACKED_ENTITY_ID,
    trackedEntityType: PERSON_TYPE_ID,
    orgUnit:
        overrides.orgUnit === null
            ? undefined
            : (overrides.orgUnit ?? ORG_UNIT_ID),
    inactive: overrides.inactive ?? false,
    attributes: overrides.attributes ?? [
        { attribute: ATTRIBUTES.firstName.id, value: 'John' },
        { attribute: ATTRIBUTES.lastName.id, value: 'Kelly' },
        { attribute: ATTRIBUTES.gender.id, value: 'Male' },
        { attribute: ATTRIBUTES.birthDate.id, value: '2020-03-01' },
        { attribute: ATTRIBUTES.photo.id, value: 'ImageFile01' },
        { attribute: ATTRIBUTES.document.id, value: 'FileResour1' },
        { attribute: ATTRIBUTES.homeFacility.id, value: ORG_UNIT_ID },
        { attribute: ATTRIBUTES.address.id, value: 'Main street 2' },
    ],
})

export const parseProgram = (
    json: ReturnType<typeof programJson>
): ApiProgramMetadata => ProgramMetadataSchema.parse(json)

export const parseTrackedEntityType = (
    json: ReturnType<typeof trackedEntityTypeJson>
): ApiTrackedEntityTypeMetadata => TrackedEntityTypeMetadataSchema.parse(json)

export const parseRecord = (
    json: ReturnType<typeof recordJson>
): ApiTrackedEntityRecord => TrackedEntityRecordSchema.parse(json)

export const SYSTEM_INFO_JSON = {
    calendar: 'iso8601',
    dateFormat: 'yyyy-mm-dd',
} as const
