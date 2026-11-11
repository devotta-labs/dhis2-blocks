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
import { Result } from 'better-result'
import React, { useState } from 'react'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import type { WorkingListSavedView } from '../../provider/contracts'
import type {
    DeleteViewError,
    SelectViewError,
    UpdateSelectedViewError,
} from '../../provider/errors'
import {
    useWorkingListActions,
    useWorkingListMeta,
} from '../../provider/WorkingListContext'
import { useWorkingListPrivateUi } from '../../provider/WorkingListPrivateContext'
import { SavedListBar } from '../SavedListBar'
import { SavedViewsSkeleton } from '../Skeleton'
import { WorkingListSharingDialog } from '../WorkingList/dialogs'

type SavedViewActionError =
    | SelectViewError
    | UpdateSelectedViewError
    | DeleteViewError

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
        case 'IncompatibleSavedListError':
            return i18n.t(
                'Repair this working list before saving changes to it.'
            )
        case 'NoSelectedSavedListError':
            return i18n.t('Select a saved working list before updating it.')
        case 'InvalidConfigurationError':
            return i18n.t('The selected working list could not be applied.')
    }
}

export const WorkingListSavedViews = () => {
    const savedViews = useWorkingListMeta((meta) => meta.savedViews)
    const selection = useWorkingListMeta((meta) => meta.selection)
    const dirty = useWorkingListMeta((meta) => meta.dirty)
    const online = useWorkingListMeta((meta) => meta.online)
    const actions = useWorkingListActions()
    const { displayedLists, mutationBusy, privateActions } =
        useWorkingListPrivateUi()
    const [pendingSelection, setPendingSelection] =
        useState<WorkingListSavedView>()
    const [sharingList, setSharingList] = useState<NormalizedSavedWorkingList>()
    const [sharingError, setSharingError] = useState<string>()
    const [actionError, setActionError] = useState<SavedViewActionError>()

    const selectedId =
        selection.status === 'ready'
            ? selection.selectedSavedListId
            : selection.requestedSavedListId

    const applySelection = (view: WorkingListSavedView) => {
        setActionError(undefined)
        const result =
            view.id === selectedId
                ? actions.clearViewSelection()
                : actions.selectView(view.id)
        if (Result.isError(result)) {
            setActionError(result.error)
        }
    }
    const requestSelection = (view: WorkingListSavedView) => {
        if (dirty) {
            setPendingSelection(view)
            return
        }
        applySelection(view)
    }
    const updateSelected = async () => {
        setActionError(undefined)
        const result = await actions.updateSelectedView()
        if (Result.isError(result)) {
            setActionError(result.error)
        }
    }
    const deleteView = async (view: WorkingListSavedView) => {
        setActionError(undefined)
        const result = await actions.deleteView(view.id)
        if (Result.isError(result)) {
            setActionError(result.error)
        }
    }
    const shareView = (view: WorkingListSavedView) => {
        const internal = displayedLists.find((list) => list.id === view.id)
        if (!internal) {
            throw new Error(`Saved working list ${view.id} is unavailable.`)
        }
        setSharingError(undefined)
        setSharingList(internal)
    }

    return (
        <div data-testid="working-list-saved-views">
            {savedViews.status === 'pending' && <SavedViewsSkeleton />}
            {savedViews.status === 'error' && savedViews.views.length > 0 && (
                <SavedListBar
                    lists={savedViews.views}
                    selectedId={selectedId}
                    dirty={dirty}
                    online={online}
                    busy={mutationBusy}
                    onSelect={requestSelection}
                    onUpdate={() => void updateSelected()}
                    onShare={shareView}
                    onDelete={(view) => void deleteView(view)}
                />
            )}
            {savedViews.status === 'error' && (
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
                            onClick={() =>
                                void privateActions.retrySavedViews()
                            }
                        >
                            {i18n.t('Try again')}
                        </Button>
                    </ErrorAlert>
                </div>
            )}
            {savedViews.status === 'ready' && (
                <SavedListBar
                    lists={savedViews.views}
                    selectedId={selectedId}
                    dirty={dirty}
                    online={online}
                    busy={mutationBusy}
                    onSelect={requestSelection}
                    onUpdate={() => void updateSelected()}
                    onShare={shareView}
                    onDelete={(view) => void deleteView(view)}
                />
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
                        await privateActions.sharingSaved()
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
