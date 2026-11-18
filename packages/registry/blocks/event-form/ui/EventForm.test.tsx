import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { todayIso, typedText } from '@/components/dhis2-value-types'
import {
    CHILD_VISIT,
    CHILD_VISIT_RULES,
    CHILD_VISIT_VARIABLES,
    childVisitProgram,
} from '../__tests__/childVisit'
import { editable, renderForm, serve } from '../__tests__/serve'
import { EventForm } from './EventForm'
import { settingsOf } from '../lib/metadata'

const SECTIONS = ['Measurements', 'Patient', 'Assessment', 'Follow-up']

const weight = () => page.getByRole('textbox', { name: 'Weight (kg)' })

/** The section legends on the page, in page order. */
const sectionLegends = () =>
    [...document.querySelectorAll('[data-slot="field-legend"]')]
        .map((legend) => legend.textContent ?? '')
        .filter((text) => SECTIONS.includes(text))

test('the sections show in order, each with its legend, and a field in no section is not shown', async () => {
    await renderForm()
    await editable()
    // Follow-up is hidden by a rule while there is no outcome.
    expect(sectionLegends()).toEqual(['Measurements', 'Patient', 'Assessment'])
    expect(page.getByText('Internal code').query()).toBeNull()
})

test('a stage without sections is one group with no legend', async () => {
    await renderForm({ program: childVisitProgram({ sections: false }) })
    await editable()
    expect(sectionLegends()).toEqual([])
    await expect
        .element(page.getByRole('textbox', { name: 'Internal code' }))
        .toBeVisible()
})

test('a new event for another org unit starts afresh', async () => {
    const server = serve({
        program: childVisitProgram(),
        rules: CHILD_VISIT_RULES,
        variables: CHILD_VISIT_VARIABLES,
    })
    const form = (orgUnitId: string) => (
        <EventForm
            programId={CHILD_VISIT.programId}
            programStageId={CHILD_VISIT.stageId}
            orgUnitId={orgUnitId}
            blame="off"
        />
    )
    const screen = await render(form(CHILD_VISIT.orgUnitId), {
        wrapper: server.wrapper,
    })
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('70{Tab}')
    await screen.rerender(form('OtherOrgUnt'))
    await editable()
    await expect.element(weight()).toHaveValue('')
})

test("the event date is labelled by the stage and holds today's date", async () => {
    await renderForm()
    const settings = settingsOf({
        calendar: 'iso8601',
        dateFormat: 'yyyy-MM-dd',
    })
    await expect
        .element(page.getByRole('textbox', { name: 'Visit date' }))
        .toHaveValue(typedText({ valueType: 'DATE' }, todayIso(), settings))
})

test('a weight sets the dose, and the dose the daily total, each read-only', async () => {
    await renderForm()
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('150{Tab}')
    const dose = page.getByRole('textbox', { name: 'Paracetamol dose (mg)' })
    await expect.element(dose).toHaveValue('300')
    await expect.element(dose).toHaveAttribute('readonly')
    await expect
        .element(dose)
        .toHaveAccessibleDescription(/Set by a program rule/)
    await expect
        .element(page.getByRole('textbox', { name: 'Daily total (mg)' }))
        .toHaveValue('1200')
})

test('a rule hides Pregnant for a man', async () => {
    await renderForm()
    await editable()
    await expect
        .element(page.getByText('Pregnant', { exact: true }))
        .toBeVisible()
    await userEvent.click(
        page.getByRole('radio', { name: 'Male', exact: true })
    )
    await expect
        .element(page.getByText('Pregnant', { exact: true }))
        .not.toBeInTheDocument()
})

test('Enter in a field commits its value and does not save', async () => {
    const { to } = await renderForm()
    await editable()
    await userEvent.click(weight())
    await userEvent.keyboard('150{Enter}')
    await expect
        .element(page.getByRole('textbox', { name: 'Paracetamol dose (mg)' }))
        .toHaveValue('300')
    expect(to('tracker')).toHaveLength(0)
})

test('the rules load alongside the stage', async () => {
    const { to, release } = await renderForm({ held: ['programs'] })
    await expect.poll(() => to('programRules').length).toBeGreaterThan(0)
    release()
    await editable()
})

test('while the rules load, the form shows its skeleton', async () => {
    const { to, release } = await renderForm({ held: ['programRules'] })
    await expect.poll(() => to('programRules').length).toBeGreaterThan(0)
    // Long enough for the stage, which is answered, to have been shown.
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect.element(page.getByText('Loading the form')).toBeInTheDocument()
    expect(weight().query()).toBeNull()
    release()
    await editable()
})

test('loading shows a skeleton', async () => {
    const { release } = await renderForm({ held: ['programs'] })
    await expect.element(page.getByText('Loading the form')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    release()
    await editable()
})

test('a program that fails to load says so', async () => {
    await renderForm({ failing: ['programs'] })
    await expect
        .element(
            page
                .getByRole('alert')
                .filter({ hasText: 'The form could not be loaded' })
        )
        .toBeVisible()
})
