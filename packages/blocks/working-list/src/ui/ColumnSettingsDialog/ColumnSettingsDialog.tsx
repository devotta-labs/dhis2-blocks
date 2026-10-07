import {
    Button,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    Transfer,
} from '@dhis2/ui'
import React, { useMemo, useState } from 'react'
import type { WorkingListField } from '../../domain/model'
import { fieldDisplayName } from '../FilterControls'
import { useWorkingListText } from '../WorkingListText'

interface ColumnSettingsDialogProps {
    fields: WorkingListField[]
    visibleColumnIds: string[]
    disabled?: boolean
    onChange: (columnIds: string[]) => void
    onClose: () => void
}

/**
 * Keeps metadata order for hidden fields while applying the saved ordering to
 * the visible slots. Retained for consumers that use the ordering helpers.
 */
export const getInitialColumnDialogOrder = (
    fields: WorkingListField[],
    visibleColumnIds: string[]
) => {
    const fieldsById = new Map(fields.map((field) => [field.id, field]))

    const visibleFields = visibleColumnIds.flatMap((id) => {
        const field = fieldsById.get(id)

        return field ? [field] : []
    })

    const visibleIds = new Set(visibleFields.map((field) => field.id))
    let nextVisibleIndex = 0

    return fields.map((field) =>
        visibleIds.has(field.id)
            ? (visibleFields[nextVisibleIndex++] ?? field)
            : field
    )
}

export const getVisibleColumnIdsInOrder = (
    orderedFields: WorkingListField[],
    visibleColumnIds: string[]
) => {
    const visibleIds = new Set(visibleColumnIds)

    return orderedFields.flatMap((field) =>
        visibleIds.has(field.id) ? [field.id] : []
    )
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
        <Modal fluid position="middle" onClose={onClose}>
            <ModalTitle>{translate('Configure table columns')}</ModalTitle>
            <ModalContent>
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
                            {translate('Select at least one visible column')}
                        </p>
                    )}
                </div>
            </ModalContent>
            <ModalActions>
                <div className="flex gap-2">
                    <Button dataTest="column-settings-cancel" onClick={onClose}>
                        {translate('Cancel')}
                    </Button>
                    <Button
                        primary
                        dataTest="column-settings-done"
                        disabled={disabled}
                        onClick={save}
                    >
                        {translate('Save column configuration')}
                    </Button>
                </div>
            </ModalActions>
        </Modal>
    )
}
