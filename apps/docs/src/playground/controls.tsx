import { useState, type ReactNode } from 'react'

export const Section = ({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) => (
    <fieldset className="flex flex-col gap-1">
        <legend>{title}</legend>
        {children}
    </fieldset>
)

/** A collapsible group inside a section; its summary says what it holds. */
export const Disclosure = ({
    summary,
    defaultOpen = false,
    children,
}: {
    summary: ReactNode
    defaultOpen?: boolean
    children: ReactNode
}) => (
    <details open={defaultOpen}>
        <summary>{summary}</summary>
        <div className="flex flex-col gap-1">{children}</div>
    </details>
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
    <label className="flex items-center gap-2">
        <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
        />
        {children}
    </label>
)

/** A number field that applies typed values once they are in range. */
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
        <label className="flex items-center justify-between gap-2">
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
                    className="w-20 text-end"
                />
                <span className="w-5 text-(--lab-ink-3)">{suffix}</span>
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
    <label className="flex items-center justify-between gap-2">
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
            className="max-w-40"
        >
            {options.map(([option, name]) => (
                <option key={option} value={option}>
                    {name}
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
    options: ReadonlyArray<readonly [T, string]>
    onChange: (value: T) => void
}) => (
    <div className="flex border border-(--lab-ink)">
        {options.map(([option, name]) => (
            <button
                key={option}
                type="button"
                aria-pressed={value === option}
                className="flex-1 border-0"
                onClick={() => onChange(option)}
            >
                {name}
            </button>
        ))}
    </div>
)

/** A lab's named presets, grouped. */
export const PresetControls = <P extends { group: string; name: string }>({
    presets,
    selected,
    onPick,
}: {
    presets: readonly P[]
    selected?: string
    onPick: (preset: P) => void
}) => (
    <Section title="Presets">
        <div className="flex flex-col gap-3">
            {[...new Set(presets.map(({ group }) => group))].map((group) => (
                <div key={group} className="flex flex-wrap gap-1">
                    <span className="w-full text-[10px] tracking-[0.1em] text-(--lab-ink-3) uppercase">
                        {group}
                    </span>
                    {presets
                        .filter((each) => each.group === group)
                        .map((each) => (
                            <button
                                key={each.name}
                                type="button"
                                aria-pressed={selected === each.name}
                                className="tracking-normal normal-case"
                                onClick={() => onPick(each)}
                            >
                                {each.name}
                            </button>
                        ))}
                </div>
            ))}
        </div>
    </Section>
)
