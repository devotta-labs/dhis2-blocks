import L from 'leaflet'
import { useEffect } from 'react'
import { GONE, latLng } from './marks'
import type { MapPosition, MapReference } from './types'

/** What is drawn only for orientation: the references, quietly, and the device with its accuracy. */
export const useOrientation = (
    map: L.Map | undefined,
    references: readonly MapReference[],
    here: MapPosition | undefined
) => {
    const referencesKey = JSON.stringify(references)
    useEffect(() => {
        if (!map || GONE.has(map)) return undefined
        const layer = L.featureGroup()
        references.forEach(({ name, geometry }) => {
            if (geometry.type === 'Point') {
                const dot = L.circleMarker(latLng(geometry.coordinates), {
                    radius: 5,
                    className: 'location-reference-point',
                    interactive: false,
                })
                if (name) {
                    // An element, not a string, which Leaflet would write as HTML.
                    const text = document.createElement('span')
                    text.textContent = name
                    dot.bindTooltip(text, {
                        permanent: true,
                        direction: 'right',
                        offset: [6, 0],
                        className: 'location-reference-label',
                    })
                }
                dot.addTo(layer)
            } else {
                L.geoJSON(geometry, {
                    interactive: false,
                    style: { className: 'location-reference-area' },
                }).addTo(layer)
            }
        })
        layer.addTo(map)

        // Named areas get a line in a legend; named points carry their name beside them.
        const named = references.flatMap(({ name, geometry }) =>
            name && geometry.type !== 'Point' ? [name] : []
        )
        const legend = new L.Control({ position: 'bottomleft' })
        legend.onAdd = () => {
            const box = L.DomUtil.create('div', 'location-legend')
            named.forEach((name) => {
                const row = L.DomUtil.create('span', '', box)
                row.innerHTML =
                    '<svg viewBox="0 0 18 6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3"/></svg>'
                row.append(name)
            })
            return box
        }
        if (named.length > 0) legend.addTo(map)
        return () => {
            layer.remove()
            legend.remove()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, referencesKey])

    const [hereLng, hereLat] = here?.position ?? []
    useEffect(() => {
        if (
            !map ||
            GONE.has(map) ||
            hereLng === undefined ||
            hereLat === undefined
        ) {
            return undefined
        }
        const layer = L.featureGroup()
        if (here?.accuracyM !== undefined) {
            L.circle([hereLat, hereLng], {
                radius: here.accuracyM,
                className: 'location-here-accuracy',
                interactive: false,
            }).addTo(layer)
        }
        L.circleMarker([hereLat, hereLng], {
            radius: 6,
            className: 'location-here-dot',
            interactive: false,
        }).addTo(layer)
        layer.addTo(map)
        return () => {
            layer.remove()
        }
    }, [map, hereLng, hereLat, here?.accuracyM])
}
