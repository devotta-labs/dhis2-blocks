import React, { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    TallyGrid,
    TallySheet,
    TallyTotal,
    useTally,
    useTallyCount,
    useTallyRowTotal,
    useTallyTotal,
} from '..'
import type { TallyEntry, TallyLayout } from '..'
import { buttonIn, inputIn, listen } from '../test/sheet.test-utils'
import {
    BOY,
    correctionOn,
    GIRL,
    tapOn,
    VACCINATIONS,
} from '../test/tally.fixture'

describe('edit counts', () => {
    it('says so and focuses the field of the cell last focused, else the first', async () => {
        const heard = listen()
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" />
        )
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        expect(document.activeElement).toBe(inputIn('BCG', 0))
        await expect.poll(() => heard.at(-1)).toBe('Editing counts')
        await screen.getByRole('button', { name: 'Cancel' }).click()
        buttonIn('Penta 1', 3).focus()
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        expect(document.activeElement).toBe(inputIn('Penta 1', 3))
    })

    it('saves the changed counts in one set and puts focus back on Edit counts', async () => {
        const heard = listen()
        const appended: Array<readonly TallyEntry[]> = []
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[tapOn('opv1', GIRL), tapOn('opv1', GIRL)]}
                onAppend={(made) => appended.push(made)}
            />
        )
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await userEvent.fill(inputIn('OPV 1', 0), '5')
        await userEvent.fill(inputIn('OPV 1', 1), '1')
        await userEvent.fill(inputIn('Penta 1', 0), '0')
        await screen.getByRole('button', { name: 'Done' }).click()
        expect(appended).toHaveLength(1)
        const [made = []] = appended
        expect(made).toHaveLength(2)
        expect(made).toMatchObject([
            { kind: 'correction', row: 'opv1', options: GIRL, delta: 3 },
            { kind: 'correction', row: 'opv1', options: BOY, delta: 1 },
        ])
        expect(new Set(made.map(({ batch }) => batch)).size).toBe(1)
        expect(buttonIn('OPV 1', 0).textContent).toBe('5')
        await expect.poll(() => heard.at(-1)).toBe('2 counts changed')
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Edit counts' }).element()
        )
    })

    it('says one count changed', async () => {
        const heard = listen()
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" />
        )
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await userEvent.fill(inputIn('OPV 1', 0), '3')
        await screen.getByRole('button', { name: 'Done' }).click()
        await expect.poll(() => heard.at(-1)).toBe('1 count changed')
    })

    it('drops the drafts on Cancel and puts focus back on Edit counts', async () => {
        const onAppend = vi.fn()
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                onAppend={onAppend}
            />
        )
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await userEvent.fill(inputIn('OPV 1', 0), '5')
        await screen.getByRole('button', { name: 'Cancel' }).click()
        expect(buttonIn('OPV 1', 0).textContent).toBe('0')
        expect(onAppend).not.toHaveBeenCalled()
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Edit counts' }).element()
        )
    })

    it('changes nothing for a field cleared before Done', async () => {
        const onAppend = vi.fn()
        const heard = listen()
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[tapOn('opv1', GIRL)]}
                onAppend={onAppend}
            />
        )
        await screen.getByRole('button', { name: 'Edit counts' }).click()
        await userEvent.clear(inputIn('OPV 1', 0))
        await screen.getByRole('button', { name: 'Done' }).click()
        await expect.poll(() => heard.at(-1)).toBe('No counts changed')
        expect(onAppend).not.toHaveBeenCalled()
        expect(buttonIn('OPV 1', 0).textContent).toBe('1')
    })

    it('follows a controlled editing prop and asks the host to change it', async () => {
        const onEditingChange = vi.fn()
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                editing
                onEditingChange={onEditingChange}
            />
        )
        await expect.element(inputIn('OPV 1', 0)).toBeVisible()
        await screen.getByRole('button', { name: 'Cancel' }).click()
        expect(onEditingChange).toHaveBeenCalledWith(false)
        expect(inputIn('OPV 1', 0)).toBeDefined()
    })

    it('ends editing and drops the drafts for a new layout', async () => {
        const onEditingChange = vi.fn()
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEditing
                onEditingChange={onEditingChange}
            />
        )
        await userEvent.fill(inputIn('OPV 1', 0), '5')
        await screen.rerender(
            <TallySheet
                layout={{ ...VACCINATIONS, closed: [] }}
                label="Tally"
                defaultEditing
                onEditingChange={onEditingChange}
            />
        )
        await expect
            .element(screen.getByRole('button', { name: 'Edit counts' }))
            .toBeVisible()
        expect(onEditingChange).toHaveBeenCalledWith(false)
        expect(buttonIn('OPV 1', 0).textContent).toBe('0')
    })
})

const Host = ({
    layout = VACCINATIONS,
    echoAfter,
}: {
    layout?: TallyLayout
    echoAfter: number
}) => {
    const [log, setLog] = useState<readonly TallyEntry[]>([])
    return (
        <>
            <output aria-label="Saved">{log.length}</output>
            <TallySheet
                layout={layout}
                label="Tally"
                entries={log}
                onAppend={(made) =>
                    setTimeout(
                        () => setLog((before) => [...before, ...made]),
                        echoAfter
                    )
                }
            />
        </>
    )
}

describe('the host log', () => {
    it('hands the host only the new entries', async () => {
        const onAppend = vi.fn()
        await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[tapOn('opv1', GIRL)]}
                onAppend={onAppend}
            />
        )
        await userEvent.click(buttonIn('Penta 1', 1))
        expect(onAppend).toHaveBeenCalledTimes(1)
        expect(onAppend.mock.calls[0]?.[0]).toMatchObject([
            { kind: 'tap', row: 'penta1', options: BOY },
        ])
    })

    it('keeps taps the host has not yet given back', async () => {
        const screen = await render(<Host echoAfter={200} />)
        const button = buttonIn('OPV 1', 0)
        await userEvent.click(button)
        await userEvent.click(button)
        await userEvent.click(button)
        await expect.element(button).toHaveTextContent('3')
        expect(screen.getByLabelText('Saved').element().textContent).not.toBe(
            '3'
        )
        await expect
            .element(screen.getByLabelText('Saved'))
            .toHaveTextContent('3')
        await expect.element(button).toHaveTextContent('3')
        await userEvent.click(button)
        await expect.element(button).toHaveTextContent('4')
    })

    it('takes entries the host adds from elsewhere', async () => {
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally" entries={[]} />
        )
        await screen.rerender(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                entries={[tapOn('opv1', GIRL), tapOn('opv1', GIRL)]}
            />
        )
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('2')
    })

    it('starts a new layout from the log it keeps itself', async () => {
        const screen = await render(
            <TallySheet
                layout={VACCINATIONS}
                label="Tally"
                defaultEntries={[correctionOn('opv1', GIRL, 2)]}
            />
        )
        await userEvent.click(buttonIn('OPV 1', 0))
        await screen.rerender(
            <TallySheet
                layout={{ ...VACCINATIONS, closed: [] }}
                label="Tally"
                defaultEntries={[]}
            />
        )
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('3')
    })
})

const Custom = () => {
    const { columns, tap, canUndo, undo } = useTally()
    const count = useTallyCount('opv1', GIRL)
    const row = useTallyRowTotal('opv1')
    const total = useTallyTotal()
    return (
        <>
            <p>{`${columns.length} columns, ${count} ${row} ${total}`}</p>
            <button type="button" onClick={() => tap('opv1', GIRL)}>
                Mark
            </button>
            <button type="button" disabled={!canUndo} onClick={undo}>
                Back
            </button>
        </>
    )
}

describe('parts and hooks', () => {
    it('arranges the parts it is given and serves the hooks', async () => {
        const screen = await render(
            <TallySheet layout={VACCINATIONS} label="Tally">
                <TallyTotal />
                <Custom />
                <TallyGrid />
            </TallySheet>
        )
        expect(
            screen.getByRole('button', { name: 'Edit counts' }).query()
        ).toBeNull()
        await screen.getByRole('button', { name: 'Mark' }).click()
        await expect.element(screen.getByText('4 columns, 1 1 1')).toBeVisible()
        await expect.element(buttonIn('OPV 1', 0)).toHaveTextContent('1')
        await screen.getByRole('button', { name: 'Back' }).click()
        await expect.element(screen.getByText('4 columns, 0 0 0')).toBeVisible()
    })

    it('throws a clear error outside a sheet', async () => {
        const Alone = () => {
            useTallyTotal()
            return null
        }
        await expect(render(<Alone />)).rejects.toThrow(
            'useTallyTotal must be used within TallySheet.'
        )
    })
})
