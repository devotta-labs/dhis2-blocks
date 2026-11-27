import L from 'leaflet'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { PolygonGeometry } from '../geometry'
import { LocationMap } from '../LocationMap'
import { positionAt } from '../marks'

const AREA: PolygonGeometry = {
    type: 'Polygon',
    coordinates: [
        [
            [-11.1, 8.1],
            [-11.2, 8.2],
            [-11.1, 8.2],
            [-11.1, 8.1],
        ],
    ],
}

describe('LocationMap', () => {
    it('reads a position on a copy of the world beside the first as the same place', () => {
        expect(positionAt(L.latLng(8.4, 348.8))).toEqual([-11.2, 8.4])
        expect(positionAt(L.latLng(8.4, -371.2))).toEqual([-11.2, 8.4])
    })

    it('shows a reference’s name as text', async () => {
        const name = '<img src="x" alt="injected">'
        const screen = await render(
            <div style={{ height: 300 }}>
                <LocationMap
                    tiles={null}
                    className="h-full"
                    references={[
                        {
                            name,
                            geometry: {
                                type: 'Point',
                                coordinates: [-11.1, 8.1],
                            },
                        },
                    ]}
                />
            </div>
        )

        await expect.element(screen.getByText(name)).toBeInTheDocument()
        expect(screen.container.querySelector('img[alt="injected"]')).toBeNull()
    })

    it('lets go of a selected corner on Escape without closing what the map is in', async () => {
        const escapes = vi.fn()
        const outside = (event: KeyboardEvent) => {
            if (event.key === 'Escape') escapes()
        }
        document.addEventListener('keydown', outside)
        try {
            const screen = await render(
                <div style={{ height: 300 }}>
                    <LocationMap
                        tiles={null}
                        className="h-full"
                        value={AREA}
                        onChange={vi.fn()}
                    />
                </div>
            )
            // A corner's element has no size of its own (its handle is drawn around it), so it is pressed directly.
            const corner = screen
                .getByRole('button', { name: 'Point 2 of 3' })
                .element()
            if (!(corner instanceof HTMLElement)) throw new Error('no corner')
            corner.click()
            corner.focus()
            const remove = screen.getByRole('button', {
                name: 'Remove point 2',
            })
            await expect.element(remove).toBeInTheDocument()

            await userEvent.keyboard('{Escape}')
            await expect.element(remove).not.toBeInTheDocument()
            expect(escapes).not.toHaveBeenCalled()

            // With nothing selected, Escape goes on to close the popover or sheet.
            await userEvent.keyboard('{Escape}')
            expect(escapes).toHaveBeenCalledTimes(1)
        } finally {
            document.removeEventListener('keydown', outside)
        }
    })

    describe('an area', () => {
        const TWO: PolygonGeometry = {
            type: 'Polygon',
            coordinates: [
                [
                    [-11.1, 8.1],
                    [-11.2, 8.2],
                    [-11.1, 8.1],
                ],
            ],
        }
        const map = (value: PolygonGeometry | null) => (
            <div style={{ height: 300 }}>
                <LocationMap
                    tiles={null}
                    className="h-full"
                    capture="area"
                    value={value}
                    onChange={vi.fn()}
                />
            </div>
        )
        const placing = (container: HTMLElement) =>
            container
                .querySelector('[data-slot=location-map]')
                ?.hasAttribute('data-placing')

        it('is closed again when an undo brings it back to three points', async () => {
            const screen = await render(map(AREA))
            expect(placing(screen.container)).toBe(false)
            await screen.rerender(map(TWO))
            await expect.poll(() => placing(screen.container)).toBe(true)

            await screen.rerender(map(AREA))
            await expect.poll(() => placing(screen.container)).toBe(false)
        })

        it('is closed when it arrives whole, as by a paste', async () => {
            const screen = await render(map(null))
            expect(placing(screen.container)).toBe(true)

            await screen.rerender(map(AREA))
            await expect.poll(() => placing(screen.container)).toBe(false)
        })

        it('is still being drawn when the device adds its third point', async () => {
            const screen = await render(map(TWO))
            expect(placing(screen.container)).toBe(true)

            await screen.rerender(map(AREA))
            await expect.poll(() => placing(screen.container)).toBe(true)
        })
    })
})
