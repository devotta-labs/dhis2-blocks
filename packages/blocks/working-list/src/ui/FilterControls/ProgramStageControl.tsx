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
            className="relative min-w-0 max-w-full [&_[data-test$=-select-clear]]:[margin-inline-start:4px] [&_[data-test=dhis2-uicore-select-input]>:last-child]:[margin-block-start:0]"
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
                    <div className="box-border w-[min(400px,calc(100vw_-_16px))] min-w-0 max-w-[calc(100vw_-_16px)] [contain:layout]">
                        <form
                            ref={focusFirstControl}
                            id={editorId}
                            className="box-border w-[min(380px,calc(100vw_-_32px))] min-w-0 max-w-[calc(100vw_-_32px)] p-[16px] [&>*+*]:mt-[12px] [&>*]:box-border [&>*]:min-w-0 [&>*]:max-w-full [&_[data-test]]:box-border [&_[data-test]]:min-w-0 [&_[data-test]]:max-w-full [&_[data-testid^=filter-value-]]:box-border [&_[data-testid^=filter-value-]]:min-w-0 [&_[data-testid^=filter-value-]]:max-w-full [&_:is(input,select,textarea)]:box-border [&_:is(input,select,textarea)]:min-w-0 [&_:is(input,select,textarea)]:max-w-full [&_h3]:[margin:0_0_12px]! [&_h3]:text-[#17212b] [&_h3]:[font-size:16px]! [&_h3]:[font-weight:500]!"
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
                            <div className="flex flex-wrap gap-[8px] pt-[12px] [border-top:1px_solid_#e8edf2]">
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
