import i18n from '@dhis2/d2-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { IconCross16 } from '@dhis2/ui-icons'
import { useEffect, useRef, useState } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    bandPositions,
    editableRing,
    insertionIndex,
    pointOf,
    polygonOf,
    positionsOf,
    type Position,
} from './geometry'
import './location-map.css'
import {
    GONE,
    Crosshair,
    handleIcon,
    latLng,
    MIDPOINT,
    nudged,
    PIN,
    positionAt,
    reducedMotion,
} from './marks'
import { useClosedArea, useDraftCorners } from './areaState'
import { OSM_TILES } from './tiles'
import { useOrientation } from './useOrientation'
import type { LocationMapProps } from './types'

const keyOf = (ring: readonly Position[]) => JSON.stringify(ring)

/**
 * A point or an area on a Leaflet map. With `onChange`: a click places the point or adds a corner, a drag moves it,
 * a corner's middle handle inserts one, and with the map focused Enter places at the crosshair, while arrow keys move
 * a focused pin or corner and Delete removes a corner. An area is drawn until its first corner is clicked again; from
 * then on a click on the map no longer adds corners, and the handles reshape it.
 */
const LeafletMap = ({
    value,
    onChange,
    onCornersChange,
    capture,
    references = [],
    here,
    tiles = OSM_TILES,
    zoom,
    frame,
    label,
    className,
}: LocationMapProps) => {
    const host = useRef<HTMLDivElement>(null)
    const [held, setHeld] = useState<L.Map>()
    const map = held && !GONE.has(held) ? held : undefined
    const [noBackground, setNoBackground] = useState(false)
    const [selected, setSelected] = useState<number>()

    const { draft, setDraft, sentValue } = useDraftCorners(value)

    // Unfinished corners are an area being drawn, even while the value has gone back to nothing.
    const areaShown = draft !== undefined || (value && value.type !== 'Point')
    const kind = capture ?? (areaShown ? 'area' : 'point')
    const ring = kind === 'area' ? (draft ?? editableRing(value) ?? []) : []
    const fixedArea =
        value && value.type !== 'Point' && editableRing(value) === undefined
    const listening = onChange !== undefined || onCornersChange !== undefined
    const editable = listening && !fixedArea
    const point = value?.type === 'Point' ? value.coordinates : undefined
    const ringKey = keyOf(ring)

    const { closed, setClosed, sentKey } = useClosedArea(ring, ringKey)
    const drawing = editable && kind === 'area' && !closed

    // What handlers read when they fire, which is after the render that made them.
    const current = {
        ring,
        onChange,
        onCornersChange,
        editable,
        kind,
        selected,
        drawing,
    }
    const latest = useRef(current)
    latest.current = current

    // The dashed sides a click would add, drawn to the pointer while drawing.
    const band = useRef<L.Polyline>()

    const setRing = (next: Position[], said: string) => {
        sentKey.current = keyOf(next)
        const whole = next.length >= 3 ? polygonOf(next) : null
        sentValue.current = JSON.stringify(whole)
        latest.current.onCornersChange?.(next)
        latest.current.onChange?.(whole)
        if (latest.current.onCornersChange === undefined) {
            setDraft(next.length > 0 && next.length < 3 ? next : undefined)
        }
        band.current?.setLatLngs([])
        announce(said)
    }
    const closeArea = () => {
        setClosed(true)
        setSelected(undefined)
        band.current?.setLatLngs([])
        announce(
            i18n.t('Area closed, {{count}} points', {
                count: latest.current.ring.length,
            })
        )
    }
    const addCorner = (at: Position) => {
        const now = latest.current.ring
        const index = insertionIndex(now, at)
        setRing(
            [...now.slice(0, index), at, ...now.slice(index)],
            now.length === 0
                ? i18n.t('Point 1 added')
                : i18n.t('Point {{number}} added, {{count}} points', {
                      number: String(index + 1),
                      count: now.length + 1,
                  })
        )
        setSelected(undefined)
    }
    const removeCorner = (index: number) => {
        const now = latest.current.ring
        setRing(
            now.filter((_, each) => each !== index),
            i18n.t('Point {{number}} removed, {{count}} left', {
                number: String(index + 1),
                count: now.length - 1,
            })
        )
        setSelected(undefined)
    }
    const placePoint = (at: Position) => {
        latest.current.onChange?.(pointOf(at))
        announce(
            i18n.t('Point placed at latitude {{lat}}, longitude {{lng}}', {
                lat: String(at[1]),
                lng: String(at[0]),
            })
        )
    }
    const place = (at: Position) => {
        if (!latest.current.editable) return
        if (latest.current.kind === 'point') placePoint(at)
        else addCorner(at)
    }
    // A click on a closed area's map deselects; only Enter at the crosshair still adds a corner there.
    const click = (at: Position) => {
        if (latest.current.kind === 'area' && !latest.current.drawing) {
            setSelected(undefined)
            return
        }
        place(at)
    }
    const placeRef = useRef(place)
    placeRef.current = place
    const clickRef = useRef(click)
    clickRef.current = click
    const removeRef = useRef(removeCorner)
    removeRef.current = removeCorner
    const closeRef = useRef(closeArea)
    closeRef.current = closeArea

    // The map, made once; later values move what is drawn, not the view.
    useEffect(() => {
        if (!host.current) return undefined
        const still = reducedMotion()
        const made = L.map(host.current, {
            zoomControl: false,
            scrollWheelZoom: listening,
            doubleClickZoom: false,
            zoomSnap: 0.5,
            zoomAnimation: !still,
            fadeAnimation: !still,
            markerZoomAnimation: !still,
        })
        made.attributionControl.setPrefix(false)
        L.control.zoom({ position: 'topright' }).addTo(made)
        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(made)
        made.getContainer().setAttribute('aria-roledescription', 'map')

        const framed = L.latLngBounds([])
        const own = value ? positionsOf(value) : []
        own.forEach((at) => framed.extend(latLng(at)))
        if (own.length === 0) {
            references.forEach(({ geometry }) =>
                positionsOf(geometry).forEach((at) => framed.extend(latLng(at)))
            )
            if (here) framed.extend(latLng(here.position))
        }
        if (zoom !== undefined) {
            made.setView(framed.isValid() ? framed.getCenter() : [0, 0], zoom)
        } else if (!framed.isValid()) made.setView([0, 0], 2)
        else if (framed.getNorthEast().equals(framed.getSouthWest())) {
            made.setView(framed.getCenter(), 16)
        } else made.fitBounds(framed.pad(0.2), { maxZoom: 17 })

        made.on('click', ({ latlng }: L.LeafletMouseEvent) =>
            clickRef.current(positionAt(latlng))
        )
        // On the host, which outlives the map in a remount, so it is taken off with the map.
        const container = made.getContainer()
        const enter = (event: KeyboardEvent) => {
            if (event.target !== container) return
            if (event.key === 'Enter') {
                event.preventDefault()
                placeRef.current(positionAt(made.getCenter()))
            }
        }
        container.addEventListener('keydown', enter)

        const resized = new ResizeObserver(() => made.invalidateSize())
        resized.observe(host.current)
        setHeld(made)
        return () => {
            container.removeEventListener('keydown', enter)
            resized.disconnect()
            GONE.add(made)
            made.remove()
            setHeld(undefined)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        map?.getContainer().setAttribute('aria-label', label ?? i18n.t('Map'))
    }, [map, label])
    const placing = kind === 'area' ? drawing : editable && point === undefined

    useEffect(() => {
        setNoBackground(false)
        if (!map || GONE.has(map) || !tiles) return undefined
        const layer = L.tileLayer(tiles.url, {
            attribution: tiles.attribution,
            maxZoom: 19,
        })
        let loaded = false
        layer.on('tileload', () => {
            loaded = true
            setNoBackground(false)
        })
        layer.on('tileerror', () => {
            if (!loaded) setNoBackground(true)
        })
        layer.addTo(map)
        return () => {
            layer.remove()
        }
    }, [map, tiles?.url, tiles?.attribution])

    useOrientation(map, references, here)

    // An area this form cannot change, drawn as it is.
    const fixedKey = fixedArea ? JSON.stringify(value) : ''
    useEffect(() => {
        if (!map || GONE.has(map) || !fixedArea || !value) return undefined
        const layer = L.geoJSON(value, {
            interactive: false,
            style: { className: 'location-area' },
        }).addTo(map)
        return () => {
            layer.remove()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, fixedKey])

    // The pin is kept across moves, so it keeps keyboard focus while the arrow keys move it.
    const pin = useRef<L.Marker>()
    const [pinLng, pinLat] = point ?? []
    useEffect(() => {
        if (
            !map ||
            GONE.has(map) ||
            pinLng === undefined ||
            pinLat === undefined
        ) {
            pin.current?.remove()
            pin.current = undefined
            return
        }
        const at = L.latLng(pinLat, pinLng)
        if (pin.current === undefined) {
            const made = L.marker(at, {
                icon: PIN,
                keyboard: true,
                autoPan: true,
            }).addTo(map)
            made.on('dragend', () => {
                if (latest.current.editable) {
                    placeRef.current(positionAt(made.getLatLng()))
                }
            })
            made.getElement()?.addEventListener('keydown', (event) => {
                if (!latest.current.editable) return
                const moved = nudged(map, made.getLatLng(), event)
                if (moved === undefined) return
                event.preventDefault()
                event.stopPropagation()
                placeRef.current(positionAt(moved))
            })
            pin.current = made
        } else {
            pin.current.setLatLng(at)
        }
        pin.current.getElement()?.setAttribute(
            'aria-label',
            i18n.t('Point at latitude {{lat}}, longitude {{lng}}', {
                lat: String(pinLat),
                lng: String(pinLng),
            })
        )
        if (!map.getBounds().pad(-0.1).contains(at)) map.panTo(at)
    }, [map, pinLng, pinLat])

    // After the pin, so a frame asked for in the same change wins.
    const frameKey = JSON.stringify(frame ?? null)
    useEffect(() => {
        if (!map || GONE.has(map) || !frame || frame.length === 0) return
        const bounds = L.latLngBounds(frame.map(latLng))
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
            map.setView(bounds.getCenter(), 16)
        } else map.fitBounds(bounds, { maxZoom: 17 })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, frameKey])

    useEffect(() => {
        if (editable) pin.current?.dragging?.enable()
        else pin.current?.dragging?.disable()
    }, [editable, map, pinLng, pinLat])

    // The area: one outline, a marker per corner kept across changes so focus stays on the one being moved.
    const outline = useRef<L.Polygon | L.Polyline>()
    const corners = useRef<L.Marker[]>([])
    const midpoints = useRef<L.LayerGroup>()

    useEffect(() => {
        if (!map || GONE.has(map) || kind !== 'area' || fixedArea)
            return undefined
        const area = L.polygon([], {
            className: 'location-area',
            interactive: false,
        })
        const edge = L.polyline([], {
            className: 'location-edge',
            interactive: false,
        })
        const middles = L.layerGroup().addTo(map)
        midpoints.current = middles
        // Swapped in once there are three corners.
        outline.current = edge.addTo(map)
        const refresh = () => {
            const want = latest.current.ring.length >= 3 ? area : edge
            if (outline.current !== want) {
                outline.current?.remove()
                outline.current = want.addTo(map)
            }
        }
        map.on('location-ring', refresh)

        // From the corners the next click would join, to the pointer.
        const rubber = L.polyline([], {
            className: 'location-band',
            interactive: false,
        }).addTo(map)
        band.current = rubber
        const follow = ({ latlng }: L.LeafletMouseEvent) => {
            rubber.setLatLngs(
                latest.current.drawing
                    ? bandPositions(
                          latest.current.ring,
                          positionAt(latlng)
                      ).map(latLng)
                    : []
            )
        }
        const leave = () => rubber.setLatLngs([])
        map.on('mousemove', follow)
        map.on('mouseout', leave)
        return () => {
            map.off('location-ring', refresh)
            map.off('mousemove', follow)
            map.off('mouseout', leave)
            rubber.remove()
            band.current = undefined
            area.remove()
            edge.remove()
            middles.remove()
            corners.current.forEach((marker) => marker.remove())
            corners.current = []
            outline.current = undefined
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, kind, fixedKey])

    useEffect(() => {
        if (!map || GONE.has(map) || kind !== 'area' || fixedArea) return
        map.fire('location-ring')
        const lines = ring.map(latLng)
        outline.current?.setLatLngs(lines)

        // As many corner markers as corners while editing, new ones at the end; none when the map only shows.
        const wanted = editable ? ring.length : 0
        while (corners.current.length > wanted) {
            corners.current.pop()?.remove()
        }
        while (corners.current.length < wanted) {
            const made = L.marker([0, 0], {
                icon: handleIcon(corners.current.length + 1),
                keyboard: true,
            }).addTo(map)
            const index = () => corners.current.indexOf(made)
            // Clicking the first corner again closes an area being drawn.
            const closes = () =>
                index() === 0 &&
                latest.current.drawing &&
                latest.current.ring.length >= 3
            made.on('click', () => {
                if (closes()) closeRef.current()
                else setSelected(index())
            })
            // The pointer over a handle is not where a corner would go.
            made.on('mouseover dragstart', () => band.current?.setLatLngs([]))
            made.on('drag', () => {
                const now = latest.current.ring.map(latLng)
                now[index()] = made.getLatLng()
                outline.current?.setLatLngs(now)
            })
            made.on('dragend', () => {
                const now = [...latest.current.ring]
                now[index()] = positionAt(made.getLatLng())
                setRing(
                    now,
                    i18n.t('Point {{number}} moved', {
                        number: String(index() + 1),
                    })
                )
            })
            made.getElement()?.addEventListener('keydown', (event) => {
                if (!latest.current.editable) return
                if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault()
                    const gone = index()
                    removeRef.current(gone)
                    // Focus goes to the corner that takes its place, or the map.
                    const next =
                        corners.current[
                            Math.min(gone, corners.current.length - 2)
                        ]
                    ;(next?.getElement() ?? map.getContainer()).focus()
                    return
                }
                // Escape lets go of a selected corner, and only then; otherwise it closes whatever the map is in.
                if (
                    event.key === 'Escape' &&
                    latest.current.selected !== undefined
                ) {
                    event.preventDefault()
                    event.stopPropagation()
                    setSelected(undefined)
                    return
                }
                if (event.key === 'Enter' && closes()) {
                    event.preventDefault()
                    closeRef.current()
                    return
                }
                const moved = nudged(map, made.getLatLng(), event)
                if (moved === undefined) return
                event.preventDefault()
                event.stopPropagation()
                const now = [...latest.current.ring]
                now[index()] = positionAt(moved)
                setRing(
                    now,
                    i18n.t('Point {{number}} moved', {
                        number: String(index() + 1),
                    })
                )
            })
            corners.current.push(made)
        }
        corners.current.forEach((marker, index) => {
            marker.setLatLng(lines[index] ?? marker.getLatLng())
            // Changed in place, not by a new icon, which would take the focus and the key listener with it.
            const handle = marker
                .getElement()
                ?.querySelector('.location-handle')
            handle?.toggleAttribute('data-selected', selected === index)
            const closer = index === 0 && drawing && ring.length >= 3
            handle?.toggleAttribute('data-closes', closer)
            const number = handle?.querySelector('b')
            if (number) number.textContent = String(index + 1)
            if (editable) marker.dragging?.enable()
            else marker.dragging?.disable()
            const element = marker.getElement()
            element?.setAttribute(
                'aria-label',
                closer
                    ? i18n.t('Point 1 of {{count}}, Enter closes the area', {
                          count: ring.length,
                      })
                    : i18n.t('Point {{number}} of {{count}}', {
                          number: String(index + 1),
                          count: ring.length,
                      })
            )
            if (closer) element?.setAttribute('title', i18n.t('Close the area'))
            else element?.removeAttribute('title')
        })

        // A handle in the middle of each side inserts a corner there.
        midpoints.current?.clearLayers()
        if (editable && ring.length >= 3) {
            ring.forEach((from, index) => {
                const to = ring[(index + 1) % ring.length] ?? from
                const handle = L.marker(
                    latLng([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]),
                    { icon: MIDPOINT, keyboard: false, draggable: true }
                )
                const insert = () => {
                    const now = [...latest.current.ring]
                    now.splice(index + 1, 0, positionAt(handle.getLatLng()))
                    setRing(
                        now,
                        i18n.t('Point {{number}} added, {{count}} points', {
                            number: String(index + 2),
                            count: now.length,
                        })
                    )
                    // The corners after it moved up by one, so the selection goes to the new corner, not to
                    // whichever now has the old number.
                    setSelected(index + 1)
                }
                handle.on('click', insert)
                handle.on('dragend', insert)
                handle.on('mouseover', () => band.current?.setLatLngs([]))
                handle.addTo(midpoints.current ?? map)
            })
        }

        const shown = L.latLngBounds(lines)
        if (shown.isValid() && !map.getBounds().contains(shown)) {
            map.fitBounds(shown.pad(0.2), { maxZoom: 17 })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, kind, fixedKey, ringKey, selected, editable, drawing])

    const removable =
        editable &&
        kind === 'area' &&
        selected !== undefined &&
        selected < ring.length

    return (
        <div
            data-slot="location-map"
            data-placing={placing || undefined}
            className={cn('location-map', className)}
        >
            <div ref={host} className="size-full" />
            <Crosshair />
            {removable ? (
                <div className="absolute start-2 top-2 z-[1000]">
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        // The name says which; the visible text starts the same, for voice control.
                        aria-label={i18n.t('Remove point {{number}}', {
                            number: String(selected + 1),
                        })}
                        onClick={() => removeCorner(selected)}
                    >
                        <IconCross16 />
                        {i18n.t('Remove point')}
                    </Button>
                </div>
            ) : null}
            {noBackground ? (
                <p
                    role="status"
                    className="absolute end-2 bottom-5 z-[1000] m-0 rounded-dhis2-sm bg-dhis2-background/85 px-1.5 py-0.5 text-[11px] text-dhis2-muted-foreground"
                >
                    {i18n.t('No map background')}
                </p>
            ) : null}
        </div>
    )
}

export default LeafletMap
