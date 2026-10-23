import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useProfileWidgetClient } from '../api/runtime'
import { profileWidgetQueryKeys } from '../api/queryKeys'
import type {
    SetTrackedEntityInactiveInput,
    UseSetTrackedEntityInactiveResult,
} from '../types'
import { setTrackedEntityInactive } from './trackerImport'

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
