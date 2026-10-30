import { useState, type ReactNode } from 'react'

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

/** A number field; `suffix` names the unit ("%", "ms"). */
export const NumberRow = ({
    label,
    value,
    onChange,
    min = 0,
    max = Infinity,
    suffix,
}: {
    label: string
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    suffix?: string
}) => {
    // While typing, the field keeps the text as typed and applies it once it is in range; leaving the field or
    // pressing Enter clamps whatever is left.
    const [draft, setDraft] = useState<string>()
    const parse = (text: string) =>
        text.trim() === '' ? undefined : Number(text)
    const commit = () => {
        const next = draft === undefined ? undefined : parse(draft)
        if (next !== undefined && Number.isFinite(next)) {
            onChange(Math.min(max, Math.max(min, next)))
        }
        setDraft(undefined)
    }
    return (
        <label className="flex items-center justify-between gap-2 text-sm">
            {label}
            <span className="flex items-center gap-1">
                <input
                    type="number"
                    min={min}
                    max={Number.isFinite(max) ? max : undefined}
                    value={draft ?? value}
                    onChange={(event) => {
                        setDraft(event.target.value)
                        const next = parse(event.target.value)
                        if (next !== undefined && next >= min && next <= max) {
                            onChange(next)
                        }
                    }}
                    onBlur={commit}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') commit()
                    }}
                    className={`${box} w-20 text-end tabular-nums`}
                />
                {suffix ? (
                    <span className="w-5 text-dhis2-grey-700">{suffix}</span>
                ) : null}
            </span>
        </label>
    )
}

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
            onChange={(event) =>
                onChange(
                    options.find(
                        ([option]) => option === event.target.value
                    )?.[0] ?? value
                )
            }
            className={box}
        >
            {options.map(([option, text]) => (
                <option key={option} value={option}>
                    {text}
                </option>
            ))}
        </select>
    </label>
)

export const Segmented = <T extends string>({
    value,
    options,
    onChange,
}: {
    value: T
    options: ReadonlyArray<readonly [T, string, ...string[]]>
    onChange: (value: T) => void
}) => (
    <div className="flex rounded border border-dhis2-grey-500 text-sm">
        {options.map(([option, label]) => (
            <button
                key={option}
                type="button"
                aria-pressed={value === option}
                onClick={() => onChange(option)}
                className="flex-1 px-2 py-1 aria-pressed:bg-dhis2-blue-700 aria-pressed:text-white"
            >
                {label}
            </button>
        ))}
    </div>
)
