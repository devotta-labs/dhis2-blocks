import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import calendarSource from '../examples/working-list/WorkingListCalendarTabs.tsx?raw'
import compositionSource from '../examples/working-list/ListCalendar.tsx?raw'
import listSource from '../examples/working-list/WorkingListDefault.tsx?raw'
import { getExample } from '../examples/registry'
import { ExampleCode } from './ExampleCode'

const renderCode = async (slug: string) => {
    const example = getExample(slug)
    if (!example) throw new Error(`Missing example: ${slug}`)
    return render(
        <div role="tabpanel">
            <ExampleCode example={example} />
        </div>
    )
}

const copyText = async (view: Awaited<ReturnType<typeof renderCode>>) => {
    await view.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect
        .element(view.getByRole('button', { name: 'Copied', exact: true }))
        .toBeVisible()
    return navigator.clipboard.readText()
}

describe('example source code', () => {
    it('shows and copies both calendar files inside the Code tab', async () => {
        const view = await renderCode('working-list/calendar')
        await expect
            .element(view.getByRole('group', { name: 'Source files' }))
            .toBeVisible()
        await expect
            .element(
                view.getByRole('button', {
                    name: 'WorkingListCalendarTabs.tsx',
                    exact: true,
                })
            )
            .toHaveAttribute('aria-pressed', 'true')
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('const WorkingListCalendarTabs =')
        expect(await copyText(view)).toBe(calendarSource.trimEnd())

        await view
            .getByRole('button', { name: 'ListCalendar.tsx', exact: true })
            .click()
        await expect
            .element(
                view.getByRole('button', {
                    name: 'ListCalendar.tsx',
                    exact: true,
                })
            )
            .toHaveAttribute('aria-pressed', 'true')
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('useWorkingListDateRange')
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('export const ListCalendar =')
        expect(await copyText(view)).toBe(compositionSource.trimEnd())

        await view
            .getByRole('button', {
                name: 'WorkingListCalendarTabs.tsx',
                exact: true,
            })
            .click()
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('const WorkingListCalendarTabs =')
    })

    it('keeps single-file examples directly copyable without a file picker', async () => {
        const view = await renderCode('working-list/default')
        await expect
            .element(view.getByRole('group', { name: 'Source files' }))
            .not.toBeInTheDocument()
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('const WorkingListDefault =')
        expect(await copyText(view)).toBe(listSource.trimEnd())
    })
})
