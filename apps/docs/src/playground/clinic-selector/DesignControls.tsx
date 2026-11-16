import { useState } from 'react'
import { Check } from '../controls'
import {
    changedControls,
    DESIGN_DEFAULTS,
    DESIGN_GROUPS,
    designSpec,
    type DesignControl,
    type DesignForce,
    type DesignValues,
} from './design'

const WEIGHTS = [400, 500, 600, 700]
const ALIGNMENTS = ['flex-start', 'center', 'flex-end']
const field =
    'w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-xs text-foreground'

const Control = ({
    control,
    value,
    onChange,
}: {
    control: DesignControl
    value: number | string
    onChange: (value: number | string) => void
}) => {
    const changed = value !== control.initial
    const id = `design-${control.key}`
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-2 gap-y-0.5">
            <label
                htmlFor={id}
                className={
                    changed
                        ? 'col-span-2 text-xs font-medium text-foreground'
                        : 'col-span-2 text-xs text-muted-foreground'
                }
            >
                {control.label}
                {changed && ` (was ${control.initial})`}
            </label>
            {control.kind === 'px' && (
                <>
                    <input
                        type="range"
                        aria-label={control.label}
                        min={control.min}
                        max={control.max}
                        value={Number(value)}
                        onChange={(event) =>
                            onChange(Number(event.target.value))
                        }
                    />
                    <input
                        id={id}
                        type="number"
                        min={0}
                        className={field}
                        value={Number(value)}
                        onChange={(event) => {
                            const next = Number(event.target.value)
                            if (event.target.value !== '' && next >= 0) {
                                onChange(next)
                            }
                        }}
                    />
                </>
            )}
            {control.kind === 'colour' && (
                <>
                    <input
                        type="color"
                        aria-label={control.label}
                        className="h-6 w-full"
                        value={String(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                    <input
                        id={id}
                        type="text"
                        spellCheck={false}
                        className={field}
                        defaultValue={String(value)}
                        key={String(value)}
                        onChange={(event) => {
                            if (/^#[0-9a-f]{6}$/i.test(event.target.value)) {
                                onChange(event.target.value.toLowerCase())
                            }
                        }}
                    />
                </>
            )}
            {(control.kind === 'weight' || control.kind === 'align') && (
                <select
                    id={id}
                    className={`${field} col-span-2`}
                    value={String(value)}
                    onChange={(event) =>
                        onChange(
                            control.kind === 'weight'
                                ? Number(event.target.value)
                                : event.target.value
                        )
                    }
                >
                    {(control.kind === 'weight' ? WEIGHTS : ALIGNMENTS).map(
                        (option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        )
                    )}
                </select>
            )}
        </div>
    )
}

/** Sliders over the real selector's design values, and the text to paste back once they look right. */
export const DesignControls = ({
    values,
    force,
    keepOpen,
    onChange,
    onForce,
    onKeepOpen,
}: {
    values: DesignValues
    force: DesignForce
    keepOpen: boolean
    onChange: (values: DesignValues) => void
    onForce: (force: DesignForce) => void
    onKeepOpen: (keepOpen: boolean) => void
}) => {
    const [copied, setCopied] = useState<string>()
    const changed = changedControls(values)
    const spec = designSpec(values)
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(spec)
            setCopied('Copied')
        } catch {
            setCopied('Could not copy: select the text below')
        }
    }
    return (
        <fieldset className="flex flex-col gap-2">
            <legend>Design</legend>
            <p className="m-0 text-xs text-muted-foreground">
                These change the selector on the canvas itself. Pick any
                example, tune it, then copy the values.
            </p>
            <Check checked={keepOpen} onChange={onKeepOpen}>
                Keep the menu open
            </Check>
            <Check
                checked={force.hovered}
                onChange={(hovered) => onForce({ ...force, hovered })}
            >
                Show the trigger hovered
            </Check>
            <Check
                checked={force.focused}
                onChange={(focused) => onForce({ ...force, focused })}
            >
                Show the trigger focused
            </Check>
            {DESIGN_GROUPS.map((group) => {
                const count = group.controls.filter((control) =>
                    changed.includes(control)
                ).length
                return (
                    <details key={group.title}>
                        <summary className="cursor-pointer text-sm">
                            {group.title}
                            {count > 0 && ` (${count} changed)`}
                        </summary>
                        <div className="flex flex-col gap-2 pt-2 pb-1">
                            {group.controls.map((control) => (
                                <Control
                                    key={control.key}
                                    control={control}
                                    value={
                                        values[control.key] ?? control.initial
                                    }
                                    onChange={(value) => {
                                        setCopied(undefined)
                                        onChange({
                                            ...values,
                                            [control.key]: value,
                                        })
                                    }}
                                />
                            ))}
                        </div>
                    </details>
                )
            })}
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void copy()}>
                    Copy values
                </button>
                <button type="button" onClick={() => onChange(DESIGN_DEFAULTS)}>
                    Reset
                </button>
                <span role="status" className="text-xs">
                    {copied ?? `${changed.length} changed`}
                </span>
            </div>
            <textarea
                readOnly
                aria-label="Design values to paste back"
                className={`${field} h-28`}
                value={spec}
            />
        </fieldset>
    )
}
