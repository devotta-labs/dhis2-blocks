import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { LocationInput } from '../LocationInput'
import type { Locator } from '../types'

const reported = (
    longitude: number,
    latitude: number,
    accuracy: number
): GeolocationPosition =>
    // SAFETY: the field reads only `coords.longitude`, `latitude` and `accuracy`.
    ({
        timestamp: Date.now(),
        coords: { longitude, latitude, accuracy },
    }) as GeolocationPosition

/** A device that answers only when the test says, as a browser waiting on its permission prompt does. */
const heldDevice = () => {
    const watching = new Map<number, PositionCallback>()
    const cleared: number[] = []
    let next = 1
    const locator: Locator = {
        getCurrentPosition: () => undefined,
        watchPosition: (found) => {
            const id = next
            next += 1
            watching.set(id, found)
            return id
        },
        clearWatch: (id) => {
            cleared.push(id)
            watching.delete(id)
        },
    }
    const answer = (longitude: number, latitude: number, accuracy: number) =>
        watching.forEach((found) =>
            found(reported(longitude, latitude, accuracy))
        )
    return { locator, answer, cleared }
}

const paste = (element: Element, text: string) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)
    element.dispatchEvent(
        new ClipboardEvent('paste', {
            clipboardData,
            bubbles: true,
            cancelable: true,
        })
    )
}

describe('LocationInput', () => {
    it('adds the device’s point to the points the area has when it arrives, not when it was asked for', async () => {
        const device = heldDevice()
        const onChange = vi.fn()
        const screen = await render(
            <LocationInput
                label="Area"
                capture="area"
                onChange={onChange}
                tiles={null}
                locator={device.locator}
            />
        )
        await userEvent.click(
            screen.getByRole('button', { name: 'Add my location as a point' })
        )
        paste(
            screen
                .getByPlaceholder('No area, paste points or use the map')
                .element(),
            '8.1, -11.1\n8.2, -11.2\n8.2, -11.1'
        )
        device.answer(-11.15, 8.15, 5)

        await expect
            .poll(() => onChange.mock.lastCall)
            .toEqual([
                {
                    type: 'Polygon',
                    coordinates: [
                        [
                            [-11.1, 8.1],
                            [-11.2, 8.2],
                            [-11.1, 8.2],
                            [-11.15, 8.15],
                            [-11.1, 8.1],
                        ],
                    ],
                },
            ])
    })

    it('gives the device’s point to the onChange the form passes when it arrives', async () => {
        const device = heldDevice()
        const first = vi.fn()
        const latest = vi.fn()
        const screen = await render(
            <LocationInput
                label="Coordinate"
                capture="point"
                onChange={first}
                tiles={null}
                locator={device.locator}
            />
        )
        await userEvent.click(
            screen.getByRole('button', { name: 'Use my location' })
        )
        await screen.rerender(
            <LocationInput
                label="Coordinate"
                capture="point"
                onChange={latest}
                tiles={null}
                locator={device.locator}
            />
        )
        device.answer(-11.15, 8.15, 5)

        await expect
            .poll(() => latest.mock.lastCall)
            .toEqual([{ type: 'Point', coordinates: [-11.15, 8.15] }])
        expect(first).not.toHaveBeenCalled()
    })

    it('stops asking when pressed again before the device has answered', async () => {
        const device = heldDevice()
        const screen = await render(
            <LocationInput
                label="Coordinate"
                capture="point"
                onChange={vi.fn()}
                tiles={null}
                locator={device.locator}
            />
        )
        await userEvent.click(
            screen.getByRole('button', { name: 'Use my location' })
        )
        await userEvent.click(
            screen.getByRole('button', { name: 'Stop finding your location' })
        )

        await expect
            .element(screen.getByRole('button', { name: 'Use my location' }))
            .not.toHaveAttribute('aria-busy')
        expect(device.cleared).toEqual([1])
    })

    it('takes a good fix the device gives at once, and stops watching', async () => {
        const cleared: number[] = []
        const onChange = vi.fn()
        const locator: Locator = {
            getCurrentPosition: () => undefined,
            watchPosition: (found) => {
                found(reported(-11.2, 8.3, 4))
                return 7
            },
            clearWatch: (id) => cleared.push(id),
        }
        const screen = await render(
            <LocationInput
                label="Coordinate"
                capture="point"
                onChange={onChange}
                tiles={null}
                locator={locator}
            />
        )
        await userEvent.click(
            screen.getByRole('button', { name: 'Use my location' })
        )

        expect(onChange).toHaveBeenCalledWith({
            type: 'Point',
            coordinates: [-11.2, 8.3],
        })
        expect(cleared).toEqual([7])
    })

    it('takes the first fix that comes after the wait has run out, however coarse', async () => {
        const device = heldDevice()
        const changed = vi.fn()
        const screen = await render(
            <LocationInput
                label="Coordinate"
                capture="point"
                onChange={changed}
                tiles={null}
                locator={device.locator}
            />
        )
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        try {
            await userEvent.click(
                screen.getByRole('button', { name: 'Use my location' })
            )
            vi.advanceTimersByTime(10_000)
            expect(changed).not.toHaveBeenCalled()
            device.answer(-11.15, 8.15, 50)
        } finally {
            vi.useRealTimers()
        }

        await expect
            .poll(() => changed.mock.lastCall)
            .toEqual([{ type: 'Point', coordinates: [-11.15, 8.15] }])
        expect(device.cleared).toHaveLength(1)
    })
})
