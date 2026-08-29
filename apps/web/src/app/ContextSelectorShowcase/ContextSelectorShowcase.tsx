import {
    ContextSelector,
    ContextValue,
    EnrollmentSelector,
    EventSelector,
    OptionSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    StageSelector,
    type Option,
} from '@dhis2-blocks/context-selector'
import React, { useState } from 'react'

type SelectorMode = 'interactive' | 'loading' | 'disabled' | 'readOnly'
type SelectorName =
    | 'program'
    | 'organisationUnit'
    | 'enrollment'
    | 'stage'
    | 'event'
    | 'option'
    | 'category'

const programOptions: readonly Option[] = [
    { value: 'malaria', label: 'Malaria case registration' },
    { value: 'tuberculosis', label: 'Tuberculosis program' },
    { value: 'antenatal', label: 'Antenatal care' },
    { value: 'child-health', label: 'Child health' },
    { value: 'immunisation', label: 'Immunisation registry' },
    { value: 'nutrition', label: 'Nutrition surveillance' },
    { value: 'hiv', label: 'HIV care and treatment' },
    { value: 'maternal', label: 'Maternal health' },
    { value: 'outbreak', label: 'Outbreak response' },
    { value: 'school-health', label: 'School health' },
    { value: 'mental-health', label: 'Mental health' },
]

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

const initialValues = {
    program: 'malaria',
    organisationUnit: 'Ngelehun CHC',
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

export const ContextSelectorShowcase = () => {
    const [selectorSet, setSelectorSet] = useState<'primary' | 'related'>(
        'primary'
    )
    const [mode, setMode] = useState<SelectorMode>('interactive')
    const [clearable, setClearable] = useState(true)
    const [values, setValues] =
        useState<Partial<Record<SelectorName, string>>>(initialValues)
    const [openSelector, setOpenSelector] = useState<SelectorName>()

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
        <div
            className="min-h-screen bg-[#f3f5f7] pb-10"
            data-testid="context-selector-showcase"
        >
            <ContextSelector
                ariaLabel="Context selector showcase"
                onClear={() => setValues({})}
                clearDisabled={!Object.values(values).some(Boolean)}
            >
                {selectorSet === 'primary' ? (
                    <>
                        <ProgramSelector
                            options={programOptions}
                            value={values.program}
                            onChange={(value) => updateValue('program', value)}
                            onClear={clear('program')}
                            searchPlaceholder="Search programs"
                            {...openProps('program')}
                            {...stateProps}
                        />
                        <OrganisationUnitSelector
                            value={values.organisationUnit}
                            onClear={clear('organisationUnit')}
                            {...openProps('organisationUnit')}
                            {...stateProps}
                        >
                            <div
                                className="space-y-1 p-3"
                                aria-label="Example organisation units"
                            >
                                <p className="m-0 pb-2 text-sm text-[#4a5768]">
                                    Host-owned organisation-unit picker
                                </p>
                                {[
                                    'Ngelehun CHC',
                                    'Njandama MCHP',
                                    'Bo Government Hospital',
                                ].map((name) => (
                                    <button
                                        key={name}
                                        type="button"
                                        className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[#e8edf2] focus:outline-2 focus:outline-[#147cd7]"
                                        onClick={(event) => {
                                            event.preventDefault()
                                            event.stopPropagation()
                                            updateValue(
                                                'organisationUnit',
                                                name
                                            )
                                            setOpenSelector(undefined)
                                        }}
                                    >
                                        Select {name}
                                    </button>
                                ))}
                            </div>
                        </OrganisationUnitSelector>
                    </>
                ) : (
                    <>
                        <EnrollmentSelector
                            options={enrollmentOptions}
                            value={values.enrollment}
                            onChange={(value) =>
                                updateValue('enrollment', value)
                            }
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
                    </>
                )}
            </ContextSelector>

            <main className="mx-auto mt-6 w-[min(880px,calc(100%-32px))] rounded border border-[#d5dde5] bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="m-0 text-xs font-semibold tracking-wide text-[#6c7787] uppercase">
                            Component demo
                        </p>
                        <h1 className="mt-1 mb-2 text-2xl font-medium text-[#212934]">
                            Context Selector showcase
                        </h1>
                        <p className="m-0 max-w-2xl text-sm leading-6 text-[#4a5768]">
                            Open and change every selector in the Capture-style
                            row. This page owns all values, popup state, and
                            callbacks; the block remains presentational.
                        </p>
                    </div>
                    <a
                        className="text-sm font-medium text-[#147cd7] underline-offset-2 hover:underline"
                        href="#/"
                    >
                        Back to Working List
                    </a>
                </div>

                <section
                    className="mt-6 border-t border-[#e8edf2] pt-5"
                    aria-labelledby="showcase-controls-heading"
                >
                    <h2
                        id="showcase-controls-heading"
                        className="m-0 text-base font-medium"
                    >
                        State controls
                    </h2>
                    <div className="mt-3 flex flex-wrap items-end gap-5">
                        <label className="grid gap-1 text-sm font-medium text-[#364152]">
                            Visible selectors
                            <select
                                className="min-w-48 rounded border border-[#a0adba] bg-white px-3 py-2 font-normal text-[#212934]"
                                value={selectorSet}
                                onChange={(event) => {
                                    setSelectorSet(
                                        event.target.value === 'related'
                                            ? 'related'
                                            : 'primary'
                                    )
                                    setOpenSelector(undefined)
                                }}
                            >
                                <option value="primary">
                                    Program and organisation unit
                                </option>
                                <option value="related">
                                    Enrollment, stage and event
                                </option>
                            </select>
                        </label>
                        <label className="grid gap-1 text-sm font-medium text-[#364152]">
                            Selector state
                            <select
                                className="min-w-48 rounded border border-[#a0adba] bg-white px-3 py-2 font-normal text-[#212934]"
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
                                onChange={(event) =>
                                    setClearable(event.target.checked)
                                }
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
                </section>

                <section
                    className="mt-6 rounded bg-[#f8fafb] p-4 text-sm text-[#4a5768]"
                    aria-label="Showcase notes"
                >
                    <p className="m-0">
                        Program includes eleven options to expose Capture's
                        search field. Organisation unit demonstrates the
                        required host-supplied picker. Event and generic Option
                        use host-owned metadata labels, while Category
                        demonstrates a display-only ContextValue.
                    </p>
                </section>
            </main>
        </div>
    )
}
