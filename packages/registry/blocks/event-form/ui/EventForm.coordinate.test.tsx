import { page, userEvent } from 'vitest/browser'
import {
    CHILD_VISIT,
    CHILD_VISIT_PATH,
    CHILD_VISIT_RULES,
    childVisitProgram,
    SAVED_VISIT,
} from '../__tests__/childVisit'
import type { ChildVisitVariant } from '../__tests__/childVisit'
import { editable, renderForm } from '../__tests__/serve'

const HOME = 'labHomeLoc1'

const CHC = {
    path: CHILD_VISIT_PATH,
    displayName: 'Ngelehun CHC',
    geometry: { type: 'Point', coordinates: [-11.4197, 8.1039] },
}

/** The Child visit stage with a coordinate data element, Home location, in its Patient section. */
const withHome = (variant?: ChildVisitVariant, compulsory = false) => {
    const program = childVisitProgram(variant)
    const [stage] = program.programStages
    return {
        ...program,
        programStages: [
            {
                ...stage,
                programStageDataElements: [
                    ...stage.programStageDataElements,
                    {
                        compulsory,
                        allowFutureDate: false,
                        dataElement: {
                            id: HOME,
                            displayFormName: 'Home location',
                            valueType: 'COORDINATE',
                        },
                    },
                ],
                programStageSections: stage.programStageSections.map(
                    (section) =>
                        section.id === 'labSecPatnt'
                            ? {
                                  ...section,
                                  dataElements: [
                                      ...section.dataElements,
                                      { id: HOME },
                                  ],
                              }
                            : section
                ),
            },
        ],
    }
}

const homeRule = (
    number: number,
    condition: string,
    action: { programRuleActionType: string; data?: string; content?: string }
) => ({
    id: `labRuleHom${number}`,
    name: `Home location ${number}`,
    displayName: `Home location ${number}`,
    condition,
    programRuleActions: [
        {
            id: `labActnHom${number}`,
            dataElement: { id: HOME },
            displayContent: action.content,
            ...action,
        },
    ],
})

// A heavy child is checked at home, and a heavier one is placed at the clinic by a rule.
const RULES = {
    programRules: [
        ...CHILD_VISIT_RULES.programRules,
        homeRule(1, '#{weight} > 40', {
            programRuleActionType: 'SHOWWARNING',
            content: 'Check the home location',
        }),
        homeRule(2, '#{weight} > 50', {
            programRuleActionType: 'ASSIGN',
            data: "'[-11.5,8.5]'",
        }),
    ],
}

const home = () => page.getByRole('textbox', { name: 'Home location' })
const weight = () => page.getByRole('textbox', { name: 'Weight (kg)' })
const save = () => page.getByRole('button', { name: 'Save' })

interface SentEvent {
    dataValues: Array<{ dataElement: string; value: string | null }>
}

const sentHome = (request: { data?: unknown }) =>
    // SAFETY: the form sends one event in a tracker import; the assertions check its values.
    (request.data as { events: [SentEvent] }).events[0].dataValues.find(
        ({ dataElement }) => dataElement === HOME
    )?.value

test('a coordinate typed is saved as [lng,lat], and the org unit is asked for to place it', async () => {
    const { to } = await renderForm({ program: withHome(), orgUnit: CHC })
    await editable()
    await userEvent.fill(home(), '8.4871, -13.2356')
    await userEvent.fill(weight(), '12')
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    expect(sentHome(to('tracker')[0])).toBe('[-13.2356,8.4871]')
    expect(to('organisationUnits')).toEqual([
        expect.objectContaining({
            params: { fields: 'path,displayName,geometry' },
        }),
    ])
})

test('a stored coordinate is shown as a place against the org unit', async () => {
    await renderForm(
        {
            program: withHome(),
            orgUnit: CHC,
            event: {
                ...SAVED_VISIT,
                dataValues: [
                    ...SAVED_VISIT.dataValues,
                    { dataElement: HOME, value: '[-11.4197,8.1327]' },
                ],
            },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await editable()
    await expect.element(home()).toHaveDisplayValue(/north of Ngelehun CHC$/)
    await expect
        .element(home())
        .toHaveAccessibleDescription(/Latitude 8\.1327, longitude -11\.4197/)
})

test('a required coordinate left empty says so on the field and holds Save back', async () => {
    const { to } = await renderForm({ program: withHome({}, true) })
    await editable()
    await userEvent.fill(weight(), '12')
    await save().click()
    await expect.element(home()).toHaveAttribute('aria-invalid', 'true')
    await expect.element(home()).toHaveAccessibleDescription(/Required/)
    expect(to('tracker')).toHaveLength(0)
})

test('text that is not a coordinate holds Save back, naming the field', async () => {
    const { to } = await renderForm({ program: withHome() })
    await editable()
    await userEvent.fill(home(), 'by the river')
    await userEvent.fill(weight(), '12')
    await save().click()
    await expect
        .element(page.getByRole('button', { name: /^Home location: / }))
        .toBeVisible()
    expect(to('tracker')).toHaveLength(0)
})

test('a rule’s message shows on the field', async () => {
    await renderForm({ program: withHome(), rules: RULES })
    await editable()
    await userEvent.fill(weight(), '45')
    await userEvent.click(home())
    await expect
        .element(page.getByText('Warning: Check the home location'))
        .toBeVisible()
})

test('a coordinate a rule sets is read-only, and saved as the rule set it', async () => {
    const { to } = await renderForm({ program: withHome(), rules: RULES })
    await editable()
    await userEvent.fill(weight(), '60')
    await userEvent.click(
        page.getByRole('textbox', { name: 'Temperature (°C)' })
    )
    await expect.element(home()).toHaveAttribute('readonly')
    await expect.element(home()).toHaveValue('8.5, -11.5')
    expect(
        page.getByRole('button', { name: 'Use my location' }).query()
    ).toBeNull()
    await save().click()
    await expect.poll(() => to('tracker')).toHaveLength(1)
    expect(sentHome(to('tracker')[0])).toBe('[-11.5,8.5]')
})

test('a locked event shows its coordinate read-only, without the buttons', async () => {
    await renderForm(
        {
            program: withHome({ blockEntryForm: true }),
            event: {
                ...SAVED_VISIT,
                status: 'COMPLETED',
                dataValues: [
                    ...SAVED_VISIT.dataValues,
                    { dataElement: HOME, value: '[-11.4197,8.1327]' },
                ],
            },
        },
        { eventId: CHILD_VISIT.eventId }
    )
    await expect
        .element(home(), { timeout: 10_000 })
        .toHaveAttribute('readonly')
    await expect.element(home()).toHaveValue('8.1327, -11.4197')
    expect(
        page.getByRole('button', { name: 'Use my location' }).query()
    ).toBeNull()
})
