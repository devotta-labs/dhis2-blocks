import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useProfileWidgetClient } from '../api/runtime'
import { profileWidgetQueryKeys } from '../api/queryKeys'
import type {
    SetTrackedEntityInactiveInput,
    UseSetTrackedEntityInactiveResult,
} from '../types'
import { setTrackedEntityInactive } from './trackerImport'

/**
 * Re-reads the entity (`fetchTrackedEntityForUpdate`) and echoes it with the
 * new `inactive` and `updatedAtClient = now` via
 * `POST tracker?async=false&importStrategy=UPDATE`. On success,
 * invalidates `profileWidgetQueryKeys.trackedEntity(id)` (the profile record
 * and every changelog page) and resolves once the active queries have
 * refetched, so callers see fresh data when the promise settles.
 *
 * `setInactive` never rejects: failures resolve to `Result.err` with a
 * `TrackerImportError` (tracker `errorReports`) or a
 * `ProfileWidgetRequestError`.
 */
export function useSetTrackedEntityInactive(): UseSetTrackedEntityInactiveResult {
    const client = useProfileWidgetClient()
    const queryClient = useQueryClient()
    const { mutateAsync, isPending } = useMutation({
        mutationFn: async (input: SetTrackedEntityInactiveInput) => {
            const result = await setTrackedEntityInactive(client, input)
            if (result.isOk()) {
                await queryClient.invalidateQueries({
                    queryKey: profileWidgetQueryKeys.trackedEntity(
                        input.trackedEntityId
                    ),
                })
            }
            return result
        },
    })

    return { setInactive: mutateAsync, isPending }
}
