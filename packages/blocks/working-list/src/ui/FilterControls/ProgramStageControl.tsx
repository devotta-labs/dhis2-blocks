import { Button } from '../primitives/button'
import React, { useMemo, useState } from 'react'
import type { TrackerProgram } from '../../api/schemas'
import { useWorkingListText } from '../WorkingListText'
import { PopoverTitle } from '../primitives/popover'
import { FilterChip } from './FilterControlPrimitives'
import { SelectField } from './FilterSelectFields'

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

    return (
        <FilterChip
            dataTest="filter-programStage"
            testId="filter-programStage"
            prefix={i18n.t('{{filterName}}{{escape}}', {
                filterName: i18n.t('Program stage'),
                escape: ':',
            })}
            value={selectedName ?? ''}
            clearLabel={i18n.t('Clear {{filter}} filter', {
                filter: i18n.t('Program stage'),
            })}
            disabled={disabled}
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setDraft(selectedStageId ?? '')
                }
                setOpen(nextOpen)
            }}
            onClear={onRemove}
        >
            <div className="box-border w-[min(400px,calc(100vw_-_16px))] min-w-0 max-w-[calc(100vw_-_16px)] [contain:layout]">
                <form
                    className="box-border w-[min(380px,calc(100vw_-_32px))] min-w-0 max-w-[calc(100vw_-_32px)] p-[16px] [&>*+*]:mt-[12px] [&>*]:box-border [&>*]:min-w-0 [&>*]:max-w-full [&_[data-test]]:box-border [&_[data-test]]:min-w-0 [&_[data-test]]:max-w-full [&_[data-testid^=filter-value-]]:box-border [&_[data-testid^=filter-value-]]:min-w-0 [&_[data-testid^=filter-value-]]:max-w-full [&_:is(input,select,textarea)]:box-border [&_:is(input,select,textarea)]:min-w-0 [&_:is(input,select,textarea)]:max-w-full [&_h3]:[margin:0_0_12px]! [&_h3]:text-[#17212b] [&_h3]:[font-size:16px]! [&_h3]:[font-weight:500]!"
                    data-testid="filter-editor-programStage"
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (!draft) {
                            return
                        }
                        onChange(draft)
                        setOpen(false)
                    }}
                >
                    <PopoverTitle render={<h3 />}>
                        {i18n.t('Program stage')}
                    </PopoverTitle>
                    <SelectField
                        dataTest="filter-value-programStage"
                        label={i18n.t('Stage')}
                        value={draft || undefined}
                        options={stages.map((stage) => ({
                            value: stage.id,
                            label: stage.displayName,
                        }))}
                        onChange={setDraft}
                    />
                    <div className="flex flex-wrap gap-[8px] pt-[12px] [border-top:1px_solid_#e8edf2]">
                        <Button
                            size="sm"
                            type="submit"
                            data-test="filter-update-programStage"
                            disabled={!draft}
                        >
                            {i18n.t('Update')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            data-test="filter-reset-programStage"
                            onClick={() => {
                                onChange(undefined)
                                setOpen(false)
                            }}
                        >
                            {i18n.t('Reset filter')}
                        </Button>
                    </div>
                </form>
            </div>
        </FilterChip>
    )
}
