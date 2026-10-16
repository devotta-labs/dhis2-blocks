import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { WorkingListField } from '../../domain/model'
import { FilterButton } from '../FilterControls'
import { WorkingListTextProvider } from '../WorkingListText'

const unusedClient: WorkingListClient = {
    query: () => Promise.reject(new Error('Unexpected query')),
    mutate: () => Promise.reject(new Error('Unexpected mutation')),
}

const textField: WorkingListField = {
    id: 'firstName',
    displayName: 'First name',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
}

const dateField: WorkingListField = {
    id: 'birthday',
    displayName: 'Birthday',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'DATE',
    filterable: true,
}

const renderFilter = (field: WorkingListField) =>
    render(
        <WorkingListTextProvider translate={(message) => message}>
            <div className="p-4">
                <FilterButton
                    client={unusedClient}
                    field={field}
                    capabilities={resolveWorkingListCapabilities({
                        apiVersion: 43,
                    })}
                    calendarContext={{
                        calendar: 'gregorian',
                        dateFormat: 'YYYY-MM-DD',
                        locale: 'en',
                        timeZone: 'Etc/UTC',
                    }}
                    onApply={() => undefined}
                    onReset={() => undefined}
                />
                <button type="button" className="fixed right-2 bottom-2">
                    Elsewhere
                </button>
            </div>
        </WorkingListTextProvider>
    )

const editor = (field: WorkingListField) =>
    page.getByTestId(`filter-editor-${field.id}`)

/** True when `element` is what a click at its centre would actually hit. */
const paintsOnTop = (element: Element) => {
    const { left, top, width, height } = element.getBoundingClientRect()
    const hit = document.elementFromPoint(left + width / 2, top + height / 2)
    return hit !== null && (hit === element || element.contains(hit))
}

const openEditor = async (field: WorkingListField) => {
    await page.getByTestId(`filter-${field.id}`).getByRole('combobox').click()
    await expect.element(editor(field)).toBeVisible()
}

describe('filter editor popover stacking', () => {
    it('keeps a @dhis2/ui select opened inside the editor above it', async () => {
        await renderFilter(textField)
        await openEditor(textField)

        const operatorSelect = document.querySelector(
            `[data-test="filter-operator-${textField.id}"] [data-test="dhis2-uicore-select-input"]`
        )
        expect(operatorSelect).not.toBeNull()
        await userEvent.click(operatorSelect!)

        const option = page.getByText('Is empty', { exact: true })
        await expect.element(option).toBeVisible()
        expect(paintsOnTop(option.element())).toBe(true)

        await option.click()
        await expect.element(editor(textField)).toBeVisible()
        expect(
            document.querySelector(
                `[data-test="filter-operator-${textField.id}"]`
            )?.textContent
        ).toContain('Is empty')
    })

    it('keeps the @dhis2/ui CalendarInput popup above the editor', async () => {
        await renderFilter(dateField)
        await openEditor(dateField)

        const startInput = document.querySelector<HTMLInputElement>(
            '[data-test="date-range-start"] input'
        )
        expect(startInput).not.toBeNull()
        await userEvent.click(startInput!)

        // The calendar popup has no data-test; find its day in the DHIS2 layer.
        const findDay = () =>
            [
                ...document.querySelectorAll<HTMLElement>(
                    '[data-test="dhis2-uicore-layer"] td'
                ),
            ].find((cell) => cell.textContent?.trim() === '15')
        await expect.poll(findDay).toBeDefined()
        const day = findDay()!
        expect(paintsOnTop(day)).toBe(true)

        await userEvent.click(day)
        await expect.element(editor(dateField)).toBeVisible()
        await expect.poll(() => startInput?.value).toMatch(/-15$/)
    })

    it('closes on an outside press, Escape and a second press on its chip', async () => {
        await renderFilter(textField)
        const chip = page
            .getByTestId(`filter-${textField.id}`)
            .getByRole('combobox')

        await openEditor(textField)
        await page.getByRole('button', { name: 'Elsewhere' }).click()
        await expect.element(editor(textField)).not.toBeInTheDocument()

        await openEditor(textField)
        await userEvent.keyboard('{Escape}')
        await expect.element(editor(textField)).not.toBeInTheDocument()
        await expect.element(chip).toHaveFocus()

        await openEditor(textField)
        await chip.click()
        await expect.element(editor(textField)).not.toBeInTheDocument()
    })
})
