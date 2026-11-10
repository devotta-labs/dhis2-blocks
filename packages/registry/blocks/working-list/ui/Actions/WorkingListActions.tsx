import i18n from '@dhis2/d2-i18n'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { DropdownMenuTriggerArrow } from '@/components/dhis2/ui/dropdown-menu'
import { IconMore16 } from '@dhis2/ui-icons'
import { Result } from 'better-result'
import React, { useState, type ComponentPropsWithoutRef } from 'react'
import type {
    CreateViewError,
    UpdateSelectedViewError,
} from '../../provider/errors'
import {
    useWorkingListActions,
    useWorkingListMeta,
} from '../../provider/WorkingListContext'
import { useWorkingListPrivateUi } from '../../provider/WorkingListPrivateContext'
import { ConfigureMenu } from '../ConfigureMenu'

type SaveError = CreateViewError | UpdateSelectedViewError

const saveErrorCopy = (error: SaveError): string => {
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
            return i18n.t(
                'The current working list configuration cannot be saved.'
            )
    }
}

const ActionsControl = () => {
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
        return Result.isError(result) ? saveErrorCopy(result.error) : undefined
    }
    const update = async () => {
        setSaveError(undefined)
        const result = await actions.updateSelectedView()
        if (Result.isError(result)) {
            setSaveError(saveErrorCopy(result.error))
        }
    }
    const download = () => {
        setDownloadError(undefined)
        const result = actions.downloadVisibleRows()
        if (Result.isError(result)) {
            setDownloadError(
                i18n.t(
                    'The results are still loading. Try the download again once they have loaded.'
                )
            )
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
                    <ErrorAlert
                        title={i18n.t('Could not save the working list')}
                    >
                        {saveError}
                    </ErrorAlert>
                </div>
            )}
            {downloadError && (
                <div data-testid="working-list-download-error">
                    <ErrorAlert title={i18n.t('Could not download data')}>
                        {downloadError}
                    </ErrorAlert>
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
                        size="field-dense"
                        data-test="save-working-list"
                        disabled
                    >
                        {i18n.t('Save view')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="field-dense"
                        data-test="working-list-options"
                        disabled
                    >
                        <IconMore16 />
                        {i18n.t('More')}
                        <DropdownMenuTriggerArrow />
                    </Button>
                </div>
            )}
        </div>
    )
}
