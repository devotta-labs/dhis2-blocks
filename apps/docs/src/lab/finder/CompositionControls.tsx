import {
    FORM_LAYOUTS,
    RESULTS_LAYOUTS,
    type LabComposition,
    type LabField,
} from './labConfig'
import {
    box,
    Check,
    Section,
    SelectRow,
    TextRow,
    type KnownAttribute,
} from './controls'

const iconButton =
    'rounded px-1 text-dhis2-grey-700 hover:bg-dhis2-grey-200 disabled:opacity-30'

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
        <li className="flex flex-col gap-1 rounded border border-dhis2-grey-300 bg-white p-1.5">
            <div className="flex items-center gap-1">
                <select
                    aria-label="Attribute"
                    value={field.attribute}
                    onChange={(event) =>
                        onChange({ ...field, attribute: event.target.value })
                    }
                    className={`${box} min-w-0 flex-1`}
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
                    className={iconButton}
                    onClick={() => onMove(-1)}
                >
                    ↑
                </button>
                <button
                    type="button"
                    aria-label="Move down"
                    disabled={last}
                    className={iconButton}
                    onClick={() => onMove(1)}
                >
                    ↓
                </button>
                <button
                    type="button"
                    aria-label="Remove field"
                    className={iconButton}
                    onClick={onRemove}
                >
                    ×
                </button>
            </div>
            <div className="flex items-center gap-3">
                <Check
                    checked={field.range}
                    onChange={(range) => onChange({ ...field, range })}
                >
                    Range
                </Check>
                <details className="text-xs">
                    <summary className="cursor-pointer text-dhis2-grey-700">
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
            </div>
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
            list="lab-known-attributes"
            placeholder="Attribute uid"
            aria-label="Attribute to add"
            className={`${box} min-w-0 flex-1 font-mono`}
        />
        <button
            type="submit"
            className="rounded border border-dhis2-grey-500 px-2 text-sm"
        >
            Add
        </button>
    </form>
)

const move = <T,>(items: T[], from: number, by: -1 | 1) => {
    const next = [...items]
    const [item] = next.splice(from, 1)
    next.splice(from + by, 0, item)
    return next
}

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
            <datalist id="lab-known-attributes">
                {known.map(({ id, label }) => (
                    <option key={id} value={id}>
                        {label}
                    </option>
                ))}
            </datalist>
            {composition.forms.map((fields, formIndex) => (
                <div key={formIndex} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm font-medium">
                        FinderForm {formIndex + 1}
                        {composition.forms.length > 1 ? (
                            <button
                                type="button"
                                className="text-xs font-normal text-dhis2-red-700 underline"
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
                    <ol className="flex flex-col gap-1">
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
                className="self-start text-sm text-dhis2-blue-700 underline"
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
                    <span className="text-xs text-dhis2-grey-700">
                        Row shows
                    </span>
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
