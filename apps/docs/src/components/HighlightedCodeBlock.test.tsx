import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { HighlightedCodeBlock } from './HighlightedCodeBlock'
import { CanvasCode } from '../playground/CanvasCode'
import { loadHighlighter } from '../lib/highlighter'

afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
})

const linesOf = (container: Element) =>
    [
        ...container.querySelectorAll('[data-slot="code-block-line-content"]'),
    ].map((line) => (line.textContent === '\n' ? '' : line.textContent))

describe('complete-source highlighting', () => {
    it('keeps multiline TSX grammar, blank lines and replacement text intact across themes', async () => {
        const code =
            'const label = `first\nsecond`\n\nconst node = <div>{label}</div>\n'
        const view = await render(
            <HighlightedCodeBlock code={code} language="tsx" />
        )
        await expect
            .poll(() =>
                view.container.querySelector('[style*="--shiki-light"]')
            )
            .not.toBeNull()
        expect(linesOf(view.container)).toEqual(code.slice(0, -1).split('\n'))
        const text = view.container.querySelector('code')?.textContent
        view.container.classList.add('dark')
        expect(view.container.querySelector('code')?.textContent).toBe(text)
        const continuation = view.container
            .querySelectorAll('[data-slot="code-block-line-content"]')[1]
            .querySelector('span')
        expect(continuation?.getAttribute('style')).toContain('--shiki-dark')
        const replacement = '/* changed\ncomment */\nconst x = 1\n\n'
        await view.rerender(
            <HighlightedCodeBlock code={replacement} language="tsx" />
        )
        expect(linesOf(view.container)).toEqual(
            replacement.slice(0, -1).split('\n')
        )
        await view.rerender(<HighlightedCodeBlock code="" language="tsx" />)
        expect(linesOf(view.container)).toEqual([''])
    })

    it('does not apply an old language after a language switch while loading', async () => {
        const code = '{"value": true}'
        const view = await render(
            <HighlightedCodeBlock code={code} language="python" />
        )
        await view.rerender(
            <HighlightedCodeBlock code={code} language="json" />
        )
        const current = await loadHighlighter('json')
        expect(current).not.toBeNull()
        await expect
            .poll(() =>
                view.container.querySelector('[style*="--shiki-light"]')
            )
            .not.toBeNull()
        const expected = await render(
            <div>{current!.highlight(code).lines}</div>
        )
        expect(
            view.container.querySelector(
                '[data-slot="code-block-line-content"]'
            )?.innerHTML
        ).toBe(expected.container.firstElementChild?.innerHTML)
    })

    it('leaves unsupported languages readable and copyable', async () => {
        const copy = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue()
        const view = await render(
            <HighlightedCodeBlock
                code={'unrecognized <tag>\n\n'}
                language="not-a-language"
            />
        )
        expect(linesOf(view.container)).toEqual(['unrecognized <tag>', ''])
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenCalledWith('unrecognized <tag>\n')
    })

    it('preserves CanvasCode prop offsets after slicing highlighted tokens', async () => {
        const code =
            'const Demo = ({ title }: Props) => (\n  <p title={title}>{title}</p>\n)\n'
        const starts = [...code.matchAll(/\btitle\b/g)].map(
            (match) => match.index
        )
        const source = {
            code,
            references: starts
                .filter((_, index) => index !== 1)
                .map((start) => ({ start, end: start + 5, path: ['title'] })),
            props: { title: 'Hello' },
        }
        const view = await render(<CanvasCode source={source} />)
        await expect
            .poll(() =>
                view.container.querySelector('[style*="--shiki-light"]')
            )
            .not.toBeNull()
        expect(linesOf(view.container)).toEqual(code.slice(0, -1).split('\n'))
        const references = view
            .getByRole('button', { name: 'Inspect title', exact: true })
            .elements()
        expect(references).toHaveLength(3)
        for (const reference of references)
            expect(reference.textContent).toBe('title')
    })
})

describe('copy feedback', () => {
    it('expires two seconds after the latest copy, including repeating the same value', async () => {
        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
        const view = await render(
            <HighlightedCodeBlock code="value" language="text" />
        )
        vi.useFakeTimers()
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        await act(() => vi.advanceTimersByTimeAsync(1500))
        await view.getByRole('button', { name: 'Copied', exact: true }).click()
        await act(() => vi.advanceTimersByTimeAsync(1500))
        await expect
            .element(view.getByRole('button', { name: 'Copied', exact: true }))
            .toBeVisible()
        await act(() => vi.advanceTimersByTimeAsync(501))
        await expect
            .element(view.getByRole('button', { name: 'Copy', exact: true }))
            .toBeVisible()
    })

    it('does not claim success when clipboard writes are rejected or unavailable', async () => {
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
            new Error('denied')
        )
        const view = await render(
            <HighlightedCodeBlock code="copy me" language="text" />
        )
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        await expect
            .element(view.getByRole('button', { name: 'Copy', exact: true }))
            .toBeVisible()
        const clipboard = Object.getOwnPropertyDescriptor(
            navigator,
            'clipboard'
        )
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: undefined,
        })
        try {
            await view
                .getByRole('button', { name: 'Copy', exact: true })
                .click()
            await expect
                .element(
                    view.getByRole('button', { name: 'Copy', exact: true })
                )
                .toBeVisible()
            expect(linesOf(view.container)).toEqual(['copy me'])
        } finally {
            if (clipboard)
                Object.defineProperty(navigator, 'clipboard', clipboard)
            else Reflect.deleteProperty(navigator, 'clipboard')
        }
    })
})
