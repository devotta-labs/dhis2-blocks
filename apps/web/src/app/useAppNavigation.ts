import type { WorkingListResultTarget } from '@/components/working-list'
import { useCallback, useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { useAppUrlState } from './useAppUrlState'
import { isGuardedAppUrlTransition, parseAppUrlState } from './urlState'

interface PendingTransition {
    proceed: () => void
    cancel?: () => void
}

export const useAppNavigation = () => {
    const [{ programId, orgUnitId, selectedTemplateId }] = useAppUrlState()
    const [dirty, setDirty] = useState(false)
    const [openedRecord, setOpenedRecord] = useState<WorkingListResultTarget>()
    const [pendingTransition, setPendingTransition] =
        useState<PendingTransition>()

    useEffect(() => {
        setOpenedRecord(undefined)
    }, [programId, orgUnitId, selectedTemplateId])

    // Browser back/forward and manual hash edits arrive as POP. In-app
    // PUSH/REPLACE navigations are confirmed before writing the URL.
    const blocker = useBlocker(
        ({ currentLocation, nextLocation, historyAction }) => {
            if (historyAction !== 'POP' || !dirty) return false
            try {
                return isGuardedAppUrlTransition(
                    parseAppUrlState(
                        new URLSearchParams(currentLocation.search)
                    ),
                    parseAppUrlState(new URLSearchParams(nextLocation.search))
                )
            } catch {
                return false
            }
        }
    )

    useEffect(() => {
        if (blocker.state !== 'blocked') return
        // Reset restores the popped history entry, allowing Back/Forward
        // to be retried after cancellation.
        setPendingTransition({
            proceed: blocker.proceed,
            cancel: blocker.reset,
        })
    }, [blocker])

    useEffect(() => {
        if (!dirty) return
        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ''
        }
        window.addEventListener('beforeunload', warnBeforeUnload)
        return () =>
            window.removeEventListener('beforeunload', warnBeforeUnload)
    }, [dirty])

    const commit = useCallback((proceed: () => void) => {
        proceed()
        setDirty(false)
    }, [])

    const requestTransition = (proceed: () => void) => {
        if (blocker.state === 'blocked') blocker.reset()
        if (dirty) {
            setPendingTransition({ proceed })
        } else {
            setPendingTransition(undefined)
            commit(proceed)
        }
    }

    const cancelTransition = () => {
        setPendingTransition(undefined)
        pendingTransition?.cancel?.()
    }
    const confirmTransition = () => {
        setPendingTransition(undefined)
        if (pendingTransition) commit(pendingTransition.proceed)
    }

    return {
        setDirty,
        openedRecord,
        setOpenedRecord,
        requestTransition,
        confirmationOpen: Boolean(pendingTransition),
        cancelTransition,
        confirmTransition,
    }
}
