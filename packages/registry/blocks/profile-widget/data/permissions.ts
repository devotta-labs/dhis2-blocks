import i18n from '@dhis2/d2-i18n'
import type {
    ApiProgramMetadata,
    ApiTrackedEntityRecord,
    ApiTrackedEntityTypeMetadata,
} from '../api/schemas'
import type { ProfileActionAvailability, ProfilePermissions } from '../types'

const AVAILABLE: ProfileActionAvailability = { status: 'available' }
const UNAVAILABLE: ProfileActionAvailability = { status: 'unavailable' }

const CASCADE_DELETE_AUTHORITIES = ['ALL', 'F_TEI_CASCADE_DELETE']

export const resolveProfilePermissions = (input: {
    trackedEntityType: ApiTrackedEntityTypeMetadata
    trackedEntityTypeName: string
    program: ApiProgramMetadata | null
    record: ApiTrackedEntityRecord
    authorities: readonly string[]
}): ProfilePermissions => {
    const { trackedEntityType, program, record } = input
    const trackedEntityTypeWrite = trackedEntityType.access.data.write
    const programWrite = program ? program.access.data.write : true
    const canCascadeDelete = input.authorities.some((authority) =>
        CASCADE_DELETE_AUTHORITIES.includes(authority)
    )

    const deletePermission = (): ProfileActionAvailability => {
        if (!trackedEntityTypeWrite || !programWrite || record.inactive) {
            return UNAVAILABLE
        }
        return canCascadeDelete
            ? AVAILABLE
            : {
                  status: 'disabled',
                  reason: i18n.t(
                      'You do not have access to delete this {{trackedEntityTypeName}}',
                      {
                          trackedEntityTypeName: input.trackedEntityTypeName,
                          interpolation: { escapeValue: false },
                      }
                  ),
              }
    }

    return {
        changelog:
            trackedEntityType.enableChangeLog === true
                ? AVAILABLE
                : UNAVAILABLE,
        setInactive:
            trackedEntityTypeWrite && record.orgUnit ? AVAILABLE : UNAVAILABLE,
        delete: deletePermission(),
    }
}
