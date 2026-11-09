import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'

/**
 * Every docs example at WCAG 2.2 AA: axe with the default and the more-contrast
 * theme, then a Tab walk that checks each stop shows where focus is. Axe finds
 * about a third of WCAG problems; the rest need a person, so this is the floor.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const TAB_STOPS = 60

const slugs = [
    ...readFileSync('apps/docs/src/examples/registry.ts', 'utf8').matchAll(
        /slug: '([^']+)'/g
    ),
].map(([, slug]) => slug)

const open = async (page: Page, slug: string) => {
    await page.goto(`/preview/${slug}`)
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
}

const violations = async (page: Page) =>
    (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map(
        ({ id, help, nodes }) => ({
            id,
            help,
            targets: nodes.map(({ target }) => target.join(' ')),
        })
    )

/** The focused element and its row, styled as focused, then as not. */
const unmarkedStop = (page: Page) =>
    page.evaluate(() => {
        const element = document.activeElement
        if (
            !(element instanceof HTMLElement) ||
            element === document.body ||
            element.getClientRects().length === 0
        ) {
            return undefined
        }
        const marks = () =>
            [element, element.closest('tr')].map((part) => {
                if (part === null) {
                    return ''
                }
                const style = getComputedStyle(part)
                return [
                    style.outlineStyle,
                    style.outlineWidth,
                    style.outlineColor,
                    style.boxShadow,
                    style.borderColor,
                    style.backgroundColor,
                ].join(' ')
            })
        const focused = marks().join('|')
        element.blur()
        const blurred = marks().join('|')
        element.focus()
        if (focused !== blurred) {
            return undefined
        }
        const name =
            element.getAttribute('aria-label') ??
            element.textContent?.trim().slice(0, 40) ??
            ''
        return `${element.tagName.toLowerCase()}[role=${element.getAttribute('role') ?? ''}][slot=${element.dataset.slot ?? ''}] ${name}`
    })

for (const slug of slugs) {
    test.describe(slug, () => {
        test(`axe: ${slug}`, async ({ page }) => {
            await open(page, slug)
            expect(await violations(page)).toEqual([])
        })

        test(`axe, more contrast: ${slug}`, async ({ page }) => {
            await page.emulateMedia({ contrast: 'more' })
            await open(page, slug)
            expect(await violations(page)).toEqual([])
        })

        test(`focus shows: ${slug}`, async ({ page }) => {
            await open(page, slug)
            const unmarked = new Set<string>()
            for (let stop = 0; stop < TAB_STOPS; stop++) {
                await page.keyboard.press('Tab')
                const found = await unmarkedStop(page)
                if (found !== undefined) {
                    unmarked.add(found)
                }
            }
            expect([...unmarked]).toEqual([])
        })
    })
}
