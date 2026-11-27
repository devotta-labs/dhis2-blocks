import i18n from '@dhis2/d2-i18n'
import { IconCross16 } from '@dhis2/ui-icons'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/dhis2/ui/input-group'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { LocationMap, pointOf, type Position } from '@/components/location-map'
import { LocateIcon, MapIcon } from './icons'
import { MapPanel, useNarrow } from './MapPanel'
import { pointNotes, type Note } from './notes'
import { pointPlace } from './place'
import { FIELD_BUTTON, keepFocus, Notes, PanelFooter } from './parts'
import { PlaceSearch } from './PlaceSearch'
import { positionText, readPoint } from './text'
import type { LocationInputProps } from './types'
import { accuracyWords, locateLabel, useFix, type Fix } from './useFix'

// Names are text, not HTML.
const AS_IS = { interpolation: { escapeValue: false } }

const same = (a?: Position, b?: Position) =>
    a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1]

/** A point: typed or pasted, the device's, the org unit's, or placed on the map in a popover. */
export const PointInput = ({
    label,
    value,
    onChange,
    id,
    description,
    required,
    readOnly,
    orgUnit,
    warnKm,
    tiles,
    locator,
    search,
}: Omit<LocationInputProps, 'capture'>) => {
    const ownId = useId()
    const inputId = id ?? ownId
    const point = value?.type === 'Point' ? value.coordinates : undefined
    const shown = point === undefined ? '' : positionText(point)
    const [draft, setDraft] = useState(shown)
    const [wrong, setWrong] = useState(false)
    const [open, setOpen] = useState(false)
    // While the box has focus it holds the coordinates to edit; otherwise it says where the point is, when it can.
    const [focused, setFocused] = useState(false)
    // Where a place found by the search box asks the map to look; dropped when the map closes.
    const [frame, setFrame] = useState<Position[]>()
    // The last fix, said under the field while the point is still where it put it.
    const [lastFix, setLastFix] = useState<Fix>()
    const [problem, setProblem] = useState<string>()
    const input = useRef<HTMLInputElement>(null)
    const body = useRef<HTMLDivElement>(null)
    const narrow = useNarrow()
    const fix = useFix(locator)
    const editable = readOnly === undefined
    // A fix arrives seconds after the press, when the form may have passed a newer `onChange`.
    const report = useRef(onChange)
    report.current = onChange

    // A value from outside replaces what is in the box.
    useEffect(() => {
        setDraft(shown)
        setWrong(false)
    }, [shown])

    const change = (next: Position | null) => {
        setProblem(undefined)
        report.current(next === null ? null : pointOf(next))
    }

    const commit = () => {
        if (!editable) return
        const read = readPoint(draft)
        if (read.kind === 'wrong') {
            setWrong(true)
            return
        }
        setWrong(false)
        if (read.kind === 'empty') {
            if (point !== undefined) change(null)
            return
        }
        setDraft(positionText(read.position))
        if (!same(read.position, point)) change(read.position)
    }

    const locate = () => {
        if (fix.finding) {
            if (fix.accuracyM === undefined) {
                announce(i18n.t('Stopped finding your location'))
            }
            fix.finish()
            return
        }
        setProblem(undefined)
        announce(i18n.t('Finding your location'))
        fix.find(
            (found) => {
                setLastFix(found)
                change(found.position)
                announce(accuracyWords(found.accuracyM))
            },
            (text) => {
                setProblem(text)
                announce(text, 'assertive')
            }
        )
    }

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            commit()
        }
        if (event.key === 'ArrowDown' && event.altKey) {
            event.preventDefault()
            commit()
            setOpen(true)
        }
    }

    const fromFix = lastFix !== undefined && same(lastFix.position, point)
    const place = point === undefined ? undefined : pointPlace(point, orgUnit)
    const said = pointNotes(point, orgUnit, warnKm)
    // A warning is about the coordinates themselves (swapped, outside the org unit), so the box keeps them.
    const warned = said.some(({ tone }) => tone === 'warning')
    let described: string | undefined
    if (place !== undefined && !warned) {
        described = fromFix
            ? i18n.t('Your location · {{place}}', { ...AS_IS, place })
            : place
    }
    const showPlace =
        described !== undefined && !focused && !wrong && draft === shown

    const notes: Note[] = []
    if (problem !== undefined) notes.push({ tone: 'warning', text: problem })
    else if (fix.finding) {
        notes.push({
            tone: 'info',
            text:
                fix.accuracyM === undefined
                    ? i18n.t('Finding your location…')
                    : i18n.t('Finding your location… {{accuracy}}', {
                          accuracy: accuracyWords(fix.accuracyM),
                      }),
        })
    } else {
        if (lastFix !== undefined && same(lastFix.position, point)) {
            notes.push({ tone: 'info', text: accuracyWords(lastFix.accuracyM) })
        }
        // What the box already says is not said again under it; warnings are.
        notes.push(
            ...said.filter(
                ({ tone }) => described === undefined || tone === 'warning'
            )
        )
    }

    const unitPoint =
        orgUnit?.geometry?.type === 'Point'
            ? orgUnit.geometry.coordinates
            : undefined
    const references = orgUnit?.geometry
        ? [{ name: orgUnit.name, geometry: orgUnit.geometry }]
        : []

    return (
        <Field invalid={wrong}>
            <FieldLabel>
                {label}
                {required ? <span aria-hidden="true"> *</span> : null}
            </FieldLabel>
            <InputGroup>
                <InputGroupInput
                    ref={input}
                    id={inputId}
                    value={showPlace ? described : draft}
                    title={showPlace ? shown : undefined}
                    readOnly={!editable}
                    required={required}
                    aria-invalid={wrong || undefined}
                    aria-keyshortcuts="Alt+ArrowDown"
                    autoComplete="off"
                    spellCheck={false}
                    dir={showPlace ? undefined : 'ltr'}
                    inputMode="text"
                    className="tabular-nums"
                    placeholder={
                        editable ? i18n.t('Latitude, longitude') : undefined
                    }
                    onChange={(event) => {
                        setDraft(event.target.value)
                        setWrong(false)
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        commit()
                        setFocused(false)
                    }}
                    onKeyDown={onKeyDown}
                />
                <InputGroupAddon align="inline-end" className="gap-0 pe-1">
                    {editable && draft !== '' ? (
                        <InputGroupButton
                            size="icon-sm"
                            className={FIELD_BUTTON}
                            aria-label={i18n.t('Clear')}
                            onMouseDown={keepFocus}
                            onClick={() => {
                                setDraft('')
                                setWrong(false)
                                if (point !== undefined) {
                                    change(null)
                                    announce(i18n.t('Location cleared'))
                                }
                                input.current?.focus()
                            }}
                        >
                            <IconCross16 />
                        </InputGroupButton>
                    ) : null}
                    {editable ? (
                        <InputGroupButton
                            size="icon-sm"
                            className={FIELD_BUTTON}
                            aria-label={locateLabel(
                                fix,
                                i18n.t('Use my location')
                            )}
                            aria-busy={fix.finding || undefined}
                            onMouseDown={keepFocus}
                            onClick={locate}
                        >
                            {fix.finding ? (
                                <Spinner className="size-4" />
                            ) : (
                                <LocateIcon />
                            )}
                        </InputGroupButton>
                    ) : null}
                    <MapPanel
                        open={open}
                        onOpenChange={(next) => {
                            setOpen(next)
                            if (!next) setFrame(undefined)
                        }}
                        title={label}
                        label={
                            editable
                                ? i18n.t('Open map')
                                : i18n.t('Show on map')
                        }
                        icon={<MapIcon />}
                        field={input}
                        body={body}
                    >
                        <div
                            ref={body}
                            tabIndex={-1}
                            className="flex min-w-0 flex-col outline-none"
                        >
                            {editable && search ? (
                                <PlaceSearch
                                    className="mb-2"
                                    search={search}
                                    onPick={(place) => {
                                        change(place.position)
                                        setFrame(
                                            place.bounds
                                                ? [...place.bounds]
                                                : [place.position]
                                        )
                                        announce(
                                            i18n.t('Point placed at {{name}}', {
                                                ...AS_IS,
                                                name: place.name,
                                            })
                                        )
                                    }}
                                />
                            ) : null}
                            <LocationMap
                                capture="point"
                                value={value}
                                frame={frame}
                                onChange={
                                    editable
                                        ? (next) =>
                                              change(
                                                  next?.type === 'Point'
                                                      ? next.coordinates
                                                      : null
                                              )
                                        : undefined
                                }
                                references={references}
                                here={
                                    lastFix
                                        ? {
                                              position: lastFix.position,
                                              accuracyM: lastFix.accuracyM,
                                          }
                                        : undefined
                                }
                                tiles={tiles}
                                label={label}
                                className={narrow ? 'h-[60dvh]' : undefined}
                            />
                            <PanelFooter
                                summary={
                                    point === undefined
                                        ? i18n.t(
                                              'Click the map to place the point'
                                          )
                                        : (place ?? '')
                                }
                            >
                                {editable &&
                                unitPoint !== undefined &&
                                orgUnit !== undefined ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="min-w-0"
                                        onClick={() => {
                                            change([unitPoint[0], unitPoint[1]])
                                            announce(
                                                i18n.t('At {{name}}', {
                                                    ...AS_IS,
                                                    name: orgUnit.name,
                                                })
                                            )
                                        }}
                                    >
                                        <span className="truncate">
                                            {i18n.t('At {{name}}', {
                                                ...AS_IS,
                                                name: orgUnit.name,
                                            })}
                                        </span>
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    size="sm"
                                    className={cn(narrow && 'flex-1')}
                                    onClick={() => setOpen(false)}
                                >
                                    {i18n.t('Done')}
                                </Button>
                            </PanelFooter>
                        </div>
                    </MapPanel>
                </InputGroupAddon>
            </InputGroup>
            {description === undefined ? null : (
                <FieldDescription>{description}</FieldDescription>
            )}
            {showPlace && point !== undefined ? (
                <FieldDescription className="sr-only">
                    {i18n.t('Latitude {{lat}}, longitude {{lng}}', {
                        lat: String(point[1]),
                        lng: String(point[0]),
                    })}
                </FieldDescription>
            ) : null}
            {readOnly === undefined ? null : (
                <FieldDescription>{readOnly}</FieldDescription>
            )}
            <Notes notes={notes} />
            {wrong ? (
                <FieldError>
                    {i18n.t('Not a coordinate. Type latitude, then longitude.')}
                </FieldError>
            ) : null}
        </Field>
    )
}
