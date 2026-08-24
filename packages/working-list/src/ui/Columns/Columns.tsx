import { Button } from '@dhis2/ui'
import { IconLayoutColumns16 } from '@dhis2/ui-icons'
import { Result } from 'better-result'
import React, { useState, type ComponentPropsWithoutRef } from 'react'
import type { TrackerProgram } from '../../api/schemas'
import type { WorkingListField } from '../../domain/model'
import {
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from '../../provider/WorkingListContext'
import { useWorkingListPrivateUi } from '../../provider/WorkingListPrivateContext'
import type { WorkingListConfiguration } from '../../provider/contracts'
import { ColumnSettingsDialog } from '../ColumnSettingsDialog'
import { useWorkingListText } from '../WorkingListText'

const tableFieldsFor = (
    fields: readonly WorkingListField[],
    program: TrackerProgram,
    configuration: WorkingListConfiguration
) => {
    const currentStage =
        configuration.mode === 'event'
            ? program.programStages.find(
                  (stage) => stage.id === configuration.programStageId
              )
            : undefined
    const stageDataElementIds = new Set(
        currentStage?.programStageDataElements.map(
            (binding) => binding.dataElement.id
        ) ?? []
    )
    return fields.filter((field) => {
        if (field.source === 'trackedEntityAttribute') {
            return true
        }
        if (field.source === 'eventDataElement') {
            return (
                configuration.mode === 'event' &&
                stageDataElementIds.has(field.id)
            )
        }
        if (['createdAt', 'programOwnerId'].includes(field.id)) {
            return true
        }
        return (
            configuration.mode === 'event' &&
            [
                'eventStatus',
                'eventOccurredAt',
                'eventScheduledAt',
                'eventOrgUnit',
                'eventAssignedUser',
            ].includes(field.id)
        )
    })
}

const ColumnsControl = () => {
    const translate = useWorkingListText()
    const configuration = useWorkingListState((state) => state.configuration)
    const program = useWorkingListMeta((meta) => meta.program)
    const fields = useWorkingListMeta((meta) => meta.fields)
    const actions = useWorkingListActions()
    const { mutationBusy } = useWorkingListPrivateUi()
    const [dialogOpen, setDialogOpen] = useState(false)

    if (!program) {
        throw new Error(
            'WorkingListColumnSelector requires resolved program metadata.'
        )
    }
    const tableFields = tableFieldsFor(fields, program, configuration)

    return (
        <div className="flex flex-none items-center">
            <Button
                secondary
                small
                icon={<IconLayoutColumns16 />}
                dataTest="configure-columns"
                disabled={mutationBusy}
                onClick={() => setDialogOpen(true)}
            >
                {translate('Columns')}
            </Button>
            {dialogOpen && (
                <ColumnSettingsDialog
                    fields={tableFields}
                    visibleColumnIds={configuration.columns}
                    disabled={mutationBusy}
                    onChange={(columns) => {
                        const result = actions.setColumns(columns)
                        if (Result.isError(result)) {
                            throw result.error
                        }
                    }}
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
    const translate = useWorkingListText()
    const ready = useWorkingListMeta(
        (meta) => meta.activeConfiguration.status === 'ready'
    )

    return (
        <div
            {...props}
            className={className}
            data-testid="working-list-columns"
        >
            {ready ? (
                <ColumnsControl />
            ) : (
                <Button
                    secondary
                    small
                    icon={<IconLayoutColumns16 />}
                    dataTest="configure-columns"
                    disabled
                >
                    {translate('Columns')}
                </Button>
            )}
        </div>
    )
}
