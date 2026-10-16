import { Button } from '../primitives/button'
import { IconFilter16 } from '@dhis2/ui-icons'
import React, { useEffect, useId, useMemo, useState } from 'react'
import type { TrackerProgram } from '../../api/schemas'
import type { WorkingListField } from '../../domain/model'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '../primitives/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../primitives/tooltip'
import { useWorkingListText } from '../WorkingListText'
import { focusFirstAvailableFilter } from './FilterControlPrimitives'
import { fieldDisplayName } from './filterValueSupport'

interface MoreFiltersProps {
    fields: WorkingListField[]
    visibleFilterIds: string[]
    scope: 'tracked-entity' | 'event'
    program?: TrackerProgram
    selectedStageId?: string
    eventFields?: WorkingListField[]
    disabled?: boolean
    onAdd: (fieldId: string) => void
    onSelectStage?: (stageId: string) => void
    onAddStageFilter?: (stageId: string, fieldId: string) => void
}

export const MoreFilters = ({
    fields,
    visibleFilterIds,
    scope,
    program,
    selectedStageId,
    eventFields = [],
    disabled = false,
    onAdd,
    onSelectStage,
    onAddStageFilter,
}: MoreFiltersProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    const lockMessageId = useId()
    const [open, setOpen] = useState(false)
    // Disabling closes the menu for good, so it doesn't reappear by itself
    // once the button is enabled again.
    useEffect(() => {
        if (disabled) {
            setOpen(false)
        }
    }, [disabled])
    const available = fields.filter(
        (field) => field.filterable && !visibleFilterIds.includes(field.id)
    )
    const stages = useMemo(
        () =>
            program?.programStages.filter(
                (stage) => stage.access?.read !== false
            ) ?? [],
        [program]
    )
    const menuStage = stages.find((stage) => stage.id === selectedStageId)
    const availableStageFields = eventFields.filter(
        (field) =>
            field.filterable &&
            !visibleFilterIds.includes(field.id) &&
            (field.source !== 'eventDataElement' ||
                menuStage?.programStageDataElements.some(
                    (binding) => binding.dataElement.id === field.id
                ))
    )

    if (!available.length && !stages.length && !availableStageFields.length) {
        return null
    }
    const lockMessage = i18n.t('Can only filter using one program stage.')

    return (
        <div className="relative min-w-0 max-w-full">
            <DropdownMenu open={open && !disabled} onOpenChange={setOpen}>
                <DropdownMenuTrigger
                    disabled={disabled}
                    render={
                        <Button
                            variant="secondary"
                            size="field-dense"
                            data-test={`more-filters-${scope}`}
                            data-testid={`more-filters-${scope}`}
                        />
                    }
                >
                    <IconFilter16 />
                    {i18n.t('Filter')}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    data-test={`more-filters-menu-${scope}`}
                    className="max-w-[400px] overscroll-contain"
                >
                    {stages.length > 0 && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger data-test="program-stage-filter-menu">
                                {i18n.t('Program stage')}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {stages.map((stage) => {
                                    const selected =
                                        stage.id === selectedStageId
                                    // Only one stage can be filtered on at a
                                    // time, so every stage locks once one is.
                                    if (!selectedStageId) {
                                        return (
                                            <DropdownMenuItem
                                                key={stage.id}
                                                data-test={`select-filter-stage-${stage.id}`}
                                                onClick={() =>
                                                    onSelectStage?.(stage.id)
                                                }
                                            >
                                                {stage.displayName}
                                            </DropdownMenuItem>
                                        )
                                    }
                                    return (
                                        <Tooltip key={stage.id}>
                                            <TooltipTrigger
                                                delay={200}
                                                render={
                                                    <DropdownMenuItem
                                                        data-test={`select-filter-stage-${stage.id}`}
                                                        className={
                                                            selected
                                                                ? 'bg-grey-300 data-highlighted:bg-grey-300'
                                                                : undefined
                                                        }
                                                        disabled
                                                        aria-describedby={`${lockMessageId}-${stage.id}`}
                                                    />
                                                }
                                            >
                                                {stage.displayName}
                                                <span
                                                    id={`${lockMessageId}-${stage.id}`}
                                                    hidden
                                                >
                                                    {lockMessage}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                data-test={`stage-lock-tooltip-${stage.id}-content`}
                                            >
                                                {lockMessage}
                                            </TooltipContent>
                                        </Tooltip>
                                    )
                                })}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}
                    {menuStage && availableStageFields.length > 0 && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger
                                data-test={`stage-filter-fields-${menuStage.id}`}
                            >
                                {menuStage.displayName}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {availableStageFields.map((field) => (
                                    <DropdownMenuItem
                                        key={field.id}
                                        data-test={`add-stage-filter-${menuStage.id}-${field.id}`}
                                        onClick={() =>
                                            onAddStageFilter?.(
                                                menuStage.id,
                                                field.id
                                            )
                                        }
                                    >
                                        {fieldDisplayName(field, translate)}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}
                    {stages.length > 0 && available.length > 0 && (
                        <DropdownMenuSeparator data-test="filter-scope-divider" />
                    )}
                    {available.map((field, index) => (
                        <DropdownMenuItem
                            key={field.id}
                            ref={
                                index === 0
                                    ? focusFirstAvailableFilter
                                    : undefined
                            }
                            data-test={`add-filter-${field.id}`}
                            onClick={() => onAdd(field.id)}
                        >
                            {fieldDisplayName(field, translate)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
