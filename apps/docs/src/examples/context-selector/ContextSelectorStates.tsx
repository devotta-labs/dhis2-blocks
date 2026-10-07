import {
    ClearSelections,
    ContextSelector,
    ContextValue,
    EnrollmentSelector,
    EventSelector,
    OptionSelector,
    StageSelector,
    type Option,
} from '@dhis2-blocks/context-selector'
import { useState } from 'react'
import { PreviewShell } from '../../preview/PreviewShell'

/**
 * Every selector primitive and every shared state.
 *
 * The state controls below drive the block's controlled `loading`,
 * `disabled`, `readOnly`, and clearable props — the same props a host
 * application owns when a workflow becomes unavailable.
 */
const enrollmentOptions: readonly Option[] = [
    { value: 'active', label: 'Active enrollment · 14 Mar 2026' },
    { value: 'completed', label: 'Completed enrollment · 3 Sep 2025' },
]

const stageOptions: readonly Option[] = [
    { value: 'registration', label: 'Registration' },
    { value: 'follow-up', label: 'Clinical follow-up' },
    { value: 'lab', label: 'Laboratory result' },
]

const eventOptions: readonly Option[] = [
    { value: '2026-08-24', label: '24 Aug 2026' },
    { value: '2026-07-12', label: '12 Jul 2026' },
]

const trackedEntityOptions: readonly Option[] = [
    { value: 'person', label: 'Person' },
    { value: 'household', label: 'Household' },
]

type SelectorName = 'enrollment' | 'stage' | 'event' | 'option' | 'category'

type SelectorMode = 'interactive' | 'loading' | 'disabled' | 'readOnly'

const initialValues = {
    enrollment: 'active',
    stage: 'follow-up',
    event: '2026-08-24',
    option: 'person',
    category: 'Default',
} satisfies Partial<Record<SelectorName, string>>

const isSelectorMode = (value: string): value is SelectorMode =>
    value === 'interactive' ||
    value === 'loading' ||
    value === 'disabled' ||
    value === 'readOnly'

const ContextSelectorStates = () => {
    const [values, setValues] =
        useState<Partial<Record<SelectorName, string>>>(initialValues)

    const [openSelector, setOpenSelector] = useState<SelectorName>()
    const [mode, setMode] = useState<SelectorMode>('interactive')
    const [clearable, setClearable] = useState(true)

    const updateValue = (name: SelectorName, value?: string) => {
        setValues((current) => ({ ...current, [name]: value }))
    }

    const openProps = (name: SelectorName) => ({
        open: openSelector === name,
        onOpenChange: (open: boolean) =>
            setOpenSelector(open ? name : undefined),
    })

    const stateProps = {
        loading: mode === 'loading',
        loadingLabel: 'Loading context options',
        disabled: mode === 'disabled',
        readOnly: mode === 'readOnly',
    }

    const clear = (name: SelectorName) =>
        clearable ? () => updateValue(name) : undefined

    return (
        <PreviewShell className="min-h-0 p-0">
            <ContextSelector ariaLabel="Selector states">
                <EnrollmentSelector
                    options={enrollmentOptions}
                    value={values.enrollment}
                    onChange={(value) => updateValue('enrollment', value)}
                    onClear={clear('enrollment')}
                    {...openProps('enrollment')}
                    {...stateProps}
                />
                <StageSelector
                    options={stageOptions}
                    value={values.stage}
                    onChange={(value) => updateValue('stage', value)}
                    onClear={clear('stage')}
                    {...openProps('stage')}
                    {...stateProps}
                />
                <EventSelector
                    label="Visit date"
                    options={eventOptions}
                    value={values.event}
                    onChange={(value) => updateValue('event', value)}
                    onClear={clear('event')}
                    {...openProps('event')}
                    {...stateProps}
                />
                <OptionSelector
                    label="Tracked entity type"
                    options={trackedEntityOptions}
                    value={values.option}
                    onChange={(value) => updateValue('option', value)}
                    onClear={clear('option')}
                    {...openProps('option')}
                    {...stateProps}
                />
                <ContextValue
                    label="Category"
                    value={values.category}
                    placeholder="No category"
                    onClear={clear('category')}
                />
                <ClearSelections
                    onClear={() => setValues({})}
                    disabled={!Object.values(values).some(Boolean)}
                />
            </ContextSelector>

            <div className="mt-4 flex flex-wrap items-end gap-5 border-t border-[#e8edf2] bg-white p-4">
                <label className="grid gap-1 text-sm font-medium text-[#364152]">
                    Selector state
                    <select
                        className="min-w-40 rounded border border-[#a0adba] bg-white px-3 py-2 font-normal text-[#212934]"
                        value={mode}
                        onChange={(event) => {
                            const nextMode = event.target.value

                            if (isSelectorMode(nextMode)) {
                                setMode(nextMode)
                            }

                            setOpenSelector(undefined)
                        }}
                    >
                        <option value="interactive">Interactive</option>
                        <option value="loading">Loading</option>
                        <option value="disabled">Disabled</option>
                        <option value="readOnly">Read-only</option>
                    </select>
                </label>
                <label className="flex min-h-10 items-center gap-2 text-sm text-[#364152]">
                    <input
                        type="checkbox"
                        checked={clearable}
                        onChange={(event) => setClearable(event.target.checked)}
                    />
                    Allow individual clear actions
                </label>
                <button
                    type="button"
                    className="min-h-10 rounded border border-[#a0adba] bg-white px-4 text-sm font-medium text-[#25313f] hover:bg-[#f3f5f7]"
                    onClick={() => setValues(initialValues)}
                >
                    Reset sample values
                </button>
            </div>
        </PreviewShell>
    )
}

export default ContextSelectorStates
