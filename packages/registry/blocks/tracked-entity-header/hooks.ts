import {
    useHeaderContext,
    type TrackedEntityHeaderState,
} from './provider/context'

export type { TrackedEntityHeaderState }

/** The tracked entity and metadata the provider loaded, or why there are none yet. */
export const useTrackedEntityHeader = (): TrackedEntityHeaderState => {
    const { state } = useHeaderContext()
    return state
}
