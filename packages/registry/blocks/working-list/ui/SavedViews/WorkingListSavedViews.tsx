import i18n from '@dhis2/d2-i18n'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/dhis2/ui/alert-dialog'
import { Button } from '@/components/dhis2/ui/button'
import { useOnlineStatus } from '@dhis2/app-runtime'
import React, { useMemo, useState } from 'react'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import type { WorkingListView } from '../../provider/contracts'
import type {
    DeleteViewError,
    UpdateSelectedViewError,
} from '../../provider/errors'
import {
    useDeleteSavedList,
    useIsSavingList,
    useUpdateSavedList,
} from '../../provider/mutations'
import {
    toWorkingListView,
    useSavedLists,
    useWorkingListView,
} from '../../provider/queries'
import { useWorkingList } from '../../provider/WorkingListContext'
import { SavedListBar } from '../SavedListBar'
import { SavedViewsSkeleton } from '../Skeleton'
import { WorkingListSharingDialog } from '../WorkingList/dialogs'

type SavedViewActionError = UpdateSelectedViewError | DeleteViewError

const actionErrorCopy = (error: SavedViewActionError) => {
    switch (error._tag) {
        case 'OfflineMutationError':
            return i18n.t('This action is unavailable while offline.')
        case 'WorkingListNetworkError':
            return i18n.t(
                'A network error stopped the request. Check the connection and try again.'
            )
        case 'WorkingListInvalidResponseError':
            return i18n.t('The server returned an unexpected response.')
        case 'SavedListPermissionError':
            return i18n.t('You do not have permission to make this change.')
        case 'SavedListNotFoundError':
            return i18n.t(
                'The working list could not be found. It may have been deleted.'
            )
        case 'NoSelectedSavedListError':
            return i18n.t('Select a saved working list before updating it.')
        case 'InvalidConfigurationError':
            return i18n.t('The selected working list could not be applied.')
    }
}

export const WorkingListSavedViews = () => {
    const { viewId, selectView } = useWorkingList()
    const { online } = useOnlineStatus()
    const savedLists = useSavedLists()
    const dirty = useWorkingListView().data?.isDirty ?? false
    const busy = useIsSavingList()
    const update = useUpdateSavedList()
    const remove = useDeleteSavedList()
    const [pendingSelection, setPendingSelection] = useState<WorkingListView>()
    const [sharingList, setSharingList] = useState<NormalizedSavedWorkingList>()
    const [sharingError, setSharingError] = useState<string>()
    const actionError: SavedViewActionError | null =
        update.error ?? remove.error
    const clearActionError = () => {
        update.reset()
        remove.reset()
    }

    const loaded = savedLists.data
    const views = useMemo(
        () =>
            loaded?.lists.map((list) =>
                toWorkingListView(list, loaded.generated)
            ),
        [loaded]
    )

    const applySelection = (view: WorkingListView) => {
        clearActionError()
        // Selecting the selected list again returns to the default list.
        selectView(view.id === viewId ? null : view.id)
    }
    const requestSelection = (view: WorkingListView) => {
        if (dirty) {
            setPendingSelection(view)
            return
        }
        applySelection(view)
    }
    const updateSelected = () => {
        clearActionError()
        update.mutate()
    }
    const deleteView = (view: WorkingListView) => {
        clearActionError()
        remove.mutate(view.id)
    }
    const shareView = (view: WorkingListView) => {
        const list = loaded?.lists.find((candidate) => candidate.id === view.id)
        if (!list) {
            throw new Error(`Saved working list ${view.id} is unavailable.`)
        }
        setSharingError(undefined)
        setSharingList(list)
    }

    return (
        <div data-testid="working-list-saved-views">
            {savedLists.isPending && <SavedViewsSkeleton />}
            {/* Lists loaded before a failed reload stay usable above the error. */}
            {views && (
                <SavedListBar
                    lists={views}
                    selectedId={viewId}
                    dirty={dirty}
                    online={online}
                    busy={busy}
                    onSelect={requestSelection}
                    onUpdate={updateSelected}
                    onShare={shareView}
                    onDelete={deleteView}
                />
            )}
            {savedLists.isError && (
                <div className="p-4" data-testid="saved-working-lists-error">
                    <ErrorAlert
                        title={i18n.t('Could not load saved working lists')}
                    >
                        <p>
                            {i18n.t(
                                'Saved working lists could not be loaded. Check the connection and try again.'
                            )}
                        </p>
                        <Button
                            variant="outline"
                            data-test="retry-saved-working-lists"
                            onClick={() => void savedLists.refetch()}
                        >
                            {i18n.t('Try again')}
                        </Button>
                    </ErrorAlert>
                </div>
            )}

            {actionError && (
                <div data-testid="working-list-view-action-error">
                    <ErrorAlert
                        title={i18n.t('Could not change the working list')}
                    >
                        {actionErrorCopy(actionError)}
                    </ErrorAlert>
                </div>
            )}

            {pendingSelection && (
                <AlertDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            setPendingSelection(undefined)
                        }
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {i18n.t('Discard unsaved changes?')}
                            </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogDescription>
                            {i18n.t(
                                'Changing the saved view will discard the unsaved changes to this working list.'
                            )}
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                            <AlertDialogCancel data-test="discard-saved-view-change-cancel">
                                {i18n.t('Cancel')}
                            </AlertDialogCancel>
                            <Button
                                variant="destructive"
                                data-test="discard-saved-view-change-confirm"
                                onClick={() => {
                                    const target = pendingSelection
                                    setPendingSelection(undefined)
                                    applySelection(target)
                                }}
                            >
                                {i18n.t('Discard changes')}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            <WorkingListSharingDialog
                list={sharingList}
                error={sharingError}
                onClose={() => setSharingList(undefined)}
                onError={setSharingError}
                onSave={async () => {
                    setSharingError(undefined)
                    try {
                        await savedLists.refetch({ throwOnError: true })
                        setSharingList(undefined)
                    } catch (error) {
                        setSharingError(
                            error instanceof Error
                                ? error.message
                                : i18n.t('Could not refresh saved views')
                        )
                    }
                }}
            />
        </div>
    )
}
