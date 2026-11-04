import { Check, NumberRow, Section, SelectRow, Segmented } from '../controls'
import {
    CALENDARS,
    CANVAS_WIDTHS,
    DATE_FORMATS,
    FORM_LAYOUTS,
    OPERATORS,
    RESULTS_LAYOUTS,
    SAMPLE_OPTIONS,
    SEARCH_ANSWERS,
    TEXT_OPERATORS,
    VALUE_TYPES,
    type LabAttribute,
    type LabComposition,
    type LabField,
    type LabProgram,
    type LabServer,
    type LabSettings,
} from './labData'
import type { KnownAttribute } from './labState'

const muted = 'text-xs text-muted-foreground'

const pairs = <T extends string>(values: ReadonlyArray<T>) =>
    values.map((value) => [value, value] as const)

const TextRow = ({
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
    <label className={`flex flex-col gap-0.5 ${muted}`}>
        {label}
        <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={mono ? 'font-mono' : ''}
        />
    </label>
)

const move = <T,>(items: T[], from: number, by: -1 | 1) => {
    const next = [...items]
    const [item] = next.splice(from, 1)
    next.splice(from + by, 0, item)
    return next
}

/** The canvas around the finder: its width and direction. */
export const CanvasControls = ({
    settings,
    onChange,
}: {
    settings: LabSettings
    onChange: (changes: Partial<LabSettings>) => void
}) => (
    <Section title="Canvas">
        <Segmented
            value={settings.width}
            options={CANVAS_WIDTHS}
            onChange={(width) => onChange({ width })}
        />
        <Check checked={settings.rtl} onChange={(rtl) => onChange({ rtl })}>
            Right to left
        </Check>
    </Section>
)

const FieldEditor = ({
    field,
    known,
    onChange,
    onMove,
    onRemove,
    first,
    last,
}: {
    field: LabField
    known: KnownAttribute[]
    onChange: (field: LabField) => void
    onMove: (by: -1 | 1) => void
    onRemove: () => void
    first: boolean
    last: boolean
}) => {
    const isKnown = known.some(({ id }) => id === field.attribute)
    return (
        <li className="flex flex-col gap-1 rounded-md border border-border p-1.5">
            <div className="flex items-center gap-1">
                <select
                    aria-label="Attribute"
                    value={field.attribute}
                    onChange={(event) =>
                        onChange({ ...field, attribute: event.target.value })
                    }
                    className="min-w-0 flex-1"
                >
                    {isKnown ? null : (
                        <option value={field.attribute}>
                            {field.attribute} (not in program)
                        </option>
                    )}
                    {known.map(({ id, label, valueType }) => (
                        <option key={id} value={id}>
                            {label} · {valueType}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    aria-label="Move up"
                    disabled={first}
                    onClick={() => onMove(-1)}
                >
                    ↑
                </button>
                <button
                    type="button"
                    aria-label="Move down"
                    disabled={last}
                    onClick={() => onMove(1)}
                >
                    ↓
                </button>
                <button
                    type="button"
                    aria-label="Remove field"
                    onClick={onRemove}
                >
                    ×
                </button>
            </div>
            <Check
                checked={field.range}
                onChange={(range) => onChange({ ...field, range })}
            >
                Range
            </Check>
            <details>
                <summary className={`cursor-pointer ${muted}`}>
                    Label, placeholder, help
                </summary>
                <div className="flex flex-col gap-1 pt-1">
                    {(['label', 'placeholder', 'description'] as const).map(
                        (key) => (
                            <TextRow
                                key={key}
                                label={key}
                                value={field[key] ?? ''}
                                onChange={(text) =>
                                    onChange({
                                        ...field,
                                        [key]: text || undefined,
                                    })
                                }
                            />
                        )
                    )}
                </div>
            </details>
        </li>
    )
}

const AddField = ({ onAdd }: { onAdd: (attribute: string) => void }) => (
    <form
        className="flex gap-1"
        onSubmit={(event) => {
            event.preventDefault()
            const input = String(
                new FormData(event.currentTarget).get('attribute') ?? ''
            ).trim()
            if (input) {
                onAdd(input)
                event.currentTarget.reset()
            }
        }}
    >
        <input
            name="attribute"
            list="finder-lab-attributes"
            placeholder="Attribute uid"
            aria-label="Attribute to add"
            className="min-w-0 flex-1 font-mono"
        />
        <button type="submit">Add</button>
    </form>
)

/** How the finder's parts are put together: its forms and fields, the hint, and the results. */
export const CompositionControls = ({
    composition,
    known,
    onChange,
}: {
    composition: LabComposition
    known: KnownAttribute[]
    onChange: (composition: LabComposition) => void
}) => {
    const set = <K extends keyof LabComposition>(
        key: K,
        value: LabComposition[K]
    ) => onChange({ ...composition, [key]: value })
    const setForm = (index: number, fields: LabField[]) =>
        set(
            'forms',
            composition.forms.map((each, at) => (at === index ? fields : each))
        )
    return (
        <Section title="Composition">
            <datalist id="finder-lab-attributes">
                {known.map(({ id, label }) => (
                    <option key={id} value={id}>
                        {label}
                    </option>
                ))}
            </datalist>
            {composition.forms.map((fields, formIndex) => (
                <div key={formIndex} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between font-medium">
                        FinderForm {formIndex + 1}
                        {composition.forms.length > 1 ? (
                            <button
                                type="button"
                                onClick={() =>
                                    set(
                                        'forms',
                                        composition.forms.filter(
                                            (_, at) => at !== formIndex
                                        )
                                    )
                                }
                            >
                                Remove form
                            </button>
                        ) : null}
                    </div>
                    <ol className="m-0 flex list-none flex-col gap-1 p-0">
                        {fields.map((field, index) => (
                            <FieldEditor
                                key={index}
                                field={field}
                                known={known}
                                first={index === 0}
                                last={index === fields.length - 1}
                                onChange={(next) =>
                                    setForm(
                                        formIndex,
                                        fields.map((each, at) =>
                                            at === index ? next : each
                                        )
                                    )
                                }
                                onMove={(by) =>
                                    setForm(formIndex, move(fields, index, by))
                                }
                                onRemove={() =>
                                    setForm(
                                        formIndex,
                                        fields.filter((_, at) => at !== index)
                                    )
                                }
                            />
                        ))}
                    </ol>
                    <AddField
                        onAdd={(attribute) =>
                            setForm(formIndex, [
                                ...fields,
                                { attribute, range: false },
                            ])
                        }
                    />
                </div>
            ))}
            <button
                type="button"
                className="self-start"
                onClick={() => set('forms', [...composition.forms, []])}
            >
                Add a form
            </button>
            <SelectRow
                label="Forms"
                value={composition.formLayout}
                options={FORM_LAYOUTS}
                onChange={(value) => set('formLayout', value)}
            />
            <Check
                checked={composition.hint}
                onChange={(on) => set('hint', on)}
            >
                FinderHint
            </Check>
            <Check
                checked={composition.hookFields}
                onChange={(on) => set('hookFields', on)}
            >
                Fields and submit from hooks
            </Check>
            <SelectRow
                label="Results"
                value={composition.results}
                options={RESULTS_LAYOUTS}
                onChange={(value) => set('results', value)}
            />
            {composition.results === 'custom' ? (
                <Check
                    checked={composition.customTexts}
                    onChange={(on) => set('customTexts', on)}
                >
                    Own state texts
                </Check>
            ) : null}
            {composition.results === 'custom' ||
            composition.results === 'hooks' ? (
                <>
                    <span className={muted}>Row shows</span>
                    {known.map(({ id, label }) => (
                        <Check
                            key={id}
                            checked={composition.rowAttributes.includes(id)}
                            onChange={(on) =>
                                set(
                                    'rowAttributes',
                                    on
                                        ? [...composition.rowAttributes, id]
                                        : composition.rowAttributes.filter(
                                              (each) => each !== id
                                          )
                                )
                            }
                        >
                            {label}
                        </Check>
                    ))}
                </>
            ) : null}
        </Section>
    )
}

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
        <details className="rounded-md border border-border">
            <summary className="cursor-pointer px-2 py-1">
                <span className="font-medium">{attribute.label}</span>{' '}
                <code className={muted}>{attribute.valueType}</code>
                <span className={`block ${muted}`}>{flags(attribute)}</span>
            </summary>
            <div className="flex flex-col gap-1.5 border-t border-border p-2">
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
                <span className={muted}>Blocked operators</span>
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
                <button type="button" className="self-start" onClick={onRemove}>
                    Remove attribute
                </button>
            </div>
        </details>
    )
}

/** The lab program's search rules and attributes, as DHIS2 metadata would set them. */
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
            <span className={muted}>Attributes, in metadata order</span>
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
                className="self-start"
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

/** What the fake server answers: how many people match, and its calendar. */
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
        <Section title="Server">
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
            <SelectRow
                label="Search answers"
                value={server.search}
                options={SEARCH_ANSWERS}
                onChange={(value) => set('search', value)}
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
