import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import calendarSource from '../examples/working-list/WorkingListCalendarTabs.tsx?raw'
import compositionSource from '../examples/working-list/ListCalendar.tsx?raw'
import listSource from '../examples/working-list/WorkingListDefault.tsx?raw'
import pickerSource from '../examples/working-list/WorkingListProgramPicker.tsx?raw'
import placeholdersSource from '../examples/working-list/WorkingListPlaceholders.tsx?raw'
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

afterEach(() => vi.restoreAllMocks())

describe('example source code', () => {
    it('copies the program picker and its required placeholder, then switches back', async () => {
        const copy = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue()
        const view = await renderCode('working-list/program-picker')
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(pickerSource.trimEnd())
        await view
            .getByRole('button', {
                name: 'WorkingListPlaceholders.tsx',
                exact: true,
            })
            .click()
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(placeholdersSource.trimEnd())
        await view
            .getByRole('button', {
                name: 'WorkingListProgramPicker.tsx',
                exact: true,
            })
            .click()
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(pickerSource.trimEnd())
    })
    it('shows and copies both calendar files inside the Code tab', async () => {
        const copy = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue()
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
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(calendarSource.trimEnd())

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
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(compositionSource.trimEnd())

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
        const copy = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue()
        const view = await renderCode('working-list/default')
        await expect
            .element(view.getByRole('group', { name: 'Source files' }))
            .not.toBeInTheDocument()
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('const WorkingListDefault =')
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(listSource.trimEnd())
    })
})
