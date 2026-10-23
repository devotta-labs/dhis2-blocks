import type { useRender } from '@base-ui/react/use-render'
import type { Result } from 'better-result'
import type {
    ProfileWidgetInvalidResponseError,
    ProfileWidgetRequestError,
    TrackedEntityNotAccessibleError,
    TrackerImportError,
} from './errors'

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

export interface ProfileFieldOption {
    code: string
    displayName: string
}

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
    rawValue: string | null
    value: ProfileFieldValue
    options?: readonly ProfileFieldOption[]
}

export interface TrackedEntityAttributeField extends ProfileField {
    origin: 'trackedEntityType' | 'program' | 'both'
    displayInList: boolean
    unique: boolean
}

export interface UseTrackedEntityProfileOptions {
    trackedEntityId: string
    programId?: string
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
    title: string
    displayName: string
    attributes: readonly TrackedEntityAttributeField[]
    fields: readonly ProfileField[]
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

export interface ProfileFieldInput {
    id: string
    label: string
    valueType: string
    value: string | null
    options?: readonly ProfileFieldOption[]
    fileEndpoint?: string
}

export interface UseProfileFieldsResult {
    data: readonly ProfileField[] | undefined
    error: ProfileWidgetRequestError | null
    isPending: boolean
}

export type TrackedEntityChangeType = 'CREATE' | 'UPDATE' | 'DELETE'

export interface TrackedEntityChangelogEntry {
    id: string
    createdAt: string
    createdAtLabel: string
    user: {
        username: string
        displayName: string
    }
    attributeId: string
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
    page: number
    pageSize: number
    attributeId?: string
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
    refetch: () => void
}

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

export interface ControlledDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}
