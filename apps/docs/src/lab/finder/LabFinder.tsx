import { useState, type ReactNode } from 'react'
import {
    FinderEmpty,
    FinderError,
    FinderField,
    FinderForm,
    FinderHint,
    FinderItem,
    FinderList,
    FinderPagination,
    FinderProvider,
    FinderRangeField,
    FinderResults,
    FinderSearching,
    FinderSubmit,
    FinderTooMany,
    FinderValue,
    useFinderField,
    useFinderProgram,
    useFinderRangeField,
    useFinderResults,
    useFinderSearch,
    type FieldValue,
    type FinderFieldState,
    type FinderPerson,
    type TrackedEntityFinderClient,
} from '@/components/tracked-entity-finder'
import type { LabComposition, LabField } from './labConfig'

const Readout = ({ children }: { children: ReactNode }) => (
    <output className="block rounded border border-dashed border-dhis2-purple-500 px-2 py-1 font-mono text-[11px] leading-4 text-dhis2-purple-800">
        {children}
    </output>
)

/** Lab chrome, not finder UI: what the form's verdict is right now. */
const SearchReadout = () => {
    const search = useFinderSearch()
    return (
        <Readout>
            reason={search.reason} canSearch={String(search.canSearch)} missing=
            {search.missing}
            {search.searchingBy ? ` searchingBy="${search.searchingBy}"` : ''}
        </Readout>
    )
}

const ProgramReadout = () => {
    const program = useFinderProgram()
    return (
        <Readout>
            program status={program.status}
            {program.name ? ` name="${program.name}"` : ''} searchable=
            {program.searchableAttributes.length}
        </Readout>
    )
}

const ResultsReadout = () => {
    const results = useFinderResults()
    return (
        <Readout>
            results status={results.status} page={results.page} people=
            {results.people.length} hasPrevious={String(results.hasPrevious)}{' '}
            hasNext={String(results.hasNext)} refreshing=
            {String(results.refreshing)}
        </Readout>
    )
}

const inputClass =
    'w-full rounded border border-dhis2-grey-500 px-2 py-1 text-sm aria-invalid:border-dhis2-red-700'

/** A headless field: the finder's state and rules, the lab's own markup. */
const HookInput = ({
    field,
    state,
}: {
    field: LabField
    state: FinderFieldState
}) => {
    const { attribute, value, setValue, issue, problem } = state
    const label = field.label ?? attribute?.label ?? field.attribute
    const set = (next: FieldValue) => setValue(next)
    const input = (): ReactNode => {
        if (!attribute) return <span className="text-sm">Loading…</span>
        if (field.range) {
            const numbers = attribute.kind === 'number'
            const min = value?.kind === 'numberRange' ? value.min : ''
            const max = value?.kind === 'numberRange' ? value.max : ''
            const from = value?.kind === 'dateRange' ? value.from : undefined
            const to = value?.kind === 'dateRange' ? value.to : undefined
            const update = (low: boolean, text: string) =>
                set(
                    numbers
                        ? {
                              kind: 'numberRange',
                              min: low ? text : min,
                              max: low ? max : text,
                          }
                        : {
                              kind: 'dateRange',
                              from: low ? text || undefined : from,
                              to: low ? to : text || undefined,
                          }
                )
            const ends = numbers ? [min, max] : [from ?? '', to ?? '']
            return (
                <span className="flex gap-2">
                    {ends.map((each, index) => (
                        <input
                            key={index}
                            aria-label={`${label} ${index === 0 ? 'from' : 'to'}`}
                            type={numbers ? 'text' : 'date'}
                            value={each}
                            aria-invalid={issue ? true : undefined}
                            onChange={(event) =>
                                update(index === 0, event.target.value)
                            }
                            className={inputClass}
                        />
                    ))}
                </span>
            )
        }
        switch (attribute.kind) {
            case 'option':
                return (
                    <select
                        aria-label={label}
                        value={
                            value?.kind === 'option' ? (value.code ?? '') : ''
                        }
                        onChange={(event) =>
                            set({
                                kind: 'option',
                                code: event.target.value || undefined,
                            })
                        }
                        className={inputClass}
                    >
                        <option value="">Any</option>
                        {attribute.options?.map((option) => (
                            <option key={option.code} value={option.code}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                )
            case 'boolean':
                return (
                    <select
                        aria-label={label}
                        value={
                            value?.kind === 'boolean' ? (value.value ?? '') : ''
                        }
                        onChange={(event) =>
                            set({
                                kind: 'boolean',
                                value:
                                    event.target.value === 'true' ||
                                    event.target.value === 'false'
                                        ? event.target.value
                                        : undefined,
                            })
                        }
                        className={inputClass}
                    >
                        <option value="">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                )
            case 'trueOnly':
                return (
                    <input
                        aria-label={label}
                        type="checkbox"
                        checked={value?.kind === 'trueOnly' && value.checked}
                        onChange={(event) =>
                            set({
                                kind: 'trueOnly',
                                checked: event.target.checked,
                            })
                        }
                    />
                )
            case 'date':
            case 'dateTime':
                return (
                    <input
                        aria-label={label}
                        type="date"
                        value={value?.kind === 'date' ? (value.date ?? '') : ''}
                        onChange={(event) =>
                            set({
                                kind: 'date',
                                date: event.target.value || undefined,
                            })
                        }
                        className={inputClass}
                    />
                )
            case 'number':
                return (
                    <input
                        aria-label={label}
                        inputMode="decimal"
                        value={value?.kind === 'number' ? value.value : ''}
                        aria-invalid={issue ? true : undefined}
                        onChange={(event) =>
                            set({ kind: 'number', value: event.target.value })
                        }
                        className={inputClass}
                    />
                )
            default:
                return (
                    <input
                        aria-label={label}
                        value={value?.kind === 'text' ? value.text : ''}
                        aria-invalid={issue ? true : undefined}
                        onChange={(event) =>
                            set({ kind: 'text', text: event.target.value })
                        }
                        className={inputClass}
                    />
                )
        }
    }
    if (problem) {
        return (
            <p className="rounded bg-dhis2-red-050 px-2 py-1 text-sm text-dhis2-red-800">
                {problem}
            </p>
        )
    }
    return (
        <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
                {label}
                {attribute?.unique ? (
                    <span className="ms-1 text-xs text-dhis2-grey-600">ID</span>
                ) : null}
            </span>
            {input()}
            {issue ? (
                <span className="text-xs text-dhis2-red-700">{issue}</span>
            ) : null}
        </label>
    )
}

const HookExactField = ({ field }: { field: LabField }) => (
    <HookInput field={field} state={useFinderField(field.attribute)} />
)

const HookRangeField = ({ field }: { field: LabField }) => (
    <HookInput field={field} state={useFinderRangeField(field.attribute)} />
)

const HookSubmit = () => {
    const { canSearch, submit, missing } = useFinderSearch()
    return (
        <button
            type="button"
            disabled={!canSearch}
            onClick={submit}
            className="self-start rounded bg-dhis2-teal-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
            {canSearch ? 'Find' : `Find (${missing} more)`}
        </button>
    )
}

const LabFormFields = ({
    fields,
    hooks,
}: {
    fields: LabField[]
    hooks: boolean
}) =>
    fields.map((field, index) => {
        const key = `${field.attribute}-${field.range}-${index}`
        const props = {
            attribute: field.attribute,
            label: field.label,
            placeholder: field.placeholder,
            description: field.description,
        }
        if (hooks) {
            return field.range ? (
                <HookRangeField key={key} field={field} />
            ) : (
                <HookExactField key={key} field={field} />
            )
        }
        return field.range ? (
            <FinderRangeField key={key} {...props} />
        ) : (
            <FinderField key={key} {...props} />
        )
    })

const LabForm = ({
    fields,
    composition,
    readouts,
    footer,
}: {
    fields: LabField[]
    composition: LabComposition
    readouts: boolean
    footer?: ReactNode
}) => (
    <FinderForm className="flex flex-col gap-4">
        <LabFormFields fields={fields} hooks={composition.hookFields} />
        {composition.hint ? <FinderHint /> : null}
        {composition.hookFields ? <HookSubmit /> : <FinderSubmit />}
        {footer}
        {readouts ? <SearchReadout /> : null}
    </FinderForm>
)

const Forms = ({
    composition,
    readouts,
}: {
    composition: LabComposition
    readouts: boolean
}) => {
    const [shown, setShown] = useState(0)
    const { forms } = composition
    if (composition.formLayout === 'swap' && forms.length > 1) {
        const current = Math.min(shown, forms.length - 1)
        return (
            <LabForm
                key={current}
                fields={forms[current]}
                composition={composition}
                readouts={readouts}
                footer={
                    <div className="flex flex-wrap gap-3">
                        {forms.map((_, index) =>
                            index === current ? null : (
                                <button
                                    key={index}
                                    type="button"
                                    className="text-sm text-dhis2-blue-700 underline"
                                    onClick={() => setShown(index)}
                                >
                                    {index === 0
                                        ? 'Search by ID instead'
                                        : `No ID? Use form ${index + 1}`}
                                </button>
                            )
                        )}
                    </div>
                }
            />
        )
    }
    return (
        <div className="flex flex-wrap gap-8">
            {forms.map((fields, index) => (
                <div key={index} className="min-w-64 flex-1">
                    <LabForm
                        fields={fields}
                        composition={composition}
                        readouts={readouts}
                    />
                </div>
            ))}
        </div>
    )
}

const ComposedRows = ({ composition }: { composition: LabComposition }) => {
    const [first, ...rest] = composition.rowAttributes
    return (
        <FinderResults className="flex flex-col gap-3">
            {composition.customTexts ? (
                <>
                    <FinderSearching>
                        Looking through the register…
                    </FinderSearching>
                    <FinderEmpty>
                        Nobody matches. Check the spelling, or try their ID.
                    </FinderEmpty>
                    <FinderTooMany>
                        That matches too many people. Add a date of birth.
                    </FinderTooMany>
                    <FinderError>
                        The register could not be searched. Try again.
                    </FinderError>
                </>
            ) : (
                <>
                    <FinderSearching />
                    <FinderEmpty />
                    <FinderTooMany />
                    <FinderError />
                </>
            )}
            <FinderList className="flex flex-col gap-2">
                <FinderItem className="rounded border border-dhis2-grey-300 p-3">
                    {first ? (
                        <span className="block font-medium">
                            <FinderValue attribute={first} />
                        </span>
                    ) : null}
                    {rest.map((attribute) => (
                        <span
                            key={attribute}
                            className="block text-sm text-dhis2-grey-700"
                        >
                            <FinderValue attribute={attribute} />
                        </span>
                    ))}
                </FinderItem>
            </FinderList>
            <FinderPagination />
        </FinderResults>
    )
}

/** Results from `useFinderResults` alone: no finder result parts. */
const HookResults = ({ rowAttributes }: { rowAttributes: string[] }) => {
    const results = useFinderResults()
    const status = {
        idle: 'Search to see people.',
        searching: 'Searching…',
        empty: 'Nobody.',
        'too-many': 'Too many. Narrow it down.',
        error: 'Something went wrong.',
        results: '',
    }[results.status]
    return (
        <section className="flex flex-col gap-2">
            {status ? (
                <p role="status" className="text-sm text-dhis2-grey-700">
                    {status}
                </p>
            ) : null}
            <table className="w-full text-start text-sm">
                <tbody className={results.refreshing ? 'opacity-50' : ''}>
                    {results.people.map((person) => (
                        <tr
                            key={person.trackedEntity}
                            className="cursor-pointer border-b border-dhis2-grey-300 hover:bg-dhis2-grey-100"
                            onClick={() => results.select(person)}
                        >
                            <td className="py-1.5 font-mono text-xs">
                                {person.trackedEntity}
                            </td>
                            {rowAttributes.map((attribute) => (
                                <td key={attribute} className="py-1.5">
                                    {person.attributes[attribute] ?? ''}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {results.hasPrevious || results.hasNext ? (
                <div className="flex items-center gap-3 text-sm">
                    <button
                        type="button"
                        disabled={!results.hasPrevious}
                        onClick={results.previous}
                        className="underline disabled:opacity-40"
                    >
                        Back
                    </button>
                    <span>Page {results.page}</span>
                    <button
                        type="button"
                        disabled={!results.hasNext}
                        onClick={results.next}
                        className="underline disabled:opacity-40"
                    >
                        More
                    </button>
                </div>
            ) : null}
        </section>
    )
}

const Results = ({ composition }: { composition: LabComposition }) => {
    switch (composition.results) {
        case 'custom':
            return <ComposedRows composition={composition} />
        case 'hooks':
            return <HookResults rowAttributes={composition.rowAttributes} />
        case 'none':
            return null
        default:
            return <FinderResults />
    }
}

/** The finder, composed as the lab says, with optional state readouts. */
export const LabFinder = ({
    program,
    client,
    composition,
    readouts,
    onSelect,
    children,
}: {
    program: string
    client: TrackedEntityFinderClient
    composition: LabComposition
    readouts: boolean
    onSelect: (person: FinderPerson) => void
    /** Lab probes that need the provider. */
    children?: ReactNode
}) => (
    <FinderProvider program={program} client={client} onSelect={onSelect}>
        {children}
        <div className="flex flex-col gap-6">
            {readouts ? <ProgramReadout /> : null}
            <Forms composition={composition} readouts={readouts} />
            <Results composition={composition} />
            {readouts ? <ResultsReadout /> : null}
        </div>
    </FinderProvider>
)
