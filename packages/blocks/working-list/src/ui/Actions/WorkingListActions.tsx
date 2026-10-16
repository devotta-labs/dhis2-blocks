import { Alert, AlertDescription, AlertTitle } from '../primitives/alert'
import { Button } from '../primitives/button'
import { DropdownMenuTriggerArrow } from '../primitives/dropdown-menu'
import { IconErrorFilled24, IconMore16 } from '@dhis2/ui-icons'
import { Result } from 'better-result'
import React, { useState, type ComponentPropsWithoutRef } from 'react'
import type {
    CreateViewError,
    DownloadVisibleRowsError,
    UpdateSelectedViewError,
} from '../../provider/errors'
import {
    useWorkingListActions,
    useWorkingListMeta,
} from '../../provider/WorkingListContext'
import { useWorkingListPrivateUi } from '../../provider/WorkingListPrivateContext'
import { ConfigureMenu } from '../ConfigureMenu'
import {
    useWorkingListText,
    type WorkingListTranslate,
} from '../WorkingListText'

type SaveError = CreateViewError | UpdateSelectedViewError

type ActionCopy = (translate: WorkingListTranslate) => string

const actionCopy = {
    controls: {
        saveView: (translate) => translate('Save view'),
        more: (translate) => translate('More'),
    },
    noticeTitles: {
        save: (translate) => translate('Could not save the working list'),
        download: (translate) => translate('Could not download data'),
    },
    saveErrors: {
        OfflineMutationError: (translate) =>
            translate('This action is unavailable while offline.'),
        WorkingListNetworkError: (translate) =>
            translate(
                'A network error stopped the request. Check the connection and try again.'
            ),
        WorkingListInvalidResponseError: (translate) =>
            translate('The server returned an unexpected response.'),
        SavedListPermissionError: (translate) =>
            translate('You do not have permission to make this change.'),
        SavedListNotFoundError: (translate) =>
            translate(
                'The working list could not be found. It may have been deleted.'
            ),
        IncompatibleSavedListError: (translate) =>
            translate('Repair this working list before saving changes to it.'),
        NoSelectedSavedListError: (translate) =>
            translate('Select a saved working list before updating it.'),
        InvalidConfigurationError: (translate) =>
            translate(
                'The current working list configuration cannot be saved.'
            ),
    },
    downloadErrors: {
        DownloadVisibleRowsError: (translate) =>
            translate(
                'The results are still loading. Try the download again once they have loaded.'
            ),
    },
} satisfies {
    controls: Record<'saveView' | 'more', ActionCopy>
    noticeTitles: Record<'save' | 'download', ActionCopy>
    saveErrors: Record<SaveError['_tag'], ActionCopy>
    downloadErrors: Record<DownloadVisibleRowsError['_tag'], ActionCopy>
}

const saveErrorCopy = (error: SaveError, translate: WorkingListTranslate) =>
    actionCopy.saveErrors[error._tag](translate)

const downloadErrorCopy = (
    error: DownloadVisibleRowsError,
    translate: WorkingListTranslate
) => actionCopy.downloadErrors[error._tag](translate)

const ActionsControl = () => {
    const translate = useWorkingListText()
    const online = useWorkingListMeta((meta) => meta.online)
    const dirty = useWorkingListMeta((meta) => meta.dirty)
    const selection = useWorkingListMeta((meta) => meta.selection)
    const savedViews = useWorkingListMeta((meta) => meta.savedViews)
    const mutations = useWorkingListMeta((meta) => meta.mutations)
    const actions = useWorkingListActions()
    const { mutationBusy } = useWorkingListPrivateUi()
    const [saveError, setSaveError] = useState<string>()
    const [downloadError, setDownloadError] = useState<string>()

    const selectedView =
        selection.status === 'ready'
            ? savedViews.views.find(
                  (view) => view.id === selection.selectedSavedListId
              )
            : undefined
    const saveAs = async (name: string) => {
        setSaveError(undefined)
        const result = await actions.createView(name)
        return Result.isError(result)
            ? saveErrorCopy(result.error, translate)
            : undefined
    }
    const update = async () => {
        setSaveError(undefined)
        const result = await actions.updateSelectedView()
        if (Result.isError(result)) {
            setSaveError(saveErrorCopy(result.error, translate))
        }
    }
    const download = () => {
        setDownloadError(undefined)
        const result = actions.downloadVisibleRows()
        if (Result.isError(result)) {
            setDownloadError(downloadErrorCopy(result.error, translate))
        }
    }

    return (
        <div className="flex items-start gap-2">
            <ConfigureMenu
                selectedView={selectedView}
                dirty={dirty}
                online={online}
                busy={mutationBusy}
                createPending={mutations.create.status === 'pending'}
                onDownload={download}
                onSaveAs={saveAs}
                onUpdate={() => void update()}
            />
            {saveError && (
                <div data-testid="working-list-save-error">
                    <Alert variant="destructive">
                        <IconErrorFilled24 />
                        <AlertTitle>
                            {actionCopy.noticeTitles.save(translate)}
                        </AlertTitle>
                        <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                </div>
            )}
            {downloadError && (
                <div data-testid="working-list-download-error">
                    <Alert variant="destructive">
                        <IconErrorFilled24 />
                        <AlertTitle>
                            {actionCopy.noticeTitles.download(translate)}
                        </AlertTitle>
                        <AlertDescription>{downloadError}</AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    )
}

export interface WorkingListToolbarActionsProps extends Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
> {}

export const WorkingListToolbarActions = ({
    className,
    ...props
}: WorkingListToolbarActionsProps) => {
    const translate = useWorkingListText()
    const ready = useWorkingListMeta(
        (meta) => meta.activeConfiguration.status === 'ready'
    )

    return (
        <div
            {...props}
            className={`ml-auto flex flex-none items-center${className ? ` ${className}` : ''}`}
            data-testid="working-list-actions-slot"
        >
            {ready ? (
                <ActionsControl />
            ) : (
                <div
                    className="flex items-center gap-1"
                    data-testid="working-list-actions"
                >
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        data-test="save-working-list"
                        disabled
                    >
                        {actionCopy.controls.saveView(translate)}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        data-test="working-list-options"
                        disabled
                    >
                        <IconMore16 />
                        {actionCopy.controls.more(translate)}
                        <DropdownMenuTriggerArrow />
                    </Button>
                </div>
            )}
        </div>
    )
}
