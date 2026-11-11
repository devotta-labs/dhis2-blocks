/// <reference types="@vitest/browser-playwright" />
import type { CustomDataProvider } from '@dhis2/app-runtime'
import type { ComponentProps } from 'react'
import { userEvent } from 'vitest/browser'
import { control, shown } from '@/components/spreadsheet/grid/__tests__/gridRig'
import { cellKey } from '@/components/spreadsheet'
import enrollments from '../register/__tests__/fixtures/immunisation-enrollments.json'
import immunisation from '../register/__tests__/fixtures/immunisation-program.json'
import {
    DOSE,
    DPT_1,
    ENROLLED_AT,
    engineFor,
    enrolledAs,
    FIRST_NAME,
    immunisationRegister,
    LAST_NAME,
    LAYOUT,
    PROGRAM,
    VACCINATION,
} from '../register/__tests__/registerRig'
import { cleanUp, later, memorySource, mount } from './__tests__/rig'

afterEach(cleanUp)
beforeEach(() => {
    performance.clearMeasures('data-entry:rules')
})

const GENDER = 'cejWyOfXge6'
const REGISTER_NUMBER = 'ImmRegNo001'
const AMARA = {
    person: 'ImmTei00010',
    enrollment: 'ImmEnr00010',
    events: ['ImmEvt00001', 'ImmEvt00002'],
}
const BANGURA = { person: 'ImmTei00020', enrollment: 'ImmEnr00020' }
const BANGURA_BCG = 'ImmEvt00003'

const attribute = (name: string, id: string) => ({
    id: `var${name}`.slice(0, 11),
    name,
    programRuleVariableSourceType: 'TEI_ATTRIBUTE',
    useCodeForOptionSet: false,
    trackedEntityAttribute: { id, valueType: 'TEXT' },
})

/** A rule action as DHIS2 sends it. */
interface RuleAction {
    programRuleActionType: string
    content?: string
    data?: string
    trackedEntityAttribute?: { id: string }
    dataElement?: { id: string }
}

/** A rule of the register's program, on its vaccination stage when `stage` is set. */
const programRule = (
    id: string,
    name: string,
    condition: string,
    action: RuleAction,
    stage = false
) => ({
    id,
    name,
    displayName: name,
    condition,
    ...(stage && { programStage: { id: VACCINATION } }),
    programRuleActions: [{ id: `${id}A`, ...action }],
})

const RULES = [
    programRule('ruleName001', 'Check the name', "A{firstName} == 'Mo'", {
        programRuleActionType: 'SHOWWARNING',
        content: 'Is the name right?',
        trackedEntityAttribute: { id: FIRST_NAME },
    }),
    programRule(
        'ruleVisit01',
        'Check the child',
        "A{firstName} == 'Mo'",
        { programRuleActionType: 'SHOWWARNING', content: 'Check the child' },
        true
    ),
    programRule(
        'ruleGender1',
        'Hide the Banguras’ gender',
        "A{lastName} == 'Bangura'",
        {
            programRuleActionType: 'HIDEFIELD',
            trackedEntityAttribute: { id: GENDER },
        }
    ),
    programRule(
        'ruleCount01',
        'Count the doses',
        'V{event_count} > 2',
        {
            programRuleActionType: 'SHOWWARNING',
            content: 'More than two doses',
        },
        true
    ),
    programRule('ruleNumber1', 'Numbered', "A{registerNumber} == 'R-1'", {
        programRuleActionType: 'SHOWWARNING',
        content: 'Numbered',
        trackedEntityAttribute: { id: FIRST_NAME },
    }),
    programRule('ruleNote001', 'Note the gender', "A{gender} == 'Female'", {
        programRuleActionType: 'DISPLAYTEXT',
        content: 'A girl',
    }),
    programRule(
        'ruleDose001',
        'Check the dose',
        "d2:daysBetween(V{event_date}, '2026-10-30') == 0",
        {
            programRuleActionType: 'SHOWWARNING',
            content: 'Check the dose',
            dataElement: { id: DOSE },
        },
        true
    ),
    programRule(
        'ruleAssign1',
        'Assign the gender',
        "A{lastName} == 'Assigned'",
        {
            programRuleActionType: 'ASSIGN',
            data: "'Male'",
            trackedEntityAttribute: { id: GENDER },
        }
    ),
]

/** The rules above, and the people the server holds, as the fixture has them. */
const RULES_DATA = {
    programRules: async () => ({ programRules: RULES }),
    programRuleVariables: async () => ({
        programRuleVariables: [
            attribute('firstName', FIRST_NAME),
            attribute('lastName', LAST_NAME),
            attribute('gender', GENDER),
            attribute('registerNumber', REGISTER_NUMBER),
        ],
    }),
    constants: async () => ({ constants: [] }),
    programs: async () => ({
        id: PROGRAM,
        name: 'Child immunisation register',
        programStages: [{ id: VACCINATION, name: 'Vaccination' }],
    }),
    'tracker/enrollments': async (_type, query) => {
        const ids = String(query.params?.enrollments).split(',')
        return {
            pager: { page: 1, pageSize: 100 },
            enrollments: enrollments.enrollments.filter(({ enrollment }) =>
                ids.includes(enrollment)
            ),
        }
    },
} satisfies ComponentProps<typeof CustomDataProvider>['data']

const rulesRan = () =>
    expect
        .poll(
            () => performance.getEntriesByName('data-entry:rules', 'measure'),
            { timeout: 10_000 }
        )
        .not.toHaveLength(0)

/** The register loaded as DHIS2 answers it (`answers`), kept in memory, with its rules. */
const mountRegister = async (
    answers: Parameters<typeof engineFor>[0] = {},
    layout = LAYOUT,
    data: ComponentProps<typeof CustomDataProvider>['data'] = RULES_DATA
) => {
    const register = immunisationRegister({ layout })
    const form = await register.load(engineFor(answers).engine)
    const memory = memorySource(form)
    const mounted = await mount(
        { ...memory.source, newRow: register.newRow },
        { data }
    )
    await rulesRan()
    const effects = () => mounted.context().effects.getState()
    return { form, memory, effects, ...mounted }
}

test('typing an attribute re-runs the enrolment and its visits', async () => {
    const { effects } = await mountRegister()
    const name = cellKey(AMARA.person, FIRST_NAME)
    expect(effects().cells[name]?.messages ?? []).toEqual([])

    control(name).focus()
    await userEvent.keyboard('Mo{Enter}')

    await expect
        .poll(() => effects().cells[name]?.messages)
        .toEqual([
            { tone: 'warning', text: 'Is the name right?', source: 'rule' },
        ])
    for (const event of AMARA.events) {
        await expect
            .poll(() => effects().rowMessages.get(event))
            .toEqual([
                { tone: 'warning', text: 'Check the child', source: 'rule' },
            ])
    }
})

test('an attribute a rule hides shows Hidden by rule on the person’s cell', async () => {
    const { effects } = await mountRegister(
        {},
        {
            ...LAYOUT,
            columns: [...LAYOUT.columns, { field: { attribute: GENDER } }],
        }
    )
    await expect
        .poll(() => effects().cells[cellKey(BANGURA.person, GENDER)]?.hiddenBy)
        .toBe('Hidden by rule: Hide the Banguras’ gender')
    expect(
        effects().cells[cellKey(AMARA.person, GENDER)]?.hiddenBy
    ).toBeUndefined()
})

test('a person’s image stays to be edited in their own form once the rules have run', async () => {
    const PHOTO = 'ImmPhoto001'
    const { effects } = await mountRegister(
        {
            program: {
                ...immunisation,
                programTrackedEntityAttributes: [
                    ...immunisation.programTrackedEntityAttributes,
                    {
                        mandatory: false,
                        trackedEntityAttribute: {
                            valueType: 'IMAGE',
                            unique: false,
                            generated: false,
                            displayFormName: 'Photo',
                            id: PHOTO,
                        },
                    },
                ],
            },
        },
        {
            ...LAYOUT,
            columns: [...LAYOUT.columns, { field: { attribute: PHOTO } }],
        }
    )
    for (const { person } of [AMARA, BANGURA]) {
        expect(effects().cells[cellKey(person, PHOTO)]?.readOnly).toBe(
            'Edit this field in its own form'
        )
    }
})

test('a slot nobody typed in is not another event to the rules', async () => {
    const { effects } = await mountRegister()
    const doses = 'More than two doses'
    // Bangura has three doses, so the rule runs; Amara has two, and two empty slots that are no events.
    await expect
        .poll(() => effects().rowMessages.get(BANGURA_BCG))
        .toEqual([{ tone: 'warning', text: doses, source: 'rule' }])
    for (const event of AMARA.events) {
        expect(effects().rowMessages.get(event) ?? []).toEqual([])
    }
})

test('a slot’s first value makes it an event to the rules of the person’s other rows', async () => {
    const { effects, form, context } = await mountRegister()
    const slot =
        form.tables[0].rows.find(({ id }) => id === AMARA.enrollment)?.slots?.[
            DPT_1
        ] ?? ''
    for (const event of AMARA.events) {
        expect(effects().rowMessages.get(event) ?? []).toEqual([])
    }
    // A value no rule reads across events: the slot is a third dose all the same.
    context().store.getState().commit(cellKey(slot, DOSE), '1')
    for (const event of AMARA.events) {
        await expect
            .poll(() => effects().rowMessages.get(event))
            .toEqual([
                {
                    tone: 'warning',
                    text: 'More than two doses',
                    source: 'rule',
                },
            ])
    }
})

test('a new person’s reserved value feeds their enrolment’s rules', async () => {
    const numbered = {
        ...immunisation,
        programTrackedEntityAttributes: [
            ...immunisation.programTrackedEntityAttributes,
            {
                mandatory: false,
                trackedEntityAttribute: {
                    valueType: 'TEXT',
                    unique: true,
                    generated: true,
                    displayFormName: 'Register number',
                    id: REGISTER_NUMBER,
                },
            },
        ],
    }
    const { effects, view, tracker } = await mountRegister({
        program: numbered,
        reserved: [{ value: 'R-1' }],
    })
    view().addRow(PROGRAM)
    const newPerson = () =>
        [...tracker().records.values()].find(
            (record) => record.kind === 'trackedEntity' && record.isNew
        )?.id
    await expect.poll(newPerson).toBeDefined()
    const name = cellKey(newPerson() ?? '', FIRST_NAME)
    await expect
        .poll(() => effects().cells[name]?.messages)
        .toEqual([{ tone: 'warning', text: 'Numbered', source: 'rule' }])
})

test('the rules’ notes on a person join the register’s own', async () => {
    // Amara's BCG is recorded twice: the register shows the first and notes the other on her row.
    const twice = enrolledAs((enrollment) =>
        enrollment.enrollment === AMARA.enrollment
            ? {
                  ...enrollment,
                  events: [
                      ...enrollment.events,
                      { ...enrollment.events[0], event: 'ImmEvt00099' },
                  ],
              }
            : enrollment
    )
    const { effects, form } = await mountRegister({ enrollments: twice })
    const own = form.rowNotes?.get(AMARA.enrollment) ?? []
    expect(own).toHaveLength(1)
    await expect
        .poll(() => effects().rowNotes.get(AMARA.enrollment))
        .toEqual([...own, 'A girl'])
})

test('a slot cleared back to empty loses what the rules said while it had a date', async () => {
    const { effects, form, view } = await mountRegister()
    const slot =
        form.tables[0].rows.find(({ id }) => id === AMARA.enrollment)?.slots?.[
            DPT_1
        ] ?? ''
    const date = cellKey(slot, 'occurredAt')
    const dose = cellKey(slot, DOSE)
    const warned = () =>
        view().summary.items.some(({ text }) => text === 'Check the dose')

    ;(await shown(date)).focus()
    await userEvent.keyboard('2026-10-30{Enter}')
    await expect
        .poll(() => effects().cells[dose]?.messages)
        .toEqual([{ tone: 'warning', text: 'Check the dose', source: 'rule' }])
    expect(warned()).toBe(true)

    control(date).focus()
    await userEvent.keyboard(`{F2}${'{Backspace}'.repeat(10)}{Enter}`)
    await expect.poll(() => effects().cells[dose]?.messages ?? []).toEqual([])
    expect(warned()).toBe(false)
})

/** The fixture with Amara's last name the one the assigning rule looks for. */
const assigned = enrolledAs((enrollment) =>
    enrollment.enrollment === AMARA.enrollment
        ? {
              ...enrollment,
              attributes: enrollment.attributes.map((each) =>
                  each.attribute === LAST_NAME
                      ? { ...each, value: 'Assigned' }
                      : each
              ),
          }
        : enrollment
)
const AMARA_GENDER = cellKey(AMARA.person, GENDER)

test('an enrolment rule’s value lands on the person’s attribute once the person or the enrolment is touched', async () => {
    const touchPerson = await mountRegister({ enrollments: assigned })
    const gender = () =>
        touchPerson.context().store.getState().cells[AMARA_GENDER]
    // Shown, not saved: nobody changed the row.
    expect(touchPerson.effects().cells[AMARA_GENDER]?.readOnly).toBe(
        'Assigned by rule: Assign the gender'
    )
    await later(200)
    expect(gender()?.value).toBe('Female')

    control(cellKey(AMARA.person, FIRST_NAME)).focus()
    await userEvent.keyboard('Ama{Enter}')
    await expect.poll(gender).toMatchObject({ value: 'Male', source: 'rule' })
    await expect
        .poll(() => touchPerson.memory.sent.flat().map(({ key }) => key))
        .toContain(AMARA_GENDER)
    await cleanUp()

    const touchEnrollment = await mountRegister({ enrollments: assigned })
    control(cellKey(AMARA.enrollment, ENROLLED_AT)).focus()
    await userEvent.keyboard('2026-10-05{Enter}')
    await expect
        .poll(
            () => touchEnrollment.context().store.getState().cells[AMARA_GENDER]
        )
        .toMatchObject({ value: 'Male', source: 'rule' })
})

test('an enrolment rule never assigns on a read-only person', async () => {
    const { context } = await mountRegister({
        enrollments: assigned,
        program: {
            ...immunisation,
            trackedEntityType: {
                ...immunisation.trackedEntityType,
                access: { data: { write: false } },
            },
        },
    })
    control(cellKey(AMARA.enrollment, ENROLLED_AT)).focus()
    await userEvent.keyboard('2026-10-05{Enter}')
    await expect
        .poll(
            () =>
                context().store.getState().cells[
                    cellKey(AMARA.enrollment, ENROLLED_AT)
                ]?.value
        )
        .toBe('2026-10-05')
    await later(300)
    expect(context().store.getState().cells[AMARA_GENDER]?.value).toBe('Female')
})

test('a new person’s rules run at once, without asking DHIS2 for them: offline too', async () => {
    const asked: string[] = []
    const known = new Set(enrollments.enrollments.map((e) => e.enrollment))
    const { effects, view, tracker } = await mountRegister({}, LAYOUT, {
        ...RULES_DATA,
        // Offline for anyone the register did not load.
        'tracker/enrollments': async (type, query) => {
            const ids = String(query.params?.enrollments).split(',')
            asked.push(...ids)
            if (ids.some((id) => !known.has(id))) {
                throw new Error('Failed to fetch')
            }
            return RULES_DATA['tracker/enrollments'](type, query)
        },
    })
    view().addRow(PROGRAM)
    const newPerson = () =>
        [...tracker().records.values()].find(
            (record) => record.kind === 'trackedEntity' && record.isNew
        )?.id
    await expect.poll(newPerson).toBeDefined()
    const name = cellKey(newPerson() ?? '', FIRST_NAME)
    control(name).focus()
    await userEvent.keyboard('Mo{Enter}')
    await expect
        .poll(() => effects().cells[name]?.messages)
        .toEqual([
            { tone: 'warning', text: 'Is the name right?', source: 'rule' },
        ])
    expect(asked.every((id) => known.has(id))).toBe(true)
    expect(effects().rowMessages.get('') ?? []).toEqual([])
})

test('a rule that reads a stage the register leaves out sees its server value', async () => {
    const GROWTH = 'ImmGrowth01'
    const WEIGHT = 'ImmWeight01'
    const withGrowth = {
        enrollments: enrollments.enrollments.map((enrollment) =>
            enrollment.enrollment === AMARA.enrollment
                ? {
                      ...enrollment,
                      events: [
                          ...enrollment.events,
                          {
                              event: 'ImmEvt00077',
                              enrollment: enrollment.enrollment,
                              programStage: GROWTH,
                              orgUnit: enrollment.events[0]?.orgUnit,
                              occurredAt: '2026-10-01T00:00:00.000',
                              status: 'ACTIVE',
                              dataValues: [{ dataElement: WEIGHT, value: '7' }],
                          },
                      ],
                  }
                : enrollment
        ),
    }
    const data = {
        ...RULES_DATA,
        programRuleVariables: async () => ({
            programRuleVariables: [
                {
                    id: 'varWeight01',
                    name: 'weight',
                    programRuleVariableSourceType:
                        'DATAELEMENT_NEWEST_EVENT_PROGRAM',
                    useCodeForOptionSet: false,
                    dataElement: { id: WEIGHT, valueType: 'TEXT' },
                },
            ],
        }),
        programRules: async () => ({
            programRules: [
                programRule(
                    'ruleWeight1',
                    'Note the weight',
                    "#{weight} == '7'",
                    {
                        programRuleActionType: 'DISPLAYTEXT',
                        content: 'Weighed 7',
                    }
                ),
            ],
        }),
        'tracker/enrollments': async (_type, query) => {
            const ids = String(query.params?.enrollments).split(',')
            return {
                pager: { page: 1, pageSize: 100 },
                enrollments: withGrowth.enrollments.filter(({ enrollment }) =>
                    ids.includes(enrollment)
                ),
            }
        },
    } satisfies ComponentProps<typeof CustomDataProvider>['data']
    const { effects } = await mountRegister(
        { enrollments: withGrowth },
        LAYOUT,
        data
    )
    await expect
        .poll(() => effects().rowNotes.get(AMARA.enrollment))
        .toContain('Weighed 7')
})
