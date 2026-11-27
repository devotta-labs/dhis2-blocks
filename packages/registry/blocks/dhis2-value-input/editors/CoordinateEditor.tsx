import i18n from '@dhis2/d2-i18n'
import { useId, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import {
    coordinateNumber,
    parseCoordinate,
    parseTyped,
} from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import type { FormEditorProps, PopupEditorProps } from './popupEditors'
import { EditorButtons, idList, saveOnCtrlEnter } from './EditorButtons'

type Axis = 'latitude' | 'longitude'
type Texts = Record<Axis, string>

const AXES: ReadonlyArray<Axis> = ['latitude', 'longitude']

const DECIMAL_COMMA = /^\s*-?\d+,\d+\s*$/

const wholeIn = (text: string, settings: ValueSettings) => {
    if (DECIMAL_COMMA.test(text)) {
        return undefined
    }
    const typed = parseTyped({ valueType: 'COORDINATE' }, text, settings)
    return typed.ok && typed.value !== undefined
        ? parseCoordinate(typed.value)
        : undefined
}

const read = (texts: Texts, settings: ValueSettings) => {
    if (AXES.every((axis) => texts[axis].trim() === '')) {
        return { value: null, wrong: [] }
    }
    for (const axis of AXES) {
        const whole = wholeIn(texts[axis], settings)
        if (whole !== undefined) {
            return {
                value: `[${whole.longitude},${whole.latitude}]`,
                wrong: [],
            }
        }
    }
    const numbers = {
        latitude: coordinateNumber('latitude', texts.latitude),
        longitude: coordinateNumber('longitude', texts.longitude),
    }
    const { latitude, longitude } = numbers
    if (latitude !== undefined && longitude !== undefined) {
        return { value: `[${longitude},${latitude}]`, wrong: [] }
    }
    return {
        value: null,
        wrong: AXES.filter((axis) => numbers[axis] === undefined),
    }
}

/** The two fields' texts, each change reported; a refused save marks the fields that are wrong. */
const useCoordinate = ({
    value,
    settings,
    save,
    report,
}: Pick<PopupEditorProps, 'value' | 'settings' | 'save' | 'report'>) => {
    const id = useId()
    const messages = {
        latitude: i18n.t('Enter a latitude between -90 and 90'),
        longitude: i18n.t('Enter a longitude between -180 and 180'),
    }
    // The stored value is [lng,lat]; one that is not shows empty fields.
    const [texts, setTexts] = useState<Texts>(() => {
        const read = value === undefined ? undefined : parseCoordinate(value)
        return {
            latitude: read?.latitude ?? '',
            longitude: read?.longitude ?? '',
        }
    })
    // The fields a refused save found wrong, until the next change.
    const [shown, setShown] = useState<ReadonlyArray<Axis>>([])
    const [beforeFill, setBeforeFill] = useState<Texts>()

    const show = (next: Texts) => {
        setTexts(next)
        setShown([])
        const { value: reading, wrong } = read(next, settings)
        report(
            reading,
            wrong.length === 0
                ? undefined
                : {
                      message: messages[wrong[0]],
                      // As a coordinate is typed in a cell or pasted.
                      text: `${next.latitude.trim()}, ${next.longitude.trim()}`,
                  }
        )
    }
    const change = (axis: Axis, text: string) => {
        setBeforeFill(undefined)
        show({ ...texts, [axis]: text })
    }
    const paste = (event: ClipboardEvent) => {
        const whole = wholeIn(event.clipboardData.getData('text'), settings)
        if (whole !== undefined) {
            event.preventDefault()
            setBeforeFill(texts)
            show(whole)
        }
    }
    const undo = (event: KeyboardEvent) => {
        if (
            beforeFill !== undefined &&
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            event.key.toLowerCase() === 'z'
        ) {
            event.preventDefault()
            setBeforeFill(undefined)
            show(beforeFill)
        }
    }
    const spread = (axis: Axis) => {
        const whole = wholeIn(texts[axis], settings)
        if (whole !== undefined) {
            setTexts(whole)
        }
    }
    const commit = () => {
        const { value: reading, wrong } = read(texts, settings)
        if (wrong.length === 0) {
            save(reading)
            return
        }
        setShown(wrong)
        document.getElementById(`${id}-${wrong[0]}`)?.focus()
    }
    return { id, messages, texts, shown, change, paste, undo, spread, commit }
}

/** One axis: its label, its field, and the message of a refused save. Classes size it for a dialog or a form. */
const CoordinateAxis = ({
    editor: { id, messages, texts, shown, change, paste, undo, spread, commit },
    axis,
    describedBy,
    invalid = false,
    className,
    inputClassName,
    problemClassName,
}: {
    editor: ReturnType<typeof useCoordinate>
    axis: Axis
    describedBy?: string
    invalid?: boolean
    className?: string
    inputClassName?: string
    problemClassName: string
}) => {
    const labels = {
        latitude: i18n.t('Latitude'),
        longitude: i18n.t('Longitude'),
    }
    const wrong = shown.includes(axis)
    return (
        <div className={cn('flex flex-col gap-1', className)}>
            <Label htmlFor={`${id}-${axis}`}>{labels[axis]}</Label>
            <Input
                id={`${id}-${axis}`}
                value={texts[axis]}
                // Signed decimals, in order on a right-to-left page too.
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid || wrong ? true : undefined}
                aria-describedby={idList(
                    wrong && `${id}-${axis}-problem`,
                    describedBy
                )}
                onChange={({ target }) => change(axis, target.value)}
                onPaste={paste}
                onBlur={() => spread(axis)}
                onKeyDown={(event) => {
                    undo(event)
                    saveOnCtrlEnter(commit)(event)
                }}
                className={cn('rtl:text-right', inputClassName)}
            />
            {wrong ? (
                <p
                    id={`${id}-${axis}-problem`}
                    role="alert"
                    className={cn('text-dhis2-destructive', problemClassName)}
                >
                    {messages[axis]}
                </p>
            ) : null}
        </div>
    )
}

/**
 * A coordinate as a latitude and a longitude field (no map, no location from the device), saved as `[lng,lat]`. A whole
 * coordinate typed or pasted in either field (`8.4871, -13.2356`, `8°29'13.6"N 13°14'08.2"W`, a maps link) fills both,
 * at once when pasted, replacing what they held (undo brings it back), and when the field is left when typed. One
 * number with a decimal comma (`8,48`) is that axis's number, not a pair. Each change is reported, not saved: Save, Ctrl+Enter or ⌘+Enter saves it, and numbers out of range keep the editor open
 * with a message for each field that is wrong. Both fields empty save no value.
 */
export const CoordinateEditor = (props: PopupEditorProps) => {
    const editor = useCoordinate(props)
    return (
        <>
            {AXES.map((axis) => (
                <CoordinateAxis
                    key={axis}
                    editor={editor}
                    axis={axis}
                    inputClassName="h-(--dhis2-field-height-dense)"
                    problemClassName="text-xs"
                />
            ))}
            <EditorButtons save={editor.commit} cancel={props.cancel} />
        </>
    )
}

/** A coordinate in a form: latitude and longitude side by side, wrapping when there is no room. */
export const CoordinateFormEditor = (props: FormEditorProps) => {
    const editor = useCoordinate(props)
    return (
        <div className="flex flex-wrap gap-2">
            {AXES.map((axis) => (
                <CoordinateAxis
                    key={axis}
                    editor={editor}
                    axis={axis}
                    describedBy={props.describedBy}
                    invalid={props.invalid}
                    className="w-full max-w-40"
                    problemClassName="text-sm"
                />
            ))}
        </div>
    )
}
