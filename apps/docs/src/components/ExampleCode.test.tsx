import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import calendarSource from '../examples/patient-list/PatientListCalendarTabs.tsx?raw'
import compositionSource from '../examples/patient-list/PatientCalendar.tsx?raw'
import listSource from '../examples/patient-list/PatientListDefault.tsx?raw'
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
    it('shows and copies both calendar files inside the Code tab', async () => {
        const copy = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue()
        const view = await renderCode('patient-list/calendar')
        await expect
            .element(view.getByRole('group', { name: 'Source files' }))
            .toBeVisible()
        await expect
            .element(
                view.getByRole('button', {
                    name: 'PatientListCalendarTabs.tsx',
                    exact: true,
                })
            )
            .toHaveAttribute('aria-pressed', 'true')
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('const PatientListCalendarTabs =')
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(calendarSource.trimEnd())

        await view
            .getByRole('button', { name: 'PatientCalendar.tsx', exact: true })
            .click()
        await expect
            .element(
                view.getByRole('button', {
                    name: 'PatientCalendar.tsx',
                    exact: true,
                })
            )
            .toHaveAttribute('aria-pressed', 'true')
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('usePatientListQuery')
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('export const PatientCalendar =')
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(compositionSource.trimEnd())

        await view
            .getByRole('button', {
                name: 'PatientListCalendarTabs.tsx',
                exact: true,
            })
            .click()
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('const PatientListCalendarTabs =')
    })

    it('keeps single-file examples directly copyable without a file picker', async () => {
        const copy = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue()
        const view = await renderCode('patient-list/default')
        await expect
            .element(view.getByRole('group', { name: 'Source files' }))
            .not.toBeInTheDocument()
        await expect
            .element(view.getByRole('tabpanel'))
            .toHaveTextContent('const PatientListDefault =')
        await view.getByRole('button', { name: 'Copy', exact: true }).click()
        expect(copy).toHaveBeenLastCalledWith(listSource.trimEnd())
    })
})
