import i18n from '@dhis2/d2-i18n'
import { useId, useState } from 'react'
import { coordinateNumber } from '@/components/dhis2-value-types'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import type { PopupEditorProps } from '../popupEditors'
import { EditorButtons, saveOnCtrlEnter } from './EditorButtons'

type Axis = 'latitude' | 'longitude'
type Texts = Record<Axis, string>

const AXES: ReadonlyArray<Axis> = ['latitude', 'longitude']

/** What the fields would save as `[lng,lat]` (null clears), and the fields whose number is wrong. */
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

/**
 * A coordinate as a latitude and a longitude field (no map, no location from the device), saved as `[lng,lat]`. Each
 * change is reported, not saved: Save, Ctrl+Enter or ⌘+Enter saves it, and numbers out of range keep the editor open
 * with a message for each field that is wrong. Both fields empty save no value.
 */
export const CoordinateEditor = ({
    value,
    save,
    report,
    cancel,
}: PopupEditorProps) => {
    const id = useId()
    const messages = {
        latitude: i18n.t('Enter a latitude between -90 and 90'),
        longitude: i18n.t('Enter a longitude between -180 and 180'),
    }
    const labels = {
        latitude: i18n.t('Latitude'),
        longitude: i18n.t('Longitude'),
    }
    // The stored value is [lng,lat]; one that is not shows empty fields.
    const [longitude, latitude] = value?.match(/-?\d+(?:\.\d+)?/g) ?? []
    const [texts, setTexts] = useState<Texts>({
        latitude: latitude ?? '',
        longitude: longitude ?? '',
    })
    // The fields a refused save found wrong, until the next change.
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
                      message: messages[wrong[0]],
                      // As a coordinate is typed in a cell or pasted.
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
        // Back to the first field a message is about, whether Save was clicked or Ctrl+Enter pressed.
        document.getElementById(`${id}-${wrong[0]}`)?.focus()
    }
    return (
        <>
            {AXES.map((axis) => (
                <div key={axis} className="flex flex-col gap-1">
                    <Label htmlFor={`${id}-${axis}`}>{labels[axis]}</Label>
                    <Input
                        id={`${id}-${axis}`}
                        value={texts[axis]}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={shown.includes(axis) ? true : undefined}
                        aria-describedby={
                            shown.includes(axis)
                                ? `${id}-${axis}-problem`
                                : undefined
                        }
                        onChange={({ target }) => change(axis, target.value)}
                        onKeyDown={saveOnCtrlEnter(commit)}
                        className="h-(--dhis2-field-height-dense)"
                    />
                    {shown.includes(axis) ? (
                        <p
                            id={`${id}-${axis}-problem`}
                            role="alert"
                            className="text-xs text-dhis2-red-700"
                        >
                            {messages[axis]}
                        </p>
                    ) : null}
                </div>
            ))}
            <EditorButtons save={commit} cancel={cancel} />
        </>
    )
}
