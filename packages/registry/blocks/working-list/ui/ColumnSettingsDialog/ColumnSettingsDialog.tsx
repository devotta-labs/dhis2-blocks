import { Button } from '@/components/dhis2/ui/button'
import { Transfer } from '@dhis2/ui'
import React, { useMemo, useState } from 'react'
import type { WorkingListField } from '../../domain/model'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dhis2/ui/dialog'
import { fieldDisplayName } from '../FilterControls'
import { useWorkingListText } from '../WorkingListText'

interface ColumnSettingsDialogProps {
    fields: WorkingListField[]
    visibleColumnIds: string[]
    disabled?: boolean
    onChange: (columnIds: string[]) => void
    onClose: () => void
}

export const ColumnSettingsDialog = ({
    fields,
    visibleColumnIds,
    disabled = false,
    onChange,
    onClose,
}: ColumnSettingsDialogProps) => {
    const translate = useWorkingListText()
    const fieldIds = useMemo(
        () => new Set(fields.map((field) => field.id)),
        [fields]
    )
    const [draftSelected, setDraftSelected] = useState(() =>
        visibleColumnIds.filter((id) => fieldIds.has(id))
    )
    const [showValidationError, setShowValidationError] = useState(false)
    const options = useMemo(
        () =>
            fields.map((field) => ({
                value: field.id,
                label: fieldDisplayName(field, translate),
            })),
        [fields, translate]
    )

    const handleChange = ({
        selected: nextSelected,
    }: {
        selected: string[]
    }) => {
        const validSelected = nextSelected.filter((id) => fieldIds.has(id))
        setDraftSelected(validSelected)
        if (validSelected.length > 0) {
            setShowValidationError(false)
        }
    }

    const save = () => {
        if (draftSelected.length === 0) {
            setShowValidationError(true)
            return
        }
        onChange(draftSelected)
        onClose()
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose()
                }
            }}
        >
            <DialogContent
                size="fluid"
                position="middle"
                closeLabel={translate('Close')}
            >
                <DialogHeader>
                    <DialogTitle>
                        {translate('Configure table columns')}
                    </DialogTitle>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div data-testid="column-settings">
                        <Transfer
                            dataTest="column-settings-transfer"
                            options={options}
                            selected={draftSelected}
                            disabled={disabled}
                            filterable
                            enableOrderChange
                            height="448px"
                            optionsWidth="440px"
                            selectedWidth="440px"
                            leftHeader={
                                <h4 className="m-0 px-0 py-2.5 text-sm font-medium leading-5 text-[#405261]">
                                    {translate('Available columns')}
                                </h4>
                            }
                            rightHeader={
                                <h4 className="m-0 px-0 py-2.5 text-sm font-medium leading-5 text-[#405261]">
                                    {translate('Selected columns')}
                                </h4>
                            }
                            filterPlaceholder={translate('Filter')}
                            onChange={handleChange}
                        />
                        {showValidationError && (
                            <p
                                className="text-sm leading-5 text-[var(--colors-red600)] [margin:12px_0_0]"
                                role="alert"
                            >
                                {translate(
                                    'Select at least one visible column'
                                )}
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        data-test="column-settings-cancel"
                        onClick={onClose}
                    >
                        {translate('Cancel')}
                    </Button>
                    <Button
                        data-test="column-settings-done"
                        disabled={disabled}
                        onClick={save}
                    >
                        {translate('Save column configuration')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
