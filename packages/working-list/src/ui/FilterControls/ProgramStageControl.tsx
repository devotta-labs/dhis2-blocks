import {
    Button,
    SingleSelect,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import React, { useId, useMemo, useState } from 'react'
import type { TrackerProgram } from '../../api/schemas'
import { useWorkingListText } from '../WorkingListText'
import {
    FilterPopover,
    configureFilterCombobox,
    focusFirstControl,
    useEscapeToClose,
} from './FilterControlPrimitives'
import styles from './FilterControls.module.css'

interface ProgramStageControlProps {
    program: TrackerProgram
    selectedStageId?: string
    defaultOpen?: boolean
    disabled?: boolean
    onChange: (stageId?: string) => void
    onRemove: () => void
}

export const ProgramStageControl = ({
    program,
    selectedStageId,
    defaultOpen,
    disabled = false,
    onChange,
    onRemove,
}: ProgramStageControlProps) => {
    const i18n = { t: useWorkingListText() }
    const editorId = useId()
    const [buttonElement, setButtonElement] = useState<HTMLDivElement | null>(
        null
    )
    const [open, setOpen] = useState(defaultOpen ?? false)
    const [draft, setDraft] = useState(selectedStageId ?? '')
    const stages = useMemo(
        () =>
            program.programStages.filter(
                (stage) => stage.access?.read !== false
            ),
        [program.programStages]
    )
    const selectedName = stages.find(
        (stage) => stage.id === selectedStageId
    )?.displayName

    const setEditorOpen = (nextOpen: boolean) => {
        configureFilterCombobox(
            buttonElement,
            '[data-test="filter-programStage-select"] [tabindex]',
            nextOpen,
            editorId,
            i18n.t('Program stage'),
            '[data-test="filter-programStage-select-clear"]',
            i18n.t('Clear {{filter}} filter', {
                filter: i18n.t('Program stage'),
            })
        )
        setOpen(nextOpen)
    }
    const close = () => {
        setEditorOpen(false)
        requestAnimationFrame(() =>
            buttonElement
                ?.querySelector<HTMLElement>(
                    '[data-test="filter-programStage-select"] [tabindex]'
                )
                ?.focus()
        )
    }
    useEscapeToClose(open, close)

    return (
        <div
            ref={(element) => {
                if (element && element !== buttonElement) {
                    setButtonElement(element)
                    configureFilterCombobox(
                        element,
                        '[data-test="filter-programStage-select"] [tabindex]',
                        open,
                        editorId,
                        i18n.t('Program stage'),
                        '[data-test="filter-programStage-select-clear"]',
                        i18n.t('Clear {{filter}} filter', {
                            filter: i18n.t('Program stage'),
                        })
                    )
                }
            }}
            className={styles['filter-control']}
            data-testid="filter-programStage"
            onMouseDownCapture={(event) => {
                if (disabled) {
                    return
                }
                const target =
                    event.target instanceof Element ? event.target : null
                if (
                    !target?.closest(
                        '[data-test="filter-programStage-select-clear"]'
                    )
                ) {
                    return
                }
                event.preventDefault()
                event.stopPropagation()
                onRemove()
            }}
            onClickCapture={(event) => {
                if (disabled) {
                    return
                }
                const target =
                    event.target instanceof Element ? event.target : null
                const select = target?.closest(
                    '[data-test="filter-programStage-select"]'
                )
                if (!select && target !== event.currentTarget) {
                    return
                }
                if (
                    target?.closest(
                        '[data-test="filter-programStage-select-clear"]'
                    )
                ) {
                    return
                }
                event.preventDefault()
                event.stopPropagation()
                setDraft(selectedStageId ?? '')
                setEditorOpen(!open)
            }}
            onKeyDownCapture={(event) => {
                if (disabled) {
                    return
                }
                const target =
                    event.target instanceof Element ? event.target : null
                if (
                    ['Enter', ' ', 'ArrowDown'].includes(event.key) &&
                    target?.closest(
                        '[data-test="filter-programStage-select"] [tabindex]'
                    )
                ) {
                    event.preventDefault()
                    event.stopPropagation()
                    setDraft(selectedStageId ?? '')
                    setEditorOpen(true)
                }
            }}
        >
            <SingleSelect
                dense
                clearable
                clearText={i18n.t('Clear filter')}
                dataTest="filter-programStage-select"
                disabled={disabled}
                prefix={i18n.t('{{filterName}}{{escape}}', {
                    filterName: i18n.t('Program stage'),
                    escape: ':',
                })}
                selected={selectedName ? 'current-stage' : undefined}
                onChange={({ selected }) => {
                    if (!selected) {
                        onRemove()
                    }
                }}
            >
                {selectedName && (
                    <SingleSelectOption
                        value="current-stage"
                        label={selectedName}
                    />
                )}
            </SingleSelect>
            {open && !disabled && buttonElement && (
                <FilterPopover
                    arrow={false}
                    maxWidth={400}
                    placement="bottom-start"
                    reference={buttonElement}
                    onClickOutside={close}
                >
                    <div className={styles['filter-popover-sheet']}>
                        <form
                            ref={focusFirstControl}
                            id={editorId}
                            className={styles['filter-editor']}
                            data-testid="filter-editor-programStage"
                            role="dialog"
                            aria-label={i18n.t('Program stage')}
                            onSubmit={(event) => {
                                event.preventDefault()
                                if (!draft) {
                                    return
                                }
                                onChange(draft)
                                close()
                            }}
                        >
                            <h3>{i18n.t('Program stage')}</h3>
                            <SingleSelectField
                                dense
                                dataTest="filter-value-programStage"
                                label={i18n.t('Stage')}
                                selected={draft}
                                onChange={({ selected }) => setDraft(selected)}
                            >
                                {stages.map((stage) => (
                                    <SingleSelectOption
                                        key={stage.id}
                                        value={stage.id}
                                        label={stage.displayName}
                                    />
                                ))}
                            </SingleSelectField>
                            <div className={styles['filter-editor__actions']}>
                                <Button
                                    primary
                                    small
                                    type="submit"
                                    dataTest="filter-update-programStage"
                                    disabled={!draft}
                                >
                                    {i18n.t('Update')}
                                </Button>
                                <Button
                                    small
                                    type="button"
                                    dataTest="filter-reset-programStage"
                                    onClick={() => {
                                        onChange(undefined)
                                        close()
                                    }}
                                >
                                    {i18n.t('Reset filter')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </FilterPopover>
            )}
        </div>
    )
}
