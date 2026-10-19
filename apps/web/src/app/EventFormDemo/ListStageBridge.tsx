import {
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from '@dhis2-blocks/working-list'
import React, { useEffect, useRef } from 'react'

const ListStageApplier = ({ stageId }: { stageId?: string }) => {
    const actions = useWorkingListActions()
    const currentStageId = useWorkingListState((state) =>
        state.configuration.mode === 'event'
            ? state.configuration.programStageId
            : undefined
    )
    const applied = useRef<string>()

    useEffect(() => {
        if (!stageId || applied.current === stageId) {
            return
        }
        applied.current = stageId
        if (currentStageId !== stageId) {
            actions.setProgramStage(stageId)
        }
    }, [actions, currentStageId, stageId])

    return null
}

/**
 * Keeps the Working List on the event list of the chosen stage. It applies the stage when the
 * stage changes, not on every render, so the list's own stage controls still work afterwards.
 * The state hook needs a ready configuration, so the applier mounts once the list is ready.
 */
export const ListStageBridge = ({ stageId }: { stageId?: string }) => {
    const ready = useWorkingListMeta(
        (meta) => meta.activeConfiguration.status === 'ready'
    )
    return ready ? <ListStageApplier stageId={stageId} /> : null
}
