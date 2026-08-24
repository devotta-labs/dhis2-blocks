import { Button, Menu, MenuDivider, MenuItem, Tooltip } from '@dhis2/ui'
import { IconFilter16 } from '@dhis2/ui-icons'
import React, { useMemo, useState } from 'react'
import type { TrackerProgram } from '../../api/schemas'
import type { WorkingListField } from '../../domain/model'
import { useWorkingListText } from '../WorkingListText'
import {
    FilterPopover,
    focusFirstAvailableFilter,
    useEscapeToClose,
} from './FilterControlPrimitives'
import styles from './FilterControls.module.css'
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
    const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(
        null
    )
    const [open, setOpen] = useState(false)
    const [openSubMenu, setOpenSubMenu] = useState<
        'program-stages' | 'stage-fields' | null
    >(null)
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

    const close = () => {
        setOpen(false)
        setOpenSubMenu(null)
        requestAnimationFrame(() =>
            buttonElement?.querySelector<HTMLButtonElement>('button')?.focus()
        )
    }
    useEscapeToClose(open, close)
    if (!available.length && !stages.length && !availableStageFields.length) {
        return null
    }

    return (
        <div ref={setButtonElement} className={styles['more-filters-menu']}>
            <Button
                secondary
                small
                icon={<IconFilter16 />}
                dataTest={`more-filters-${scope}`}
                data-testid={`more-filters-${scope}`}
                disabled={disabled}
                aria-expanded={open && !disabled}
                aria-haspopup="menu"
                onClick={() => {
                    if (!disabled) {
                        setOpen((value) => !value)
                    }
                }}
            >
                {i18n.t('Filter')}
            </Button>
            {open && !disabled && buttonElement && (
                <FilterPopover
                    arrow={false}
                    maxWidth={400}
                    placement="bottom-start"
                    reference={buttonElement}
                    onClickOutside={close}
                >
                    <div
                        ref={focusFirstAvailableFilter}
                        className={styles['menu-popover-sheet']}
                        style={{
                            maxHeight: `max(160px, calc(100vh - ${
                                Math.ceil(
                                    buttonElement.getBoundingClientRect().bottom
                                ) + 16
                            }px))`,
                        }}
                        onMouseOver={(event) => {
                            const target = event.target
                            if (!(target instanceof Element)) {
                                return
                            }
                            if (
                                target.closest(
                                    '[data-test="program-stage-filter-menu"]'
                                )
                            ) {
                                setOpenSubMenu('program-stages')
                            } else if (
                                menuStage &&
                                target.closest(
                                    `[data-test="stage-filter-fields-${menuStage.id}"]`
                                )
                            ) {
                                setOpenSubMenu('stage-fields')
                            } else if (
                                target.closest('[data-test^="add-filter-"]')
                            ) {
                                setOpenSubMenu(null)
                            }
                        }}
                    >
                        <Menu dense dataTest={`more-filters-menu-${scope}`}>
                            {stages.length > 0 && (
                                <MenuItem
                                    dataTest="program-stage-filter-menu"
                                    label={i18n.t('Program stage')}
                                    showSubMenu={
                                        openSubMenu === 'program-stages'
                                    }
                                    toggleSubMenu={() =>
                                        setOpenSubMenu('program-stages')
                                    }
                                >
                                    {stages.map((stage) => {
                                        const disabled =
                                            Boolean(selectedStageId)
                                        const lockMessage = i18n.t(
                                            'Can only filter using one program stage.'
                                        )
                                        const label = disabled ? (
                                            <Tooltip
                                                dataTest={`stage-lock-tooltip-${stage.id}`}
                                                content={lockMessage}
                                                openDelay={200}
                                            >
                                                {({ ref, ...tooltipProps }) => (
                                                    <span
                                                        ref={(element) => {
                                                            if (element) {
                                                                ref.current =
                                                                    element
                                                            }
                                                        }}
                                                        className={
                                                            styles[
                                                                'stage-lock-tooltip-target'
                                                            ]
                                                        }
                                                        tabIndex={0}
                                                        aria-label={`${stage.displayName}. ${lockMessage}`}
                                                        {...tooltipProps}
                                                    >
                                                        {stage.displayName}
                                                    </span>
                                                )}
                                            </Tooltip>
                                        ) : (
                                            stage.displayName
                                        )
                                        return (
                                            <MenuItem
                                                key={stage.id}
                                                dataTest={`select-filter-stage-${stage.id}`}
                                                disabled={disabled}
                                                active={
                                                    stage.id === selectedStageId
                                                }
                                                label={label}
                                                {...(disabled
                                                    ? {
                                                          ariaLabel:
                                                              stage.displayName,
                                                      }
                                                    : {})}
                                                onClick={() => {
                                                    if (!disabled) {
                                                        onSelectStage?.(
                                                            stage.id
                                                        )
                                                        close()
                                                    }
                                                }}
                                            />
                                        )
                                    })}
                                </MenuItem>
                            )}
                            {menuStage && availableStageFields.length > 0 && (
                                <MenuItem
                                    dataTest={`stage-filter-fields-${menuStage.id}`}
                                    label={menuStage.displayName}
                                    showSubMenu={openSubMenu === 'stage-fields'}
                                    toggleSubMenu={() =>
                                        setOpenSubMenu('stage-fields')
                                    }
                                >
                                    {availableStageFields.map((field) => (
                                        <MenuItem
                                            key={field.id}
                                            dataTest={`add-stage-filter-${menuStage.id}-${field.id}`}
                                            label={fieldDisplayName(
                                                field,
                                                translate
                                            )}
                                            onClick={() => {
                                                onAddStageFilter?.(
                                                    menuStage.id,
                                                    field.id
                                                )
                                                close()
                                            }}
                                        />
                                    ))}
                                </MenuItem>
                            )}
                            {stages.length > 0 && available.length > 0 && (
                                <MenuDivider dataTest="filter-scope-divider" />
                            )}
                            {available.map((field) => (
                                <MenuItem
                                    key={field.id}
                                    dataTest={`add-filter-${field.id}`}
                                    label={fieldDisplayName(field, translate)}
                                    onClick={() => {
                                        onAdd(field.id)
                                        close()
                                    }}
                                />
                            ))}
                        </Menu>
                    </div>
                </FilterPopover>
            )}
        </div>
    )
}
