import type { useRender } from '@base-ui/react/use-render'
import type { Result } from 'better-result'
import type {
    ProfileWidgetInvalidResponseError,
    ProfileWidgetRequestError,
    TrackedEntityNotAccessibleError,
    TrackerImportError,
} from './errors'

/* -------------------------------------------------------------------------- */
/* Values and fields                                                          */
/* -------------------------------------------------------------------------- */

/** Every DHIS2 `ValueType`. Unknown server strings decode to `'TEXT'`. */
export const PROFILE_VALUE_TYPES = [
    'TEXT',
    'LONG_TEXT',
    'MULTI_TEXT',
    'LETTER',
    'PHONE_NUMBER',
    'EMAIL',
    'BOOLEAN',
    'TRUE_ONLY',
    'DATE',
    'DATETIME',
    'TIME',
    'NUMBER',
    'UNIT_INTERVAL',
    'PERCENTAGE',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'TRACKER_ASSOCIATE',
    'USERNAME',
    'COORDINATE',
    'ORGANISATION_UNIT',
    'REFERENCE',
    'AGE',
    'URL',
    'FILE_RESOURCE',
    'IMAGE',
    'GEOJSON',
] as const

export type ProfileValueType = (typeof PROFILE_VALUE_TYPES)[number]

/** One option of an option set, as DHIS2 returns it. */
export interface ProfileFieldOption {
    code: string
    displayName: string
}

/** A formatted value, ready for `ProfileWidgetValue`. */
export type ProfileFieldValue =
    | { kind: 'empty' }
    | { kind: 'text'; text: string }
    | { kind: 'file'; name: string; href: string }
    | { kind: 'image'; href: string; previewHref: string; alt: string }
    | { kind: 'organisationUnit'; name: string; path: readonly string[] }
    | { kind: 'coordinate'; latitude: number; longitude: number }
    | { kind: 'polygon' }

export interface ProfileField {
    id: string
    label: string
    valueType: ProfileValueType
    /** Server value, kept for future editing */
    rawValue: string | null
    value: ProfileFieldValue
    /**
     * The option set's options when the field has one. Kept so the changelog
     * and a later edit form can label option codes without refetching.
     */
    options?: readonly ProfileFieldOption[]
}

export interface TrackedEntityAttributeField extends ProfileField {
    origin: 'trackedEntityType' | 'program' | 'both'
    /** The program-level flag when the attribute is in the program, otherwise the TET flag */
    displayInList: boolean
    unique: boolean
}

/* -------------------------------------------------------------------------- */
/* useTrackedEntityProfile                                                    */
/* -------------------------------------------------------------------------- */

export interface UseTrackedEntityProfileOptions {
    trackedEntityId: string
    programId?: string
    /** Runs on every render, outside the query key. It does not need to be stable. Default: selectDisplayInListAttributes */
    selectFields?: (
        attributes: readonly TrackedEntityAttributeField[]
    ) => readonly ProfileField[]
}

export type ProfileWidgetLoadError =
    | TrackedEntityNotAccessibleError
    | ProfileWidgetRequestError
    | ProfileWidgetInvalidResponseError

export interface UseTrackedEntityProfileResult {
    data: TrackedEntityProfileData | undefined
    error: ProfileWidgetLoadError | null
    isPending: boolean
    isFetching: boolean
    refetch: () => void
}

export interface TrackedEntityProfileData {
    /** "Person profile", or "Profile" when the type name is unknown */
    title: string
    /** First two TET displayInList values joined with a space (Capture's `??` bug fixed) */
    displayName: string
    /** Every readable attribute (TET ∪ program), formatted, in metadata order. Labels the changelog */
    attributes: readonly TrackedEntityAttributeField[]
    /** The default rows: selectFields(attributes) */
    fields: readonly ProfileField[]
    /** Program custom terminology (2.43+), defaulting to "attributes" / "enrollments" / "events" */
    labels: {
        attributes: string
        enrollments: string
        events: string
    }
    trackedEntity: ProfileTrackedEntity
    permissions: ProfilePermissions
}

export interface ProfileTrackedEntity {
    id: string
    programId: string | null
    trackedEntityTypeId: string
    /** Used in dialog copy, e.g. "Yes, delete Person" */
    trackedEntityTypeName: string
    orgUnitId: string
    inactive: boolean
}

export interface ProfilePermissions {
    changelog: ProfileActionAvailability
    setInactive: ProfileActionAvailability
    delete: ProfileActionAvailability
}

export type ProfileActionAvailability =
    | { status: 'available' }
    | { status: 'disabled'; reason: string }
    | { status: 'unavailable' }

/* -------------------------------------------------------------------------- */
/* useProfileFields                                                           */
/* -------------------------------------------------------------------------- */

export interface ProfileFieldInput {
    id: string
    label: string
    /** Raw DHIS2 valueType string. It is decoded inside the block; unknown types render as text */
    valueType: string
    value: string | null
    options?: readonly ProfileFieldOption[]
    /** API path for FILE_RESOURCE / IMAGE, e.g. `tracker/events/{event}/dataValues/{dataElement}`. The block appends /file or /image */
    fileEndpoint?: string
}

export interface UseProfileFieldsResult {
    data: readonly ProfileField[] | undefined
    error: ProfileWidgetRequestError | null
    /** Also true while `inputs` is undefined */
    isPending: boolean
}

/* -------------------------------------------------------------------------- */
/* Changelog                                                                  */
/* -------------------------------------------------------------------------- */

export type TrackedEntityChangeType = 'CREATE' | 'UPDATE' | 'DELETE'

export interface TrackedEntityChangelogEntry {
    /** Stable key for the row within its page */
    id: string
    /** Server timestamp as returned (ISO local date-time) */
    createdAt: string
    /** `createdAt` in the system calendar and date format, with HH:mm */
    createdAtLabel: string
    user: {
        username: string
        /** "First Last (username)", or the username when no name is known */
        displayName: string
    }
    attributeId: string
    /** Label from the attribute metadata passed in, so no row is dropped */
    attributeLabel: string
    changeType: TrackedEntityChangeType
    previousValue: ProfileFieldValue
    currentValue: ProfileFieldValue
}

export interface TrackedEntityChangelogOrder {
    column: 'createdAt' | 'username' | 'attribute'
    direction: 'asc' | 'desc'
}

export interface UseTrackedEntityChangelogOptions {
    trackedEntityId: string
    programId?: string
    attributes: readonly TrackedEntityAttributeField[]
    /** 1-based */
    page: number
    pageSize: number
    /** 2.42+ only; ignored on older servers */
    attributeId?: string
    /** `username` and `attribute` columns are 2.42+ only */
    order?: TrackedEntityChangelogOrder
}

export interface UseTrackedEntityChangelogResult {
    data:
        | {
              entries: readonly TrackedEntityChangelogEntry[]
              hasNextPage: boolean
          }
        | undefined
    error: ProfileWidgetLoadError | null
    isPending: boolean
    isFetching: boolean
    /** Re-requests the current page (and any lookup that failed) */
    refetch: () => void
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export type ProfileMutationError =
    | TrackerImportError
    | ProfileWidgetRequestError

export interface SetTrackedEntityInactiveInput {
    trackedEntityId: string
    inactive: boolean
}

export interface UseSetTrackedEntityInactiveResult {
    setInactive: (
        input: SetTrackedEntityInactiveInput
    ) => Promise<Result<void, ProfileMutationError>>
    isPending: boolean
}

export interface UseDeleteTrackedEntityResult {
    deleteTrackedEntity: (
        trackedEntityId: string
    ) => Promise<Result<void, ProfileMutationError>>
    isPending: boolean
}

/* -------------------------------------------------------------------------- */
/* Frame and dialogs                                                          */
/* -------------------------------------------------------------------------- */

export type ProfileWidgetProps = useRender.ComponentProps<'section'> &
    (
        | {
              open: boolean
              onOpenChange: (open: boolean) => void
              defaultOpen?: never
          }
        | {
              open?: never
              defaultOpen?: boolean
              onOpenChange?: (open: boolean) => void
          }
    )

/** Shared by every dialog: the host owns the open state. */
export interface ControlledDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}
