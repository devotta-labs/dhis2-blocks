import { CustomDataProvider } from '@dhis2/app-runtime'
import React, { Profiler, type ReactNode } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { FieldModel } from '../../model/buildFormModel'
import {
    createFormModelSource,
    EventFormFieldContext,
} from '../EventForm/EventFormContext'
import { EventFormField } from '../EventFormField'
import { EventFormTextProvider } from '../EventFormText'
import {
    attribution,
    baseField,
    depthTo,
    found,
    interpolate,
    manyChoices,
    modelOf,
    mountField,
    textbox,
    yesNo,
    type Commit,
    type MountOptions,
} from './fieldTestSupport'

const mount = (fields: FieldModel | FieldModel[], options?: MountOptions) =>
    mountField(vi.fn<Commit>(), fields, options)

const unitsById = new Map([
    [
        'ouRoot00001',
        {
            id: 'ouRoot00001',
            displayName: 'Sierra Leone',
            path: '/ouRoot00001',
            ancestors: [],
            children: [
                {
                    id: 'ouBo000001',
                    displayName: 'Bo',
                    path: '/ouRoot00001/ouBo000001',
                },
            ],
        },
    ],
    [
        'ouBo000001',
        {
            id: 'ouBo000001',
            displayName: 'Bo',
            path: '/ouRoot00001/ouBo000001',
            ancestors: [{ displayName: 'Sierra Leone' }],
            children: [],
        },
    ],
])

const withOrgUnits = (children: ReactNode) => (
    <CustomDataProvider
        data={{
            organisationUnits: async (
                _type: string,
                query: { id?: string; params?: object }
            ) => {
                const unit =
                    query.id === undefined ? undefined : unitsById.get(query.id)
                if (unit === undefined) {
                    throw new Error(`Unknown organisation unit ${query.id}`)
                }
                const fields = JSON.stringify(query.params ?? {})
                return {
                    id: unit.id,
                    displayName: unit.displayName,
                    path: unit.path,
                    ancestors: unit.ancestors,
                    children: fields.includes('children::size')
                        ? unit.children.length
                        : unit.children,
                }
            },
        }}
    >
        {children}
    </CustomDataProvider>
)

describe('organisation unit fields', () => {
    it('picks an organisation unit and commits its uid', async () => {
        const { commit } = await mount(baseField({ kind: 'orgUnit' }), {
            orgUnitRoots: ['ouRoot00001'],
            wrap: withOrgUnits,
        })
        await page.getByRole('combobox', { name: 'Field one' }).click()
        await page.getByText('Sierra Leone').click()
        expect(commit).toHaveBeenCalledWith('f1', 'ouRoot00001')
    })

    it('shows the path above the name of the selected unit and clears it', async () => {
        const { commit } = await mount(
            baseField({ kind: 'orgUnit', value: 'ouBo000001' }),
            { orgUnitRoots: ['ouRoot00001'], wrap: withOrgUnits }
        )
        const trigger = page.getByRole('combobox', { name: 'Field one' })
        await expect.element(trigger).toHaveTextContent('Sierra Leone')
        await expect.element(trigger).toHaveTextContent('Bo')
        const path = page.getByTestId('orgunit-path')
        const name = page.getByTestId('orgunit-name')
        await expect.element(path).toHaveTextContent('Sierra Leone')
        await expect.element(name).toHaveTextContent('Bo')
        const pathBox = path.element().getBoundingClientRect()
        const nameBox = name.element().getBoundingClientRect()
        expect(pathBox.bottom).toBeLessThanOrEqual(nameBox.top + 1)
        await page.getByRole('button', { name: 'Clear' }).click()
        expect(commit).toHaveBeenCalledWith('f1', undefined)
    })
})

describe('unsupported fields', () => {
    it('shows the stored value read-only and says the type is not supported', async () => {
        const { commit } = await mount(
            baseField({
                kind: 'unsupported',
                unsupported: true,
                unsupportedReason: 'valueType',
                disabled: true,
                value: 'file-id-123',
            })
        )
        const shown = page.getByText('file-id-123')
        await expect.element(shown).toBeVisible()
        await expect
            .element(page.getByText('This value type is not supported here'))
            .toBeVisible()
        expect(page.getByRole('textbox').elements()).toHaveLength(0)
        expect(commit).not.toHaveBeenCalled()
    })

    it('says no options are available for an option set without options', async () => {
        await mount(
            baseField({
                kind: 'unsupported',
                unsupported: true,
                unsupportedReason: 'noOptions',
                disabled: true,
            })
        )
        await expect
            .element(page.getByText('No options are available for this field'))
            .toBeVisible()
        await expect
            .element(page.getByText('This value type is not supported here'))
            .not.toBeInTheDocument()
    })
})

describe('field shell', () => {
    it('assigned field is read-only and says why', async () => {
        const { commit } = await mount(
            baseField({
                value: 'calculated',
                disabled: true,
                assignedBy: attribution,
            })
        )
        await expect.element(textbox()).toBeDisabled()
        await expect.element(textbox()).toHaveValue('calculated')
        await expect
            .element(page.getByText('Calculated by a program rule'))
            .toBeVisible()
        expect(commit).not.toHaveBeenCalled()
    })

    it('a read-only form disables every field', async () => {
        await mount(baseField(), { readOnly: true })
        await expect.element(textbox()).toBeDisabled()
    })

    it('description is linked with aria-describedby', async () => {
        await mount(baseField({ description: 'Enter the weight in kg' }))
        const input = textbox().element()
        const describedBy = input.getAttribute('aria-describedby') ?? ''
        const described = describedBy
            .split(' ')
            .map((id) => document.getElementById(id)?.textContent)
        expect(described).toContain('Enter the weight in kg')
    })

    it('a choice group is described by the description too', async () => {
        await mount(
            baseField({
                kind: 'choice',
                choices: yesNo,
                description: 'Pick one answer',
            })
        )
        const group = page.getByRole('group', { name: 'Field one' }).last()
        const describedBy = group.element().getAttribute('aria-describedby')
        expect(describedBy).not.toBeNull()
        expect(
            document.getElementById(describedBy?.split(' ')[0] ?? '')
                ?.textContent
        ).toBe('Pick one answer')
    })

    it('opens the description in a popover from a dotted label', async () => {
        await mount([
            baseField({
                id: 'described',
                label: 'Described',
                description: 'Enter the weight in kg',
            }),
            baseField({ id: 'plain', label: 'Plain' }),
        ])
        // Only a field with a description gets the dotted trigger.
        expect(
            page.getByRole('button', { name: 'Plain' }).elements()
        ).toHaveLength(0)
        const trigger = page.getByRole('button', { name: 'Described' })
        await expect.element(trigger).toHaveClass(/decoration-dotted/)
        // The description is not shown inline, and the label still names the input.
        expect(page.getByRole('dialog').elements()).toHaveLength(0)
        await expect
            .element(page.getByRole('textbox', { name: 'Described' }))
            .toBeVisible()
        await trigger.click()
        await expect
            .element(page.getByRole('dialog'))
            .toHaveTextContent('Enter the weight in kg')
    })

    it('tags rule messages Rule and value errors Value', async () => {
        await mount(
            baseField({
                messages: {
                    error: 'Enter a number',
                    warning: 'Looks high',
                    ruleErrors: [
                        {
                            kind: 'error',
                            text: 'Must be after the visit date',
                            by: attribution,
                        },
                    ],
                },
            })
        )
        const valueMessage = page.getByTestId('field-message-value')
        const ruleMessages = page.getByTestId('field-message-rule')
        await expect.element(valueMessage).toHaveTextContent('Value')
        await expect.element(valueMessage).toHaveTextContent('Enter a number')
        expect(ruleMessages.elements()).toHaveLength(2)
        await expect
            .element(page.getByText('Must be after the visit date'))
            .toBeVisible()
        await expect.element(page.getByText('Looks high')).toBeVisible()
        await expect.element(textbox()).toBeInvalid()
        const describedBy = textbox().element().getAttribute('aria-describedby')
        expect(describedBy).not.toBeNull()
    })

    it('says a required field is missing', async () => {
        await mount(baseField({ required: true, requiredMissing: true }))
        await expect
            .element(page.getByText('This field is required'))
            .toBeVisible()
        await expect.element(textbox()).toBeInvalid()
    })

    it('renders nothing for a hidden field or an unknown id', async () => {
        const { screen } = await mount(
            [
                baseField({ hidden: true }),
                baseField({ id: 'f2', label: 'Two' }),
            ],
            { ids: ['f1', 'missing', 'f2'] }
        )
        expect(page.getByText('Field one').elements()).toHaveLength(0)
        await expect.element(textbox('Two')).toBeVisible()
        expect(screen.container.querySelectorAll('input')).toHaveLength(1)
    })

    it('sends every user-facing string through the translate context', async () => {
        await mount(
            [
                baseField({
                    kind: 'choice',
                    choices: yesNo,
                    messages: {
                        error: 'Select Yes or No',
                        ruleErrors: [],
                    },
                    assignedBy: attribution,
                    disabled: true,
                }),
                baseField({
                    id: 'f2',
                    kind: 'unsupported',
                    unsupported: true,
                    unsupportedReason: 'valueType',
                    disabled: true,
                    label: 'Other',
                }),
            ],
            {
                translate: (message, values) =>
                    `«${interpolate(message, values)}»`,
            }
        )
        await expect.element(page.getByText('«Yes»')).toBeVisible()
        await expect.element(page.getByText('«No»')).toBeVisible()
        await expect.element(page.getByText('«Select Yes or No»')).toBeVisible()
        await expect
            .element(page.getByText('«Calculated by a program rule»'))
            .toBeVisible()
        await expect
            .element(page.getByText('«This value type is not supported here»'))
            .toBeVisible()
        await expect.element(page.getByText('«Value»')).toBeVisible()
        // Labels come from metadata and are not translated.
        await expect.element(page.getByText('Field one').first()).toBeVisible()
    })
})

describe('field subscriptions', () => {
    it('re-renders only the field whose model changed', async () => {
        const renders = { f1: 0, f2: 0 }
        const one = baseField()
        const two = baseField({ id: 'f2', label: 'Two' })
        const source = createFormModelSource(modelOf(one, two))
        await render(
            <EventFormTextProvider translate={(message) => message}>
                <EventFormFieldContext.Provider
                    value={{
                        source,
                        commit: () => undefined,
                        calendar: {
                            calendar: 'gregorian',
                            dateFormat: 'YYYY-MM-DD',
                        },
                        readOnly: false,
                        orgUnitRoots: [],
                    }}
                >
                    <Profiler
                        id="f1"
                        onRender={() => {
                            renders.f1 += 1
                        }}
                    >
                        <EventFormField id="f1" />
                    </Profiler>
                    <Profiler
                        id="f2"
                        onRender={() => {
                            renders.f2 += 1
                        }}
                    >
                        <EventFormField id="f2" />
                    </Profiler>
                </EventFormFieldContext.Provider>
            </EventFormTextProvider>
        )
        const before = { ...renders }
        source.setModel(modelOf(one, { ...two, value: 'changed' }))
        await expect.element(textbox('Two')).toHaveValue('changed')
        expect(renders.f2).toBeGreaterThan(before.f2)
        expect(renders.f1).toBe(before.f1)
    })
})

const MAX_DEPTH = 6

/** One entry per widget kind: the element that takes the user's input, and what to render. */
const DEPTH_CASES: [string, FieldModel, string, MountOptions?][] = [
    ['text', baseField(), 'input'],
    ['number', baseField({ kind: 'number', inputMode: 'decimal' }), 'input'],
    ['longText', baseField({ kind: 'longText' }), 'textarea'],
    ['choice', baseField({ kind: 'choice', choices: yesNo }), 'button'],
    [
        'radio',
        baseField({ kind: 'choice', radioLayout: 'vertical', choices: yesNo }),
        '[role=radio]',
    ],
    ['select', baseField({ kind: 'select', choices: manyChoices }), 'button'],
    [
        'multiSelect',
        baseField({ kind: 'multiSelect', choices: manyChoices }),
        '[role=combobox]',
    ],
    ['trueOnly', baseField({ kind: 'trueOnly' }), '[role=checkbox]'],
    ['date', baseField({ kind: 'date' }), 'input'],
    ['dateTime (date)', baseField({ kind: 'dateTime' }), 'input[type=text]'],
    ['dateTime (time)', baseField({ kind: 'dateTime' }), 'input[type=time]'],
    ['time', baseField({ kind: 'time' }), 'input'],
    ['age', baseField({ kind: 'age' }), 'input'],
    ['coordinate (latitude)', baseField({ kind: 'coordinate' }), 'input'],
    [
        'orgUnit',
        baseField({ kind: 'orgUnit' }),
        '[role=combobox]',
        { orgUnitRoots: ['ouRoot00001'], wrap: withOrgUnits },
    ],
    // The real CalendarInput throws for the Ethiopian calendar, so these take the fallback input.
    ...(['date', 'dateTime', 'age'] as const).map(
        (kind): [string, FieldModel, string, MountOptions] => [
            `${kind} (fallback)`,
            baseField({ kind }),
            '[data-testid=date-text-fallback]',
            { calendar: { calendar: 'ethiopian', dateFormat: 'YYYY-MM-DD' } },
        ]
    ),
    [
        'unsupported',
        baseField({
            kind: 'unsupported',
            unsupported: true,
            unsupportedReason: 'valueType',
            disabled: true,
            value: 'x',
        }),
        '[role=group] p',
    ],
]

describe('component depth', () => {
    it(`depth from EventFormField to the input is ≤ ${MAX_DEPTH} own components for every kind`, async () => {
        const depths = new Map<string, number>()
        for (const [name, field, selector, options] of DEPTH_CASES) {
            const { screen } = await mount(field, options)
            depths.set(
                name,
                depthTo(found(screen.container.querySelector(selector)))
            )
            await screen.unmount()
        }
        // EventForm, EventFormSections and EventFormSection add three above EventFormField, and
        // the whole path has to stay under 10.
        expect([...depths].filter(([, depth]) => depth > MAX_DEPTH)).toEqual([])
        expect(depths.size).toBe(DEPTH_CASES.length)
    })
})
