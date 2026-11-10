import {
    useHeaderContext,
    type TrackedEntityHeaderState,
} from './provider/context'

export type { TrackedEntityHeaderState }

/** The person and metadata the provider loaded, or why there are none yet. */
export const useTrackedEntityHeader = (): TrackedEntityHeaderState => {
    const { state } = useHeaderContext()
    return state
}
