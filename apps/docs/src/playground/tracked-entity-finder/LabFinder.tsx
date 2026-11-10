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
} from '@/components/tracked-entity-finder'
import type { LabComposition, LabField } from './labData'

const inputClass =
    'w-full rounded border border-dhis2-input px-2 py-1 text-sm aria-invalid:border-dhis2-destructive-border'

/** A headless field: the finder's state and rules, the lab's own markup. */
const HookInput = ({
    field,
    state,
}: {
    field: LabField
    state: FinderFieldState
}) => {
    const { attribute, error, metadataError } = state
    const value = state.field.state.value
    const onBlur = state.field.handleBlur
    const label = field.label ?? attribute?.label ?? field.attribute
    const set = (next: FieldValue) => state.field.handleChange(next)
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
                            aria-invalid={error ? true : undefined}
                            onChange={(event) =>
                                update(index === 0, event.target.value)
                            }
                            className={inputClass}
                            onBlur={onBlur}
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
                        onBlur={onBlur}
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
                        onBlur={onBlur}
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
                        onBlur={onBlur}
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
                        onBlur={onBlur}
                    />
                )
            case 'number':
                return (
                    <input
                        aria-label={label}
                        inputMode="decimal"
                        value={value?.kind === 'number' ? value.value : ''}
                        aria-invalid={error ? true : undefined}
                        onChange={(event) =>
                            set({ kind: 'number', value: event.target.value })
                        }
                        className={inputClass}
                        onBlur={onBlur}
                    />
                )
            default:
                return (
                    <input
                        aria-label={label}
                        value={value?.kind === 'text' ? value.text : ''}
                        aria-invalid={error ? true : undefined}
                        onChange={(event) =>
                            set({ kind: 'text', text: event.target.value })
                        }
                        className={inputClass}
                        onBlur={onBlur}
                    />
                )
        }
    }
    if (metadataError) {
        return (
            <p className="rounded bg-dhis2-destructive-subtle px-2 py-1 text-sm text-dhis2-destructive">
                {metadataError}
            </p>
        )
    }
    return (
        <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
                {label}
                {attribute?.unique ? (
                    <span className="ms-1 text-xs text-dhis2-subtle-foreground">
                        ID
                    </span>
                ) : null}
            </span>
            {input()}
            {error ? (
                <span className="text-xs text-dhis2-destructive">{error}</span>
            ) : null}
        </label>
    )
}

const HookExactField = ({ field }: { field: LabField }) => {
    const state = useFinderField(field.attribute)
    return <HookInput field={field} state={state} />
}

const HookRangeField = ({ field }: { field: LabField }) => {
    const state = useFinderRangeField(field.attribute)
    return <HookInput field={field} state={state} />
}

const HookSubmit = () => {
    const { canSearch, submit, missing } = useFinderSearch()
    return (
        <button
            type="button"
            disabled={!canSearch}
            onClick={submit}
            className="self-start rounded bg-dhis2-primary px-3 py-1.5 text-sm text-dhis2-primary-foreground disabled:opacity-40"
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
    footer,
}: {
    fields: LabField[]
    composition: LabComposition
    footer?: ReactNode
}) => (
    <FinderForm className="flex flex-col gap-4">
        <LabFormFields fields={fields} hooks={composition.build === 'hooks'} />
        <FinderHint />
        {composition.build === 'hooks' ? <HookSubmit /> : <FinderSubmit />}
        {footer}
    </FinderForm>
)

const Forms = ({ composition }: { composition: LabComposition }) => {
    const [shown, setShown] = useState(0)
    const { forms } = composition
    if (composition.formLayout === 'swap' && forms.length > 1) {
        const current = Math.min(shown, forms.length - 1)
        return (
            <LabForm
                key={current}
                fields={forms[current]}
                composition={composition}
                footer={
                    <div className="flex flex-wrap gap-3">
                        {forms.map((_, index) =>
                            index === current ? null : (
                                <button
                                    key={index}
                                    type="button"
                                    className="text-sm text-dhis2-primary underline"
                                    onClick={() => setShown(index)}
                                >
                                    {index === 0
                                        ? 'Search by ID instead'
                                        : 'No ID? Search by other details'}
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
                    <LabForm fields={fields} composition={composition} />
                </div>
            ))}
        </div>
    )
}

const ComposedRows = ({ composition }: { composition: LabComposition }) => {
    const [first, ...rest] = composition.rowAttributes
    return (
        <FinderResults className="flex flex-col gap-3">
            <FinderSearching>Looking through the register…</FinderSearching>
            <FinderEmpty>
                Nobody matches. Check the spelling, or try their ID.
            </FinderEmpty>
            <FinderTooMany>
                That matches too many people. Add a date of birth.
            </FinderTooMany>
            <FinderError>
                The register could not be searched. Try again.
            </FinderError>
            <FinderList className="flex flex-col gap-2">
                <FinderItem className="rounded border border-dhis2-border p-3">
                    {first ? (
                        <span className="block font-medium">
                            <FinderValue attribute={first} />
                        </span>
                    ) : null}
                    {rest.map((attribute) => (
                        <span
                            key={attribute}
                            className="block text-sm text-dhis2-muted-foreground"
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
                <p
                    role="status"
                    className="text-sm text-dhis2-muted-foreground"
                >
                    {status}
                </p>
            ) : null}
            <table className="w-full text-start text-sm">
                <tbody className={results.refreshing ? 'opacity-50' : ''}>
                    {results.people.map((person) => (
                        <tr
                            key={person.trackedEntity}
                            className="cursor-pointer border-b border-dhis2-border hover:bg-dhis2-muted"
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
    switch (composition.build) {
        case 'own-rows':
            return <ComposedRows composition={composition} />
        case 'hooks':
            return <HookResults rowAttributes={composition.rowAttributes} />
        default:
            return <FinderResults />
    }
}

const Composed = ({ composition }: { composition: LabComposition }) => (
    <div className="flex flex-col gap-6">
        <Forms composition={composition} />
        <Results composition={composition} />
    </div>
)

/**
 * A live program's finder, from its own metadata: its IDs in one form, its
 * other searchable attributes in another. An empty form shows the loading
 * and failure states until the program is in.
 */
const LiveComposed = () => {
    const { status, searchableAttributes } = useFinderProgram()
    if (status !== 'ready') {
        return <FinderForm />
    }
    const ids = searchableAttributes.filter(({ unique }) => unique)
    const others = searchableAttributes.filter(({ unique }) => !unique)
    const forms = [ids, others]
        .filter((each) => each.length > 0)
        .map((each) => each.map(({ id }) => ({ attribute: id, range: false })))
    return (
        <Composed
            composition={{
                forms,
                formLayout: 'swap',
                build: 'parts',
                rowAttributes: [],
            }}
        />
    )
}

interface Props {
    program: string
    composition?: LabComposition
    onSelect: (person: FinderPerson) => void
}

/** The finder, composed as the lab says; without a composition, from the program's metadata. */
export const LabFinder = ({ program, composition, onSelect }: Props) => (
    <FinderProvider program={program} onSelect={onSelect}>
        {composition ? (
            <Composed composition={composition} />
        ) : (
            <LiveComposed />
        )}
    </FinderProvider>
)
