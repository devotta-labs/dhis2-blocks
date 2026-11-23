import i18n from '@dhis2/d2-i18n'
import { useId, useState } from 'react'
import {
    coordinateNumber,
    parseCoordinate,
} from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import type { FormEditorProps, PopupEditorProps } from './popupEditors'
import { EditorButtons, idList, saveOnCtrlEnter } from './EditorButtons'

type Axis = 'latitude' | 'longitude'
type Texts = Record<Axis, string>

const AXES: ReadonlyArray<Axis> = ['latitude', 'longitude']

const rangeMessage = (axis: Axis) =>
    axis === 'latitude'
        ? i18n.t('Enter a latitude between -90 and 90')
        : i18n.t('Enter a longitude between -180 and 180')

const read = (texts: Texts) => {
    if (AXES.every((axis) => texts[axis].trim() === '')) {
        return { value: null, wrong: [] }
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

const useCoordinate = ({
    value,
    save,
    report,
}: Pick<PopupEditorProps, 'value' | 'save' | 'report'>) => {
    const id = useId()
    const [texts, setTexts] = useState<Texts>(() => {
        const read = value === undefined ? undefined : parseCoordinate(value)
        return {
            latitude: read?.latitude ?? '',
            longitude: read?.longitude ?? '',
        }
    })
    const [shown, setShown] = useState<ReadonlyArray<Axis>>([])

    const change = (axis: Axis, text: string) => {
        const next = { ...texts, [axis]: text }
        setTexts(next)
        setShown([])
        const { value: reading, wrong } = read(next)
        report(
            reading,
            wrong.length === 0
                ? undefined
                : {
                      message: rangeMessage(wrong[0]),
                      text: `${next.latitude.trim()}, ${next.longitude.trim()}`,
                  }
        )
    }
    const commit = () => {
        const { value: reading, wrong } = read(texts)
        if (wrong.length === 0) {
            save(reading)
            return
        }
        setShown(wrong)
        document.getElementById(`${id}-${wrong[0]}`)?.focus()
    }
    return { id, texts, shown, change, commit }
}

const CoordinateAxis = ({
    editor: { id, texts, shown, change, commit },
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
    const wrong = shown.includes(axis)
    return (
        <div className={cn('flex flex-col gap-1', className)}>
            <Label htmlFor={`${id}-${axis}`}>
                {axis === 'latitude' ? i18n.t('Latitude') : i18n.t('Longitude')}
            </Label>
            <Input
                id={`${id}-${axis}`}
                value={texts[axis]}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid || wrong ? true : undefined}
                aria-describedby={idList(
                    wrong && `${id}-${axis}-problem`,
                    describedBy
                )}
                onChange={({ target }) => change(axis, target.value)}
                onKeyDown={saveOnCtrlEnter(commit)}
                className={cn('rtl:text-right', inputClassName)}
            />
            {wrong ? (
                <p
                    id={`${id}-${axis}-problem`}
                    role="alert"
                    className={cn('text-dhis2-destructive', problemClassName)}
                >
                    {rangeMessage(axis)}
                </p>
            ) : null}
        </div>
    )
}

/**
 * A coordinate as a latitude and a longitude field (no map, no location from the device), saved as `[lng,lat]`. Each
 * change is reported, not saved: Save, Ctrl+Enter or ⌘+Enter saves it, and numbers out of range keep the editor open
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
