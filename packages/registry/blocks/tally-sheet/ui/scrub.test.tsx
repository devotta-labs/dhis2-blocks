import React from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { TallySheet } from '..'
import type { TallyEntry } from '..'
import { buttonIn, listen } from '../test/sheet.test-utils'
import { correctionOn, GIRL, VACCINATIONS } from '../test/tally.fixture'
import { HOLD_MS, STEP_PX } from './scrub'

const POINTER = 7

const pressedAt = new WeakMap<Element, { left: number; top: number }>()

const point = (
    element: Element,
    type: string,
    across: number,
    pointerType = 'touch',
    down = 0
) => {
    if (type === 'pointerdown') {
        const { left, top } = element.getBoundingClientRect()
        pressedAt.set(element, { left, top })
    }
    const { left, top } = pressedAt.get(element) ?? { left: 0, top: 0 }
    element.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            pointerId: POINTER,
            pointerType,
            button: 0,
            clientX: left + 20 + across,
            clientY: top + 20 + down,
        })
    )
}

const wait = (ms: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms)
    })

const held = async (element: Element) => {
    point(element, 'pointerdown', 0)
    await wait(HOLD_MS + 60)
}

const readout = () =>
    document.querySelector('[data-slot="tally-scrub-readout"]')?.textContent

const sheet = (entries: TallyEntry[] = [], dir: 'ltr' | 'rtl' = 'ltr') => {
    const appended: TallyEntry[] = []
    return {
        appended,
        rendered: render(
            <div dir={dir}>
                <TallySheet
                    layout={VACCINATIONS}
                    label="Tally"
                    defaultEntries={entries}
                    onAppend={(added) => appended.push(...added)}
                />
            </div>
        ),
    }
}

describe('holding a count and sliding', () => {
    it('adds one for each step slid and saves it as one correction', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const heard = listen()
        const button = buttonIn('OPV 1', 0)
        await held(button)
        point(button, 'pointermove', STEP_PX * 3 + 2)
        await expect.element(button).toHaveTextContent('3')
        await expect.poll(readout).toBe('+3')
        expect(appended).toEqual([])
        point(button, 'pointerup', STEP_PX * 3 + 2)
        button.click()
        await expect.element(button).toHaveTextContent('3')
        await expect.poll(readout).toBeUndefined()
        expect(appended).toHaveLength(1)
        expect(appended[0]).toMatchObject({ kind: 'correction', delta: 3 })
        await expect
            .poll(() => heard.at(-1))
            .toBe('6 weeks, OPV 1, 0–11 months, Female: 3')
    })

    it('takes off sliding the other way, and stops at nothing', async () => {
        const { appended, rendered } = sheet([correctionOn('opv1', GIRL, 2)])
        await rendered
        const button = buttonIn('OPV 1', 0)
        await held(button)
        point(button, 'pointermove', -STEP_PX)
        await expect.poll(readout).toBe('−1')
        point(button, 'pointermove', -STEP_PX * 9)
        await expect.element(button).toHaveTextContent('0')
        await expect.poll(readout).toBe('−2')
        point(button, 'pointerup', -STEP_PX * 9)
        expect(appended.at(-1)).toMatchObject({
            kind: 'correction',
            delta: -2,
        })
    })

    it('adds sliding up and takes off sliding down', async () => {
        const { appended, rendered } = sheet([correctionOn('opv1', GIRL, 5)])
        await rendered
        const button = buttonIn('OPV 1', 0)
        await held(button)
        point(button, 'pointermove', 0, 'touch', -STEP_PX * 2)
        await expect.poll(readout).toBe('+2')
        expect(button).toHaveAttribute('data-axis', 'up')
        expect(button.querySelectorAll('svg')).toHaveLength(2)
        point(button, 'pointermove', 0, 'touch', STEP_PX * 3)
        await expect.poll(readout).toBe('\u22123')
        point(button, 'pointerup', 0, 'touch', STEP_PX * 3)
        expect(appended.at(-1)).toMatchObject({ delta: -3 })
    })

    it('keeps to the way its first step went', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        await held(button)
        point(button, 'pointermove', 2, 'touch', -STEP_PX)
        await expect.poll(readout).toBe('+1')
        point(button, 'pointermove', STEP_PX * 6, 'touch', -STEP_PX)
        await expect.poll(readout).toBe('+1')
        point(button, 'pointerup', STEP_PX * 6, 'touch', -STEP_PX)
        expect(appended[0]).toMatchObject({ delta: 1 })
    })

    it('is undone as one', async () => {
        const { rendered } = sheet()
        const screen = await rendered
        const button = buttonIn('OPV 1', 0)
        await held(button)
        point(button, 'pointermove', STEP_PX * 4)
        point(button, 'pointerup', STEP_PX * 4)
        await expect.element(button).toHaveTextContent('4')
        await screen.getByRole('button', { name: 'Undo last mark' }).click()
        await expect.element(button).toHaveTextContent('0')
    })

    it('counts a press that is held and never slid as a tap', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        const before = button.getBoundingClientRect().width
        await held(button)
        await expect.element(button).toHaveAttribute('data-scrubbing')
        await expect.poll(readout).toBeUndefined()
        await expect
            .poll(() => button.getBoundingClientRect().width - before)
            .toBeCloseTo(2, 0)
        expect(getComputedStyle(button).boxShadow).not.toBe('none')
        expect(button.querySelectorAll('svg')).toHaveLength(4)
        point(button, 'pointerup', 0)
        button.click()
        await expect.element(button).toHaveTextContent('1')
        expect(appended).toEqual([expect.objectContaining({ kind: 'tap' })])
    })

    it('saves nothing for a slide that comes back to where it began', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        await held(button)
        point(button, 'pointermove', STEP_PX * 2)
        point(button, 'pointermove', 0)
        point(button, 'pointerup', 0)
        button.click()
        await expect.element(button).toHaveTextContent('0')
        expect(appended).toEqual([])
    })

    it('leaves a touch that moves before the hold to scroll the sheet', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        point(button, 'pointerdown', 0)
        point(button, 'pointermove', STEP_PX * 3)
        await wait(HOLD_MS + 60)
        point(button, 'pointermove', STEP_PX * 6)
        await expect.poll(readout).toBeUndefined()
        point(button, 'pointerup', STEP_PX * 6)
        expect(appended).toEqual([])
    })

    it('works the same for a mouse held still, then slid', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        point(button, 'pointerdown', 0, 'mouse')
        await wait(HOLD_MS + 60)
        await expect.element(button).toHaveAttribute('data-scrubbing')
        point(button, 'pointermove', STEP_PX * 2 + 1, 'mouse')
        await expect.poll(readout).toBe('+2')
        point(button, 'pointerup', STEP_PX * 2 + 1, 'mouse')
        expect(appended[0]).toMatchObject({ kind: 'correction', delta: 2 })
    })

    it('does not adjust for a mouse dragged before the hold', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        point(button, 'pointerdown', 0, 'mouse')
        point(button, 'pointermove', STEP_PX * 3, 'mouse')
        await wait(HOLD_MS + 60)
        expect(button).not.toHaveAttribute('data-scrubbing')
        point(button, 'pointerup', STEP_PX * 3, 'mouse')
        button.click()
        expect(appended).toEqual([])
        button.focus()
        await userEvent.keyboard('{Enter}')
        await expect.element(button).toHaveTextContent('1')
        button.click()
        await expect.element(button).toHaveTextContent('2')
    })

    it('counts the click after a touch that wobbled before the hold', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        point(button, 'pointerdown', 0)
        point(button, 'pointermove', 10)
        point(button, 'pointerup', 10)
        button.click()
        await expect.element(button).toHaveTextContent('1')
        expect(appended).toEqual([expect.objectContaining({ kind: 'tap' })])
    })

    it('drops the slide on Escape', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        button.focus()
        await held(button)
        point(button, 'pointermove', STEP_PX * 3)
        await userEvent.keyboard('{Escape}')
        await expect.poll(readout).toBeUndefined()
        point(button, 'pointerup', STEP_PX * 3)
        button.click()
        await expect.element(button).toHaveTextContent('0')
        expect(appended).toEqual([])
    })

    it('counts a key press after a dropped slide was let go off the button', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        button.focus()
        await held(button)
        point(button, 'pointermove', STEP_PX * 3)
        await userEvent.keyboard('{Escape}')
        await expect.poll(readout).toBeUndefined()
        await userEvent.keyboard('{Enter}')
        await expect.element(button).toHaveTextContent('1')
        expect(appended).toMatchObject([{ kind: 'tap' }])
    })

    it('drops the slide when the pointer is cancelled', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        await held(button)
        point(button, 'pointermove', STEP_PX * 3)
        point(button, 'pointercancel', STEP_PX * 3)
        await expect.element(button).toHaveTextContent('0')
        expect(appended).toEqual([])
    })

    it('adds sliding left in a right-to-left page', async () => {
        const { appended, rendered } = sheet([], 'rtl')
        await rendered
        const button = buttonIn('OPV 1', 0)
        await held(button)
        point(button, 'pointermove', -STEP_PX * 2)
        await expect.poll(readout).toBe('+2')
        point(button, 'pointerup', -STEP_PX * 2)
        expect(appended[0]).toMatchObject({ delta: 2 })
    })
})

describe('the plus and minus keys on a count', () => {
    it('add one and take one off, and stop at nothing', async () => {
        const { appended, rendered } = sheet()
        await rendered
        const button = buttonIn('OPV 1', 0)
        button.focus()
        await userEvent.keyboard('+')
        await userEvent.keyboard('=')
        await expect.element(button).toHaveTextContent('2')
        await userEvent.keyboard('-')
        await expect.element(button).toHaveTextContent('1')
        await userEvent.keyboard('-')
        await userEvent.keyboard('-')
        await expect.element(button).toHaveTextContent('0')
        expect(appended.map(({ kind }) => kind)).toEqual([
            'tap',
            'tap',
            'correction',
            'correction',
        ])
        expect(button).toHaveAttribute('aria-keyshortcuts', '+ -')
    })

    it('do not repeat while held', async () => {
        const { rendered } = sheet([correctionOn('opv1', GIRL, 5)])
        await rendered
        const button = buttonIn('OPV 1', 0)
        button.focus()
        await userEvent.keyboard('{->3/}')
        await expect.element(button).toHaveTextContent('4')
    })

    it('leave the count alone when pressed with Ctrl, Cmd or Alt, as for zooming the page', async () => {
        const { appended, rendered } = sheet([correctionOn('opv1', GIRL, 5)])
        await rendered
        const button = buttonIn('OPV 1', 0)
        button.focus()
        for (const held of [
            { key: '=', ctrlKey: true },
            { key: '=', metaKey: true },
            { key: '+', metaKey: true },
            { key: '-', ctrlKey: true },
            { key: '-', metaKey: true },
            { key: '-', altKey: true },
        ]) {
            button.dispatchEvent(
                new KeyboardEvent('keydown', { bubbles: true, ...held })
            )
        }
        await userEvent.keyboard('+')
        await expect.element(button).toHaveTextContent('6')
        expect(appended).toHaveLength(1)
    })
})
