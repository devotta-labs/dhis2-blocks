import i18n from '@dhis2/d2-i18n'
import { IconLayoutColumns16 } from '@dhis2/ui-icons'
import React, { useState, type ComponentPropsWithoutRef } from 'react'
import { fieldsForConfiguration } from '../../api/metadata'
import { useIsSavingList } from '../../provider/mutations'
import {
    useWorkingListMetadata,
    useWorkingListView,
    type WorkingListMetadata,
    type WorkingListSelectedView,
} from '../../provider/queries'
import { useWorkingList } from '../../provider/WorkingListContext'
import { ColumnSettingsDialog } from '../ColumnSettingsDialog'
import { tableFieldsFor } from '../tableFields'
import { Button } from '@/components/dhis2/ui/button'

const ColumnsControl = ({
    metadata,
    view: { configuration },
}: {
    metadata: WorkingListMetadata
    view: WorkingListSelectedView
}) => {
    const { setDraft } = useWorkingList()
    const saving = useIsSavingList()
    const [dialogOpen, setDialogOpen] = useState(false)

    const fields = [
        ...fieldsForConfiguration(
            metadata.fieldCatalog,
            configuration
        ).values(),
    ]
    const tableFields = tableFieldsFor(fields, metadata.program, configuration)

    return (
        <div className="flex flex-none items-center">
            <Button
                variant="secondary"
                size="field-dense"
                data-test="configure-columns"
                disabled={saving}
                onClick={() => setDialogOpen(true)}
            >
                <IconLayoutColumns16 />
                {i18n.t('Columns')}
            </Button>
            {dialogOpen && (
                <ColumnSettingsDialog
                    fields={tableFields}
                    visibleColumnIds={configuration.columns}
                    disabled={saving}
                    onChange={(columns) =>
                        setDraft({ ...configuration, columns })
                    }
                    onClose={() => setDialogOpen(false)}
                />
            )}
        </div>
    )
}

export interface WorkingListColumnSelectorProps extends Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
> {}

export const WorkingListColumnSelector = ({
    className,
    ...props
}: WorkingListColumnSelectorProps) => {
    const metadata = useWorkingListMetadata().data
    const view = useWorkingListView().data

    return (
        <div
            {...props}
            className={className}
            data-testid="working-list-columns"
        >
            {metadata && view ? (
                <ColumnsControl metadata={metadata} view={view} />
            ) : (
                <div className="flex flex-none items-center">
                    <Button
                        variant="secondary"
                        size="field-dense"
                        data-test="configure-columns"
                        disabled
                    >
                        <IconLayoutColumns16 />
                        {i18n.t('Columns')}
                    </Button>
                </div>
            )}
        </div>
    )
}
