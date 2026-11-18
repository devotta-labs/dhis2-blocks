import i18n from '@dhis2/d2-i18n'
import { IconChevronDown16 } from '@dhis2/ui-icons'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Popover,
    PopoverContent,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'
import {
    SelectClearIcon,
    selectTriggerVariants,
} from '@/components/dhis2/ui/select'
import { useRef, useState, type ReactNode } from 'react'
import {
    BooleanFilterControl,
    OptionsFilterControl,
} from './controls/ChoiceFilterControls'
import {
    booleanDraft,
    dateDraft,
    numberDraft,
    optionsDraft,
    readBooleanDraft,
    readDateDraft,
    readNumberDraft,
    readOptionsDraft,
    readTextDraft,
    textDraft,
    type DraftResult,
} from './controls/drafts'
import {
    DateFilterControl,
    NumberFilterControl,
} from './controls/RangeFilterControls'
import { TextFilterControl } from './controls/TextFilterControl'
import { summarizeDataTableFilter } from './summarize'
import type { DataTableFilter, DataTableFilterValue } from './types'

// Labels are shown as they are; React escapes them.
const raw = { interpolation: { escapeValue: false } } as const

type ApplyFilter = (value: DataTableFilterValue | undefined) => void

interface DraftFormProps<TDraft> {
    initial: TDraft
    read: (draft: TDraft) => DraftResult
    control: (
        draft: TDraft,
        onDraftChange: (draft: TDraft) => void
    ) => ReactNode
    onApply: ApplyFilter
}

/** A built-in control's draft: nothing reaches the table until Apply or Enter. */
const DraftForm = <TDraft,>({
    initial,
    read,
    control,
    onApply,
}: DraftFormProps<TDraft>) => {
    const [draft, setDraft] = useState(initial)
    const [error, setError] = useState<string>()
    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault()
                const result = read(draft)
                if (result.ok) {
                    onApply(result.value)
                } else {
                    setError(result.error)
                }
            }}
        >
            {control(draft, (next) => {
                setDraft(next)
                setError(undefined)
            })}
            {error !== undefined && (
                <p role="alert" className="m-0 text-sm text-dhis2-destructive">
                    {error}
                </p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-dhis2-border pt-3">
                <Button
                    type="submit"
                    size="sm"
                    data-slot="data-table-filter-apply"
                >
                    {i18n.t('Apply')}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    data-slot="data-table-filter-reset"
                    onClick={() => onApply(undefined)}
                >
                    {i18n.t('Reset')}
                </Button>
            </div>
        </form>
    )
}

const FilterEditor = ({
    filter,
    value,
    onApply,
}: {
    filter: DataTableFilter
    value: DataTableFilterValue | undefined
    onApply: ApplyFilter
}) => {
    switch (filter.kind) {
        case 'text':
            return (
                <DraftForm
                    initial={textDraft(filter, value)}
                    read={readTextDraft}
                    onApply={onApply}
                    control={(draft, onDraftChange) => (
                        <TextFilterControl
                            filter={filter}
                            draft={draft}
                            onDraftChange={onDraftChange}
                        />
                    )}
                />
            )
        case 'number':
            return (
                <DraftForm
                    initial={numberDraft(value)}
                    read={readNumberDraft}
                    onApply={onApply}
                    control={(draft, onDraftChange) => (
                        <NumberFilterControl
                            filter={filter}
                            draft={draft}
                            onDraftChange={onDraftChange}
                        />
                    )}
                />
            )
        case 'date':
            return (
                <DraftForm
                    initial={dateDraft(value)}
                    read={readDateDraft}
                    onApply={onApply}
                    control={(draft, onDraftChange) => (
                        <DateFilterControl
                            filter={filter}
                            draft={draft}
                            onDraftChange={onDraftChange}
                        />
                    )}
                />
            )
        case 'options':
            return (
                <DraftForm
                    initial={optionsDraft(value)}
                    read={readOptionsDraft}
                    onApply={onApply}
                    control={(draft, onDraftChange) => (
                        <OptionsFilterControl
                            filter={filter}
                            draft={draft}
                            onDraftChange={onDraftChange}
                        />
                    )}
                />
            )
        case 'boolean':
            return (
                <DraftForm
                    initial={booleanDraft(value)}
                    read={readBooleanDraft}
                    onApply={onApply}
                    control={(draft, onDraftChange) => (
                        <BooleanFilterControl
                            filter={filter}
                            draft={draft}
                            onDraftChange={onDraftChange}
                        />
                    )}
                />
            )
        case 'custom': {
            const Control = filter.Control
            return (
                // The control applies by itself; the form only keeps Enter from submitting anything else.
                <form onSubmit={(event) => event.preventDefault()}>
                    <Control
                        filter={filter}
                        value={
                            value?.kind === 'custom' ? value.value : undefined
                        }
                        onChange={(next) =>
                            onApply(
                                next === undefined
                                    ? undefined
                                    : { kind: 'custom', value: next }
                            )
                        }
                    />
                </form>
            )
        }
    }
}

interface FilterChipProps {
    filter: DataTableFilter
    /** Whether `columnFilters` has an entry with this filter's id. */
    active: boolean
    /** The entry's value, when it parses. */
    value: DataTableFilterValue | undefined
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Write the value to the table, or clear the entry with undefined. */
    onApply: ApplyFilter
}

/** A filter as a combobox-style chip whose popover edits it. */
export const FilterChip = ({
    filter,
    active,
    value,
    open,
    onOpenChange,
    onApply,
}: FilterChipProps) => {
    const anchor = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const summary =
        value === undefined ? '' : summarizeDataTableFilter(filter, value)
    const text = summary === '' ? filter.label : `${filter.label}: ${summary}`
    const apply: ApplyFilter = (next) => {
        onApply(next)
        onOpenChange(false)
    }
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <div
                ref={anchor}
                className="relative w-fit max-w-full min-w-0"
                data-slot="data-table-filter-chip"
                data-filter-id={filter.id}
                data-active={active || undefined}
            >
                {/* A combobox doesn't take its name from its contents. */}
                <PopoverTrigger
                    ref={trigger}
                    // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- PopoverTrigger sets aria-expanded and aria-controls at runtime
                    role="combobox"
                    aria-label={text}
                    data-size="sm"
                    className={cn(
                        selectTriggerVariants({ size: 'sm' }),
                        'w-auto max-w-full gap-0'
                    )}
                >
                    <span
                        className={cn(
                            'shrink-0',
                            summary !== '' &&
                                'pe-1.5 text-dhis2-subtle-foreground'
                        )}
                    >
                        {summary === '' ? filter.label : `${filter.label}:`}
                    </span>
                    {summary !== '' && (
                        <span className="min-w-0 flex-1 truncate">
                            {summary}
                        </span>
                    )}
                    {/* Room for the clear button laid over the trigger. */}
                    {active && (
                        <span aria-hidden="true" className="w-7 shrink-0" />
                    )}
                    <span className="ms-0.5 flex text-dhis2-foreground">
                        <IconChevronDown16 />
                    </span>
                </PopoverTrigger>
                {active && (
                    <button
                        type="button"
                        aria-label={i18n.t('Clear {{filter}}', {
                            filter: filter.label,
                            ...raw,
                        })}
                        data-slot="data-table-filter-clear"
                        className="absolute end-[22px] top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-dhis2-sm border-0 bg-transparent p-0 text-dhis2-subtle-foreground hover:bg-dhis2-accent hover:text-dhis2-foreground focus-visible:outline-2 focus-visible:outline-dhis2-ring [&_svg]:fill-current"
                        onClick={() => {
                            onApply(undefined)
                            // The button leaves with the value.
                            trigger.current?.focus()
                        }}
                    >
                        <SelectClearIcon />
                    </button>
                )}
            </div>
            <PopoverContent
                anchor={anchor}
                align="start"
                finalFocus={trigger}
                className="w-[min(320px,calc(100vw-32px))] gap-3"
            >
                <PopoverTitle>{filter.label}</PopoverTitle>
                <FilterEditor filter={filter} value={value} onApply={apply} />
            </PopoverContent>
        </Popover>
    )
}
