import i18n from '@dhis2/d2-i18n'
import { IconCross16, IconUndo16 } from '@dhis2/ui-icons'
import { useEffect, useRef, useState, type ClipboardEvent } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field,
    FieldDescription,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/dhis2/ui/input-group'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    editableRing,
    LocationMap,
    polygonOf,
    type MapGeometry,
    type Position,
} from '@/components/location-map'
import { LocateIcon, MapIcon } from './icons'
import { MapPanel, useNarrow } from './MapPanel'
import { areaNotes, type Note } from './notes'
import { areaPlace } from './place'
import { FIELD_BUTTON, keepFocus, Notes, PanelFooter } from './parts'
import { PlaceSearch } from './PlaceSearch'
import { areaSummary, readPoints } from './text'
import type { LocationInputProps } from './types'
import { accuracyWords, locateLabel, useFix, type Fix } from './useFix'

const keyOf = (value: MapGeometry | null | undefined) =>
    JSON.stringify(value ?? null)

/**
 * An area: its points added where the user stands, pasted, or drawn on the map in a popover. The box
 * says how many points and how large; fewer than three is not an area, and `onChange` gets `null` until there are.
 */
export const AreaInput = ({
    label,
    value,
    onChange,
    id,
    description,
    required,
    readOnly,
    orgUnit,
    tiles,
    locator,
    search,
}: Omit<LocationInputProps, 'capture' | 'warnKm'>) => {
    const fixed =
        value !== null &&
        value !== undefined &&
        editableRing(value) === undefined
    const stored = editableRing(value) ?? []
    // The points as the user has them, which may be one or two before they make an area.
    const [ring, setRing] = useState<Position[]>(stored)
    const [history, setHistory] = useState<Position[][]>([])
    const [open, setOpen] = useState(false)
    // Where a place found by the search box asks the map to look; dropped when the map closes.
    const [frame, setFrame] = useState<Position[]>()
    const [problem, setProblem] = useState<string>()
    const [lastFix, setLastFix] = useState<Fix>()
    const sent = useRef(keyOf(value))
    const input = useRef<HTMLInputElement>(null)
    const body = useRef<HTMLDivElement>(null)
    const narrow = useNarrow()
    const fix = useFix(locator)
    const editable = readOnly === undefined && !fixed
    // A fix arrives seconds after the press, when the points and `onChange` may have changed.
    const latest = useRef({ ring, onChange })
    latest.current = { ring, onChange }

    // A value from outside, not one this field sent, replaces the points.
    const valueKey = keyOf(value)
    useEffect(() => {
        if (valueKey === sent.current) return
        sent.current = valueKey
        setRing(editableRing(value) ?? [])
        setHistory([])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [valueKey])

    const change = (next: Position[], said?: string) => {
        const was = latest.current.ring
        setProblem(undefined)
        setHistory((before) => [...before, was].slice(-50))
        setRing(next)
        latest.current.ring = next
        const outgoing = next.length >= 3 ? polygonOf(next) : null
        sent.current = keyOf(outgoing)
        latest.current.onChange(outgoing)
        if (said !== undefined) announce(said)
    }

    const undo = () => {
        const previous = history.at(-1)
        if (previous === undefined) return
        setHistory((was) => was.slice(0, -1))
        setRing(previous)
        latest.current.ring = previous
        const outgoing = previous.length >= 3 ? polygonOf(previous) : null
        sent.current = keyOf(outgoing)
        latest.current.onChange(outgoing)
        announce(i18n.t('Undone, {{count}} points', { count: previous.length }))
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
                const now = latest.current.ring
                setLastFix(found)
                change(
                    [...now, found.position],
                    i18n.t('Point {{number}} added, {{accuracy}}', {
                        number: String(now.length + 1),
                        accuracy: accuracyWords(found.accuracyM),
                    })
                )
            },
            (text) => {
                setProblem(text)
                announce(text, 'assertive')
            }
        )
    }

    const pasted = (event: ClipboardEvent<HTMLInputElement>) => {
        if (!editable) return
        event.preventDefault()
        const points = readPoints(event.clipboardData.getData('text'))
        if (points === undefined) {
            setProblem(
                i18n.t('That is not a list of coordinates or a GeoJSON polygon')
            )
            return
        }
        change(
            points.length === 1 ? [...latest.current.ring, ...points] : points,
            i18n.t('{{count}} points pasted', { count: points.length })
        )
    }

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
    } else if (fixed) {
        notes.push({
            tone: 'info',
            text: i18n.t('This area cannot be changed here'),
        })
    } else {
        // Once it is an area, the box says where it is; under it go only the warnings.
        notes.push(
            ...areaNotes(ring, orgUnit).filter(
                ({ tone }) => ring.length < 3 || tone === 'warning'
            )
        )
    }

    const references = orgUnit?.geometry
        ? [{ name: orgUnit.name, geometry: orgUnit.geometry }]
        : []
    const summary = fixed ? i18n.t('Area recorded') : areaSummary(ring)
    let boxText = summary
    if (!fixed && ring.length >= 3) boxText = areaPlace(ring, orgUnit)
    let mapValue: MapGeometry | null = null
    if (fixed) mapValue = value
    else if (ring.length > 0) mapValue = polygonOf(ring)

    return (
        <Field>
            <FieldLabel>
                {label}
                {required ? <span aria-hidden="true"> *</span> : null}
            </FieldLabel>
            <InputGroup>
                <InputGroupInput
                    ref={input}
                    id={id}
                    value={boxText}
                    readOnly
                    required={required}
                    aria-roledescription={i18n.t('area')}
                    autoComplete="off"
                    className="tabular-nums"
                    placeholder={
                        editable
                            ? i18n.t('No area, paste points or use the map')
                            : undefined
                    }
                    onPaste={pasted}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown' && event.altKey) {
                            event.preventDefault()
                            setOpen(true)
                        }
                    }}
                />
                <InputGroupAddon align="inline-end" className="gap-0 pe-1">
                    {editable && ring.length > 0 ? (
                        <InputGroupButton
                            size="icon-sm"
                            className={FIELD_BUTTON}
                            aria-label={i18n.t('Clear')}
                            onMouseDown={keepFocus}
                            onClick={() => {
                                change([], i18n.t('Area cleared'))
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
                                i18n.t('Add my location as a point')
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
                                        setFrame(
                                            place.bounds
                                                ? [...place.bounds]
                                                : [place.position]
                                        )
                                        announce(
                                            i18n.t('Map moved to {{name}}', {
                                                interpolation: {
                                                    escapeValue: false,
                                                },
                                                name: place.name,
                                            })
                                        )
                                    }}
                                />
                            ) : null}
                            <LocationMap
                                capture="area"
                                value={mapValue}
                                frame={frame}
                                onChange={
                                    editable
                                        ? (next) =>
                                              // The map announces its own changes.
                                              change(editableRing(next) ?? [])
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
                                className={narrow ? 'h-[55dvh]' : undefined}
                            />
                            <PanelFooter
                                summary={
                                    ring.length === 0 && editable
                                        ? i18n.t('Click the map to add points')
                                        : [
                                              summary,
                                              ...areaNotes(ring, orgUnit).map(
                                                  ({ text }) => text
                                              ),
                                          ]
                                              .filter(Boolean)
                                              .join(' · ')
                                }
                            >
                                {editable ? (
                                    <>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            disabled={history.length === 0}
                                            focusableWhenDisabled
                                            onClick={undo}
                                        >
                                            <IconUndo16 />
                                            {i18n.t('Undo')}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            aria-busy={fix.finding || undefined}
                                            onClick={locate}
                                        >
                                            {fix.finding ? (
                                                <Spinner className="size-4" />
                                            ) : (
                                                <LocateIcon />
                                            )}
                                            {fix.finding &&
                                            fix.accuracyM === undefined
                                                ? i18n.t('Stop')
                                                : i18n.t('My location')}
                                        </Button>
                                    </>
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
            {readOnly === undefined ? null : (
                <FieldDescription>{readOnly}</FieldDescription>
            )}
            <Notes notes={notes} />
        </Field>
    )
}
