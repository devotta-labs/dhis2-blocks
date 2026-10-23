import { z } from 'zod'
import type { ProfileServerFeatures } from './serverVersion'

/*
 * Boundary schemas for every DHIS2 response the block reads. Objects pass
 * unknown keys through so newer servers never break validation; optional
 * fields are the ones DHIS2 omits when they are unset.
 */

/* ------------------------------ Metadata ---------------------------------- */

const DataAccessSchema = z
    .object({
        data: z.object({ read: z.boolean(), write: z.boolean() }).passthrough(),
    })
    .passthrough()

const OptionSchema = z
    .object({ code: z.string(), displayName: z.string() })
    .passthrough()

const TrackedEntityAttributeSchema = z
    .object({
        id: z.string().min(1),
        displayFormName: z.string(),
        /** Raw DHIS2 ValueType; decode with the formatting pipeline. */
        valueType: z.string().min(1),
        unique: z.boolean().optional().default(false),
        access: z.object({ read: z.boolean() }).passthrough(),
        optionSet: z
            .object({
                id: z.string().min(1),
                options: z.array(OptionSchema).optional().default([]),
            })
            .passthrough()
            .optional(),
    })
    .passthrough()

export type ApiTrackedEntityAttribute = z.infer<
    typeof TrackedEntityAttributeSchema
>

const AttributeLinkSchema = z
    .object({
        displayInList: z.boolean().optional().default(false),
        trackedEntityAttribute: TrackedEntityAttributeSchema,
    })
    .passthrough()

export type ApiAttributeLink = z.infer<typeof AttributeLinkSchema>

export const TrackedEntityTypeMetadataSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().optional(),
        access: DataAccessSchema,
        /** 2.43+. Absent on older servers, which hides the changelog. */
        enableChangeLog: z.boolean().optional(),
        trackedEntityTypeAttributes: z
            .array(AttributeLinkSchema)
            .optional()
            .default([]),
    })
    .passthrough()

export type ApiTrackedEntityTypeMetadata = z.infer<
    typeof TrackedEntityTypeMetadataSchema
>

export const ProgramMetadataSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().optional(),
        access: DataAccessSchema,
        /*
         * Custom terminology (2.43+). DHIS2 omits unset labels. The server has
         * no plural attribute label yet (only the singular
         * displayTrackedEntityAttributeLabel), so the plural is requested as
         * Capture does and usually falls back to the default.
         */
        displayTrackedEntityAttributesLabel: z.string().optional(),
        displayEnrollmentsLabel: z.string().optional(),
        displayEventsLabel: z.string().optional(),
        trackedEntityType: TrackedEntityTypeMetadataSchema,
        programTrackedEntityAttributes: z
            .array(AttributeLinkSchema)
            .optional()
            .default([]),
    })
    .passthrough()

export type ApiProgramMetadata = z.infer<typeof ProgramMetadataSchema>

const ATTRIBUTE_FIELDS =
    'id,displayFormName,valueType,unique,access[read],optionSet[id,options[code,displayName]]'

const trackedEntityTypeFields = (features: ProfileServerFeatures) =>
    [
        'id',
        'displayName',
        'access',
        ...(features.trackedEntityTypeChangeLog ? ['enableChangeLog'] : []),
        `trackedEntityTypeAttributes[displayInList,trackedEntityAttribute[${ATTRIBUTE_FIELDS}]]`,
    ].join(',')

/** `fields` for `programs/{id}`; label and changelog fields need 2.43+. */
export const programMetadataFields = (features: ProfileServerFeatures) =>
    [
        'id',
        'displayName',
        'access',
        ...(features.programTerminology
            ? [
                  'displayTrackedEntityAttributesLabel',
                  'displayEnrollmentsLabel',
                  'displayEventsLabel',
              ]
            : []),
        `trackedEntityType[${trackedEntityTypeFields(features)}]`,
        `programTrackedEntityAttributes[displayInList,trackedEntityAttribute[${ATTRIBUTE_FIELDS}]]`,
    ].join(',')

/** `fields` for `trackedEntityTypes/{id}` (no-program mode). */
export const trackedEntityTypeMetadataFields = trackedEntityTypeFields

/* ---------------------------- Tracked entity ------------------------------ */

export const TRACKED_ENTITY_PROFILE_FIELDS =
    'trackedEntity,trackedEntityType,orgUnit,inactive,attributes[attribute,value]'

export const TrackedEntityRecordSchema = z
    .object({
        trackedEntity: z.string().min(1),
        trackedEntityType: z.string().min(1),
        /** Missing org unit makes `setInactive` unavailable, as in Capture. */
        orgUnit: z.string().min(1).optional(),
        inactive: z.boolean().optional().default(false),
        attributes: z
            .array(
                z
                    .object({ attribute: z.string().min(1), value: z.string() })
                    .passthrough()
            )
            .optional()
            .default([]),
    })
    .passthrough()

export type ApiTrackedEntityRecord = z.infer<typeof TrackedEntityRecordSchema>

const GeometrySchema = z
    .object({ type: z.string().min(1), coordinates: z.json() })
    .passthrough()

/** Fields a tracker UPDATE overwrites unconditionally. */
export const TRACKED_ENTITY_UPDATE_FIELDS =
    'trackedEntity,trackedEntityType,orgUnit,inactive,geometry,potentialDuplicate,createdAtClient,updatedAtClient'

export const TrackedEntityForUpdateSchema = z
    .object({
        trackedEntity: z.string().min(1),
        trackedEntityType: z.string().min(1),
        orgUnit: z.string().min(1),
        inactive: z.boolean().optional().default(false),
        /** GeoJSON geometry; echoed back untouched. */
        geometry: GeometrySchema.nullable().optional(),
        potentialDuplicate: z.boolean().optional(),
        createdAtClient: z.string().optional(),
        updatedAtClient: z.string().optional(),
    })
    .passthrough()

export type ApiTrackedEntityForUpdate = z.infer<
    typeof TrackedEntityForUpdateSchema
>

/* ------------------------------ System -------------------------------------- */

const PROFILE_CALENDARS = [
    'coptic',
    'ethiopian',
    'gregorian',
    'islamic',
    'iso8601',
    'nepali',
    'persian',
    'thai',
] as const

export type ProfileCalendar = (typeof PROFILE_CALENDARS)[number]
type ProfileDateFormat = 'YYYY-MM-DD' | 'DD-MM-YYYY'

const DateFormatSchema = z
    .enum([
        'YYYY-MM-DD',
        'DD-MM-YYYY',
        'yyyy-MM-dd',
        'dd-MM-yyyy',
        'yyyy-mm-dd',
        'dd-mm-yyyy',
    ])
    .transform((value): ProfileDateFormat =>
        value.toLowerCase().startsWith('dd') ? 'DD-MM-YYYY' : 'YYYY-MM-DD'
    )

export const SYSTEM_INFO_FIELDS = 'calendar,dateFormat'

export const SystemInfoSchema = z
    .object({
        calendar: z.enum(PROFILE_CALENDARS),
        dateFormat: DateFormatSchema,
    })
    .passthrough()

export type ProfileSystemInfo = z.infer<typeof SystemInfoSchema>

export const MeAuthoritiesSchema = z
    .object({ authorities: z.array(z.string()) })
    .passthrough()

/* ------------------------------ Lookups ----------------------------------- */

export const FileResourceSchema = z
    .object({ id: z.string().min(1), displayName: z.string() })
    .passthrough()

export const ORGANISATION_UNIT_LOOKUP_FIELDS =
    'id,displayName,ancestors[displayName]'

export const OrganisationUnitsResponseSchema = z
    .object({
        organisationUnits: z.array(
            z
                .object({
                    id: z.string().min(1),
                    displayName: z.string(),
                    /** Root first, parent last. */
                    ancestors: z
                        .array(
                            z.object({ displayName: z.string() }).passthrough()
                        )
                        .optional()
                        .default([]),
                })
                .passthrough()
        ),
    })
    .passthrough()

/* ------------------------------ Changelog --------------------------------- */

export const ChangelogResponseSchema = z
    .object({
        pager: z
            .object({
                page: z.number().int().optional(),
                pageSize: z.number().int().optional(),
                nextPage: z.string().optional(),
                prevPage: z.string().optional(),
            })
            .passthrough()
            .optional(),
        changeLogs: z.array(
            z
                .object({
                    createdBy: z
                        .object({
                            uid: z.string().optional(),
                            username: z.string(),
                            firstName: z.string().optional(),
                            surname: z.string().optional(),
                        })
                        .passthrough(),
                    createdAt: z.string(),
                    type: z.enum(['CREATE', 'UPDATE', 'DELETE']),
                    change: z
                        .object({
                            attributeValue: z
                                .object({
                                    attribute: z.string().min(1),
                                    previousValue: z.string().optional(),
                                    currentValue: z.string().optional(),
                                })
                                .passthrough(),
                        })
                        .passthrough(),
                })
                .passthrough()
        ),
    })
    .passthrough()

export type ApiChangelogResponse = z.infer<typeof ChangelogResponseSchema>
export type ApiChangelogEntry = ApiChangelogResponse['changeLogs'][number]

/* ---------------------------- Tracker import ------------------------------ */

const ErrorReportSchema = z
    .object({
        message: z.string(),
        errorCode: z.string().optional(),
        trackerType: z.string().optional(),
        uid: z.string().optional(),
    })
    .passthrough()

export const TrackerImportReportSchema = z
    .object({
        status: z.enum(['OK', 'WARNING', 'ERROR']),
        validationReport: z
            .object({
                errorReports: z.array(ErrorReportSchema).optional().default([]),
            })
            .passthrough()
            .optional(),
    })
    .passthrough()

/** One tracked entity in a `POST tracker` body. */
interface TrackedEntityImportPayload {
    trackedEntity: string
    trackedEntityType?: string
    orgUnit?: string
    inactive?: boolean
    geometry?: z.infer<typeof GeometrySchema> | null
    potentialDuplicate?: boolean
    createdAtClient?: string
    updatedAtClient?: string
}

export interface TrackerImportPayload {
    trackedEntities: readonly TrackedEntityImportPayload[]
}
