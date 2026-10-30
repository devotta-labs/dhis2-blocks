import type { ReactNode } from 'react'
import {
    CALENDARS,
    DATE_FORMATS,
    METADATA_ANSWERS,
    OPERATORS,
    SAMPLE_OPTIONS,
    SEARCH_ANSWERS,
    TEXT_OPERATORS,
    VALUE_TYPES,
    type LabAttribute,
    type LabProgram,
    type LabServer,
} from './labConfig'

/** An attribute the composer can offer, from the lab program or a live one. */
export interface KnownAttribute {
    id: string
    label: string
    valueType: string
}

export const Section = ({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) => (
    <fieldset className="flex min-w-0 flex-col gap-1.5 border-t border-dhis2-grey-300 pt-3">
        <legend className="pe-2 text-xs font-medium tracking-wide text-dhis2-grey-700 uppercase">
            {title}
        </legend>
        {children}
    </fieldset>
)

export const Check = ({
    checked,
    onChange,
    children,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    children: ReactNode
}) => (
    <label className="flex items-center gap-2 text-sm">
        <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
        />
        {children}
    </label>
)

export const box =
    'rounded border border-dhis2-grey-500 bg-white px-1.5 py-0.5 text-sm'

const NumberRow = ({
    label,
    value,
    onChange,
    min = 0,
    step = 1,
}: {
    label: string
    value: number
    onChange: (value: number) => void
    min?: number
    step?: number
}) => (
    <label className="flex items-center justify-between gap-2 text-sm">
        {label}
        <input
            type="number"
            min={min}
            step={step}
            value={value}
            onChange={(event) =>
                onChange(Math.max(min, Number(event.target.value)))
            }
            className={`${box} w-24`}
        />
    </label>
)

export const SelectRow = <T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: T
    options: ReadonlyArray<readonly [T, string]>
    onChange: (value: T) => void
}) => (
    <label className="flex items-center justify-between gap-2 text-sm">
        {label}
        <select
            value={value}
            onChange={(event) => {
                const next = options.find(
                    ([option]) => option === event.target.value
                )
                if (next) onChange(next[0])
            }}
            className={`${box} max-w-44`}
        >
            {options.map(([option, text]) => (
                <option key={option} value={option}>
                    {text}
                </option>
            ))}
        </select>
    </label>
)

const pairs = <T extends string>(values: ReadonlyArray<T>) =>
    values.map((value) => [value, value] as const)

export const TextRow = ({
    label,
    value,
    onChange,
    mono = false,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    mono?: boolean
}) => (
    <label className="flex flex-col text-xs text-dhis2-grey-700">
        {label}
        <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={`${box} ${mono ? 'font-mono' : ''}`}
        />
    </label>
)

const flags = (attribute: LabAttribute) =>
    [
        attribute.searchable ? 'search' : 'no search',
        attribute.unique && 'unique',
        attribute.displayInList && 'list',
        attribute.options && 'options',
        attribute.blocked.length > 0 && `blocks ${attribute.blocked.join('/')}`,
    ]
        .filter(Boolean)
        .join(' · ')

const AttributeEditor = ({
    attribute,
    onChange,
    onRemove,
}: {
    attribute: LabAttribute
    onChange: (attribute: LabAttribute) => void
    onRemove: () => void
}) => {
    const set = <K extends keyof LabAttribute>(
        key: K,
        value: LabAttribute[K]
    ) => onChange({ ...attribute, [key]: value })
    return (
        <details className="rounded border border-dhis2-grey-300 bg-white">
            <summary className="cursor-pointer px-2 py-1 text-sm">
                <span className="font-medium">{attribute.label}</span>{' '}
                <code className="text-xs text-dhis2-grey-600">
                    {attribute.valueType}
                </code>
                <span className="block text-xs text-dhis2-grey-600">
                    {flags(attribute)}
                </span>
            </summary>
            <div className="flex flex-col gap-1.5 border-t border-dhis2-grey-300 p-2">
                <TextRow
                    label="Label"
                    value={attribute.label}
                    onChange={(label) => set('label', label)}
                />
                <TextRow
                    label="Uid"
                    mono
                    value={attribute.id}
                    onChange={(id) => set('id', id)}
                />
                <SelectRow
                    label="Value type"
                    value={attribute.valueType}
                    options={pairs(VALUE_TYPES)}
                    onChange={(valueType) => set('valueType', valueType)}
                />
                <Check
                    checked={attribute.searchable}
                    onChange={(on) => set('searchable', on)}
                >
                    Searchable in the program
                </Check>
                <Check
                    checked={attribute.unique}
                    onChange={(on) => set('unique', on)}
                >
                    Unique (an ID)
                </Check>
                <Check
                    checked={attribute.displayInList}
                    onChange={(on) => set('displayInList', on)}
                >
                    Display in list
                </Check>
                <Check
                    checked={attribute.options !== undefined}
                    onChange={(on) =>
                        set('options', on ? SAMPLE_OPTIONS : undefined)
                    }
                >
                    Option set
                </Check>
                <NumberRow
                    label="Min characters"
                    value={attribute.minCharacters}
                    onChange={(value) => set('minCharacters', value)}
                />
                <SelectRow
                    label="Preferred operator"
                    value={attribute.preferred ?? ''}
                    options={[['', '(none)'], ...pairs(TEXT_OPERATORS)]}
                    onChange={(value) => set('preferred', value || undefined)}
                />
                <span className="text-xs text-dhis2-grey-700">
                    Blocked operators
                </span>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {OPERATORS.map((operator) => (
                        <Check
                            key={operator}
                            checked={attribute.blocked.includes(operator)}
                            onChange={(on) =>
                                set(
                                    'blocked',
                                    OPERATORS.filter((each) =>
                                        each === operator
                                            ? on
                                            : attribute.blocked.includes(each)
                                    )
                                )
                            }
                        >
                            <code>{operator}</code>
                        </Check>
                    ))}
                </div>
                <button
                    type="button"
                    className="self-start text-sm text-dhis2-red-700 underline"
                    onClick={onRemove}
                >
                    Remove attribute
                </button>
            </div>
        </details>
    )
}

export const ProgramControls = ({
    program,
    onChange,
}: {
    program: LabProgram
    onChange: (program: LabProgram) => void
}) => {
    const setAttributes = (attributes: LabAttribute[]) =>
        onChange({ ...program, attributes })
    return (
        <Section title="Program">
            <TextRow
                label="Name"
                value={program.name}
                onChange={(name) => onChange({ ...program, name })}
            />
            <NumberRow
                label="Min attributes to search"
                value={program.minAttributes}
                onChange={(minAttributes) =>
                    onChange({ ...program, minAttributes })
                }
            />
            <NumberRow
                label="Max results (0 = no cap)"
                value={program.maxResults}
                onChange={(maxResults) => onChange({ ...program, maxResults })}
            />
            <span className="text-xs text-dhis2-grey-700">
                Attributes, in metadata order
            </span>
            {program.attributes.map((attribute, index) => (
                <AttributeEditor
                    key={index}
                    attribute={attribute}
                    onChange={(next) =>
                        setAttributes(
                            program.attributes.map((each, at) =>
                                at === index ? next : each
                            )
                        )
                    }
                    onRemove={() =>
                        setAttributes(
                            program.attributes.filter((_, at) => at !== index)
                        )
                    }
                />
            ))}
            <button
                type="button"
                className="self-start text-sm text-dhis2-blue-700 underline"
                onClick={() =>
                    setAttributes([
                        ...program.attributes,
                        {
                            id: `attribute${program.attributes.length + 1}`,
                            label: `Attribute ${program.attributes.length + 1}`,
                            valueType: 'TEXT',
                            unique: false,
                            searchable: true,
                            displayInList: false,
                            minCharacters: 0,
                            blocked: [],
                        },
                    ])
                }
            >
                Add attribute
            </button>
        </Section>
    )
}

export const ServerControls = ({
    server,
    onChange,
}: {
    server: LabServer
    onChange: (server: LabServer) => void
}) => {
    const set = <K extends keyof LabServer>(key: K, value: LabServer[K]) =>
        onChange({ ...server, [key]: value })
    return (
        <Section title="Fake server">
            <NumberRow
                label="People every search matches"
                value={server.matches}
                onChange={(value) => set('matches', value)}
            />
            <Check
                checked={server.reportsTotal}
                onChange={(on) => set('reportsTotal', on)}
            >
                Reports a total
            </Check>
            <NumberRow
                label="Latency (ms)"
                value={server.latency}
                step={100}
                onChange={(value) => set('latency', value)}
            />
            <SelectRow
                label="Search"
                value={server.search}
                options={SEARCH_ANSWERS}
                onChange={(value) => set('search', value)}
            />
            <SelectRow
                label="Program metadata"
                value={server.program}
                options={METADATA_ANSWERS}
                onChange={(value) => set('program', value)}
            />
            <SelectRow
                label="System info"
                value={server.systemInfo}
                options={METADATA_ANSWERS}
                onChange={(value) => set('systemInfo', value)}
            />
            <SelectRow
                label="Calendar"
                value={server.calendar}
                options={pairs(CALENDARS)}
                onChange={(value) => set('calendar', value)}
            />
            <SelectRow
                label="Date format"
                value={server.dateFormat}
                options={pairs(DATE_FORMATS)}
                onChange={(value) => set('dateFormat', value)}
            />
        </Section>
    )
}
