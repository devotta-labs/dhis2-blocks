import '../test/renders.test-utils'
import React, { StrictMode, useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TallyGrid, TallySheet, TallyTotal, TallyUndoButton } from '..'
import type { TallyEntry, TallyRow } from '..'
import { rendersDuring } from '../test/renders.test-utils'
import { buttonIn, inputIn, listen } from '../test/sheet.test-utils'
import { GIRL, tapOn, VACCINATIONS } from '../test/tally.fixture'

const EditingHost = ({
    onAppend,
}: {
    onAppend(made: readonly TallyEntry[]): void
}) => (
    <TallySheet
        layout={VACCINATIONS}
        label="Tally"
        editing
        onAppend={onAppend}
    />
)

describe('saving while the host keeps edit mode on', () => {
    it('saves a correction once however often Done is pressed', async () => {
        const heard = listen()
        const appended: TallyEntry[] = []
        const screen = await render(
            <EditingHost onAppend={(made) => appended.push(...made)} />
        )
        await userEvent.fill(inputIn('OPV 1', 0), '5')
        await screen.getByRole('button', { name: 'Done' }).click()
        await expect.poll(() => heard.at(-1)).toBe('1 count changed')
        await screen.getByRole('button', { name: 'Done' }).click()
        await expect.poll(() => heard.at(-1)).toBe('No counts changed')
        expect(appended).toHaveLength(1)
        expect(appended[0]).toMatchObject({ kind: 'correction', delta: 5 })
        await expect.element(inputIn('OPV 1', 0)).toHaveValue('5')
    })

    it('puts the fields back to the counts on Cancel', async () => {
        const heard = listen()
        const appended: TallyEntry[] = []
        const screen = await render(
            <EditingHost onAppend={(made) => appended.push(...made)} />
        )
        await userEvent.fill(inputIn('OPV 1', 0), '3')
        await screen.getByRole('button', { name: 'Cancel' }).click()
        await expect.element(inputIn('OPV 1', 0)).toHaveValue('0')
        await screen.getByRole('button', { name: 'Done' }).click()
        await expect.poll(() => heard.at(-1)).toBe('No counts changed')
        expect(appended).toHaveLength(0)
    })
})

describe('a log from another session', () => {
    it('ends editing and drops what was typed against the old counts', async () => {
        const onAppend = vi.fn()
        const three = [
            tapOn('opv1', GIRL),
            tapOn('opv1', GIRL),
            tapOn('opv1', GIRL),
        ]
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                entries={three}
                onAppend={onAppend}
            />
        )
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await userEvent.fill(inputIn('OPV 1', 0), '7')
        await screen.rerender(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                entries={[]}
                onAppend={onAppend}
            />
        )
        await expect
            .element(screen.getByRole('button', { name: 'Edit counts' }))
            .toBeVisible()
        expect(document.querySelector('td input')).toBeNull()
        expect(buttonIn('OPV 1', 0).textContent).toBe('0')
        expect(onAppend).not.toHaveBeenCalled()
    })
})

describe('this device', () => {
    it('undoes only its own entries, without a name given', async () => {
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[tapOn('opv1', GIRL, 'other')]}
            />
        )
        const undo = screen.getByRole('button', { name: 'Undo last mark' })
        await expect.element(undo).toHaveAttribute('aria-disabled', 'true')
        await userEvent.click(buttonIn('Penta 1', 0))
        await expect.element(undo).not.toHaveAttribute('aria-disabled', 'true')
        await undo.click()
        await expect.element(buttonIn('Penta 1', 0)).toHaveTextContent('0')
        await expect.element(undo).toHaveAttribute('aria-disabled', 'true')
        expect(buttonIn('OPV 1', 0).textContent).toBe('1')
    })

    it('makes entry ids with the host\u2019s generator', async () => {
        const appended: TallyEntry[] = []
        let made = 0
        await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                by="tablet"
                newId={() => {
                    made += 1
                    return `uid${made}`
                }}
                onAppend={(added) => appended.push(...added)}
            />
        )
        await userEvent.click(buttonIn('OPV 1', 0))
        await userEvent.click(buttonIn('OPV 1', 0))
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('2')
        expect(appended.map(({ id }) => id)).toEqual(['uid1', 'uid2'])
    })

    it('names later entries with a name that arrives after it opens', async () => {
        const appended: TallyEntry[] = []
        const onAppend = (made: readonly TallyEntry[]) => appended.push(...made)
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                onAppend={onAppend}
            />
        )
        await userEvent.click(buttonIn('OPV 1', 0))
        await screen.rerender(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                onAppend={onAppend}
                by="tablet"
            />
        )
        await userEvent.click(buttonIn('OPV 1', 0))
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('2')
        expect(appended.map(({ by }) => by === 'tablet')).toEqual([false, true])
    })
})

const Echo = ({ other }: { other?: boolean }) => {
    const [log, setLog] = useState<readonly TallyEntry[]>([])
    const [clicks, setClicks] = useState(0)
    return (
        <>
            <button type="button" onClick={() => setClicks(clicks + 1)}>
                {`Other ${clicks}`}
            </button>
            <TallySheet
                layout={{ ...VACCINATIONS }}
                label="Tally"
                entries={other ? undefined : log}
                onAppend={(made) => setLog((before) => [...before, ...made])}
                RowBadge={({ total }: { row: TallyRow; total: number }) => (
                    <span>{total}</span>
                )}
            />
        </>
    )
}

describe('a host that renders often', () => {
    it('renders only the tapped cell and its row badge per tap', async () => {
        await render(<Echo />)
        await userEvent.click(buttonIn('OPV 1', 0))
        await userEvent.hover(buttonIn('OPV 1', 1))
        buttonIn('OPV 1', 1).focus()
        await new Promise((resolve) => requestAnimationFrame(resolve))
        const renders = await rendersDuring(async () => {
            await userEvent.click(buttonIn('OPV 1', 1))
            await expect.element(buttonIn('OPV 1', 1)).toHaveTextContent('1')
        })
        const sheet = new Set(
            renders.filter(
                (name) => !['Echo', 'TallySheet', 'RowBadge', ''].includes(name)
            )
        )
        expect(sheet).toEqual(new Set(['TapCell', 'RowBadgeSlot', 'HostBadge']))
    })

    it('keeps edit mode and the drafts through a render of its own', async () => {
        const screen = await render(<Echo other />)
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await userEvent.fill(inputIn('OPV 1', 0), '5')
        await screen.getByRole('button', { name: 'Other 0' }).click()
        await expect
            .element(screen.getByRole('button', { name: 'Other 1' }))
            .toBeVisible()
        await expect.element(inputIn('OPV 1', 0)).toHaveValue('5')
    })
})

const Parts = ({ editing }: { editing: boolean }) => (
    <TallySheet layout={VACCINATIONS} label="Tally" editing={editing}>
        <TallyTotal />
        <TallyGrid />
        <TallyUndoButton />
    </TallySheet>
)

describe('focus as editing ends without the edit buttons', () => {
    it('goes to the count button of the field that had focus', async () => {
        const screen = await render(<Parts editing />)
        inputIn('Penta 1', 3).focus()
        await screen.rerender(<Parts editing={false} />)
        await expect.element(buttonIn('Penta 1', 3)).toHaveFocus()
    })

    it('goes to the grid tab stop when no field had focus', async () => {
        const screen = await render(<Parts editing />)
        await screen.rerender(<Parts editing={false} />)
        await expect.element(buttonIn('BCG', 0)).toHaveFocus()
    })
})

describe('strict mode', () => {
    it('counts a tap once in a sheet keeping its own log', async () => {
        const appended: TallyEntry[] = []
        await render(
            <StrictMode>
                <TallySheet
                    layout={VACCINATIONS}
                    label="Tally"
                    onAppend={(made) => appended.push(...made)}
                />
            </StrictMode>
        )
        await userEvent.click(buttonIn('OPV 1', 0))
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('1')
        expect(appended).toHaveLength(1)
    })

    it('counts a tap once in a sheet whose host keeps the log', async () => {
        const appended: TallyEntry[] = []
        const Spy = () => {
            const [log, setLog] = useState<readonly TallyEntry[]>([])
            return (
                <TallySheet
                    layout={VACCINATIONS}
                    label="Tally"
                    entries={log}
                    onAppend={(made) => {
                        appended.push(...made)
                        setLog((before) => [...before, ...made])
                    }}
                />
            )
        }
        await render(
            <StrictMode>
                <Spy />
            </StrictMode>
        )
        await userEvent.click(buttonIn('OPV 1', 0))
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('1')
        await userEvent.click(buttonIn('OPV 1', 0))
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('2')
        expect(new Set(appended.map(({ id }) => id)).size).toBe(2)
        expect(appended).toHaveLength(2)
    })
})
