import i18n from '@dhis2/d2-i18n'
import { memo, useState } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import { Button } from '@/components/dhis2/ui/button'
import { ValueInput } from '@/components/dhis2-value-input'
import type { ValueInputProps } from '@/components/dhis2-value-input'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type { EventFormValue } from '../hooks/useEventForm'
import { formatDistance, plausibility } from '../lib/location'
import type { PlaceOrgUnit } from '../lib/location'
import { LOCATION } from '../lib/validate'

type Message = NonNullable<ValueInputProps['messages']>[number]

const COORDINATE: Field = { valueType: 'COORDINATE' }
const TEXT: Field = { valueType: 'TEXT' }

// Names are text, not HTML.
const AS_IS = { interpolation: { escapeValue: false } }

/** Degrees to six places, about 10 cm, as a coordinate is stored. */
const degrees = (value: number) => String(Number(value.toFixed(6)))

/** Why the browser gave no location, in words. */
const refusal = (error: GeolocationPositionError) => {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return i18n.t(
                'Your location is blocked for this site. Allow it in the browser’s site settings, or type the coordinates.'
            )
        case error.TIMEOUT:
            return i18n.t(
                'Finding your location took too long. Try again, or type the coordinates.'
            )
        default:
            return i18n.t(
                'Your device could not find your location. Try again, or type the coordinates.'
            )
    }
}

interface LocationFieldProps {
    /** The control's id: `${formId}-geometry`. */
    id: string
    /** The point as `[lng,lat]`. */
    value?: string
    orgUnit?: PlaceOrgUnit
    settings: ValueSettings
    serverErrors?: readonly string[]
    readOnly?: string
    /** `'held'`: locked only for now, so the buttons stay, unable to change it. */
    readOnlyReason: ValueInputProps['readOnlyReason']
    commit: EventFormValue['commit']
    /** How far from a point org unit, in kilometres, before the form warns; absent, the point is not checked. */
    warnKm?: number
}

/**
 * The event's point: typed or pasted, the device's location on request, or the org unit's own, and with `warnKm` how
 * far it is from the org unit. Not required, and never held back for being far.
 */
export const LocationField = memo(
    ({
        id,
        value,
        orgUnit,
        settings,
        serverErrors,
        readOnly,
        readOnlyReason,
        commit,
        warnKm,
    }: LocationFieldProps) => {
        // What the last press of "Use my location" said, shown while the field holds what it was said of.
        const [note, setNote] = useState<Message & { of?: string }>()
        const [finding, setFinding] = useState(false)
        const change = commit(LOCATION)
        const locate = () => {
            // Absent where the browser has none, or the page is not served securely.
            if (!('geolocation' in navigator)) {
                setNote({
                    tone: 'warning',
                    text: i18n.t(
                        'This browser cannot give your location. Type the coordinates instead.'
                    ),
                    of: value,
                })
                return
            }
            setFinding(true)
            announce(i18n.t('Finding your location…'))
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    const found = `[${degrees(coords.longitude)},${degrees(coords.latitude)}]`
                    const text = i18n.t('Your location, within {{distance}}', {
                        distance: formatDistance(coords.accuracy / 1000),
                    })
                    setFinding(false)
                    setNote({ tone: 'info', text, of: found })
                    change(found)
                    announce(text)
                },
                (error) => {
                    setFinding(false)
                    setNote({
                        tone: 'warning',
                        text: refusal(error),
                        of: value,
                    })
                },
                {
                    enableHighAccuracy: true,
                    timeout: 30_000,
                    maximumAge: 60_000,
                }
            )
        }
        const unitPoint =
            orgUnit?.geometry?.type === 'Point'
                ? orgUnit.geometry.coordinates
                : undefined

        const messages: Message[] = (serverErrors ?? []).map((text) => ({
            tone: 'error',
            text,
        }))
        if (note !== undefined && note.of === value) {
            messages.push({ tone: note.tone, text: note.text })
        }
        const fit =
            warnKm === undefined
                ? undefined
                : plausibility(value, orgUnit, warnKm)
        if (fit !== undefined) {
            messages.push(fit)
        }
        return (
            <div className="flex flex-col gap-2">
                <ValueInput
                    id={id}
                    field={COORDINATE}
                    settings={settings}
                    label={i18n.t('Location')}
                    value={value}
                    onChange={change}
                    readOnly={readOnly}
                    readOnlyReason={readOnlyReason}
                    messages={messages}
                />
                {readOnly === undefined || readOnlyReason === 'held' ? (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={finding || readOnly !== undefined}
                            focusableWhenDisabled
                            onClick={locate}
                        >
                            {finding
                                ? i18n.t('Finding your location…')
                                : i18n.t('Use my location')}
                        </Button>
                        {unitPoint === undefined ||
                        orgUnit === undefined ? null : (
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={readOnly !== undefined}
                                focusableWhenDisabled
                                onClick={() => {
                                    setNote(undefined)
                                    change(`[${unitPoint[0]},${unitPoint[1]}]`)
                                }}
                            >
                                {i18n.t('At {{name}}', {
                                    ...AS_IS,
                                    name: orgUnit.name,
                                })}
                            </Button>
                        )}
                    </div>
                ) : null}
            </div>
        )
    }
)

/** A stored area, shown as recorded and sent back as it is: this form draws no areas. */
export const AreaField = ({
    id,
    settings,
    readOnly,
}: {
    id: string
    settings: ValueSettings
    readOnly?: string
}) => (
    <ValueInput
        id={id}
        field={TEXT}
        settings={settings}
        label={i18n.t('Location')}
        value={i18n.t('Area recorded')}
        onChange={() => {}}
        readOnly={readOnly ?? i18n.t('This form cannot change an area')}
    />
)
