import i18n from '@dhis2/d2-i18n'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { DropdownMenuTriggerArrow } from '@/components/dhis2/ui/dropdown-menu'
import { IconMore16 } from '@dhis2/ui-icons'
import { useOnlineStatus } from '@dhis2/app-runtime'
import React, { useState, type ComponentPropsWithoutRef } from 'react'
import { fieldsForConfiguration } from '../../api/metadata'
import type {
    CreateViewError,
    UpdateSelectedViewError,
} from '../../provider/errors'
import {
    useCreateSavedList,
    useIsSavingList,
    useUpdateSavedList,
} from '../../provider/mutations'
import {
    toWorkingListView,
    useWorkingListMetadata,
    useWorkingListRecords,
    useWorkingListView,
    type WorkingListMetadata,
    type WorkingListSelectedView,
} from '../../provider/queries'
import { downloadRowsAsCsv } from '../../provider/results'
import { ConfigureMenu } from '../ConfigureMenu'

type SaveError = CreateViewError | UpdateSelectedViewError

type ActionCopy = () => string

const actionCopy = {
    controls: {
        saveView: () => i18n.t('Save view'),
        more: () => i18n.t('More'),
    },
    noticeTitles: {
        save: () => i18n.t('Could not save the working list'),
        download: () => i18n.t('Could not download data'),
    },
    saveErrors: {
        OfflineMutationError: () =>
            i18n.t('This action is unavailable while offline.'),
        WorkingListNetworkError: () =>
            i18n.t(
                'A network error stopped the request. Check the connection and try again.'
            ),
        WorkingListInvalidResponseError: () =>
            i18n.t('The server returned an unexpected response.'),
        SavedListPermissionError: () =>
            i18n.t('You do not have permission to make this change.'),
        NoSelectedSavedListError: () =>
            i18n.t('Select a saved working list before updating it.'),
        InvalidConfigurationError: () =>
            i18n.t('The current working list configuration cannot be saved.'),
    },
    resultsNotLoaded: () =>
        i18n.t(
            'The results are still loading. Try the download again once they have loaded.'
        ),
} satisfies {
    controls: Record<'saveView' | 'more', ActionCopy>
    noticeTitles: Record<'save' | 'download', ActionCopy>
    saveErrors: Record<SaveError['_tag'], ActionCopy>
    resultsNotLoaded: ActionCopy
}

const saveErrorCopy = (error: SaveError) => actionCopy.saveErrors[error._tag]()

const ActionsControl = ({
    metadata,
    view,
}: {
    metadata: WorkingListMetadata
    view: WorkingListSelectedView
}) => {
    const { online } = useOnlineStatus()
    const records = useWorkingListRecords()
    const busy = useIsSavingList()
    const create = useCreateSavedList()
    const update = useUpdateSavedList()
    const [downloadError, setDownloadError] = useState<string>()

    // The dialog stays open on a failed save and shows the reason itself.
    const saveAs = (name: string) => {
        update.reset()
        return create.mutateAsync(name).then(
            () => undefined,
            (error: CreateViewError) => saveErrorCopy(error)
        )
    }
    const download = () => {
        if (!records.data) {
            setDownloadError(actionCopy.resultsNotLoaded())
            return
        }
        setDownloadError(undefined)
        downloadRowsAsCsv({
            rows: records.data.rows,
            columns: view.configuration.columns,
            fields: fieldsForConfiguration(
                metadata.fieldCatalog,
                view.resolvedConfiguration
            ),
            formattingContext: records.data.formattingContext,
            fileName: `${metadata.program.displayName}-working-list.csv`,
        })
    }

    return (
        <div className="flex items-start gap-2">
            <ConfigureMenu
                selectedView={toWorkingListView(view.list, view.isGenerated)}
                dirty={view.isDirty}
                online={online}
                busy={busy}
                createPending={create.isPending}
                onDownload={download}
                onSaveAs={saveAs}
                onUpdate={() => update.mutate()}
            />
            {update.error && (
                <div data-testid="working-list-save-error">
                    <ErrorAlert title={actionCopy.noticeTitles.save()}>
                        {saveErrorCopy(update.error)}
                    </ErrorAlert>
                </div>
            )}
            {downloadError && (
                <div data-testid="working-list-download-error">
                    <ErrorAlert title={actionCopy.noticeTitles.download()}>
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
    const metadata = useWorkingListMetadata().data
    const view = useWorkingListView().data

    return (
        <div
            {...props}
            className={`ml-auto flex flex-none items-center${className ? ` ${className}` : ''}`}
            data-testid="working-list-actions-slot"
        >
            {metadata && view ? (
                <ActionsControl metadata={metadata} view={view} />
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
                        {actionCopy.controls.saveView()}
                    </Button>
                    <Button
                        variant="secondary"
                        size="field-dense"
                        data-test="working-list-options"
                        disabled
                    >
                        <IconMore16 />
                        {actionCopy.controls.more()}
                        <DropdownMenuTriggerArrow />
                    </Button>
                </div>
            )}
        </div>
    )
}
