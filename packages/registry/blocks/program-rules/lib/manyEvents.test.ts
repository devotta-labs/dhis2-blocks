import * as engine from '@dhis2/rule-engine'
import {
    RuleEnrollmentResponseSchema,
    toRuleEnrollmentData,
} from '../hooks/enrollment'
import {
    currentEventVariable,
    eventInput,
    programMetadata,
    rule,
} from '../__tests__/metadata'
import {
    RMNCH,
    rmnchEnrollmentResponse,
    rmnchMetadata,
} from '../__tests__/rmnch'
import { buildRuleContext } from './buildContext'
import {
    crossEventFields,
    createEventsRuleEvaluator,
    evaluateEventsRules,
    rowsAffectedBy,
    type EventsRuleInput,
    type EventsRuleRow,
} from './manyEvents'
import { metadataForStage } from './stages'
import type { RuleContext } from './types'

const FIRST_VISIT = RMNCH.eventId
const LATER_VISIT = 'H693QbyyYhi'
const LATER_STAGE = 'edqlbukwRfQ'

const person = toRuleEnrollmentData(
    RuleEnrollmentResponseSchema.parse(rmnchEnrollmentResponse)
)
const persons = new Map([[RMNCH.enrollmentId, person]])

const contexts = new Map(
    [...new Set(rmnchEnrollmentResponse.events.map((e) => e.programStage))].map(
        (stageId): [string, RuleContext] => [
            stageId,
            buildRuleContext(
                engine,
                metadataForStage(rmnchMetadata(), stageId)
            ),
        ]
    )
)

/** A fixture event as a grid row of the fixture's person, with live values over the server's. */
const fixtureRow = (
    eventId: string,
    live: Record<string, string> = {}
): EventsRuleRow => {
    const event = person.events.find((e) => e.id === eventId)
    if (event === undefined) {
        throw new Error(`the RMNCH fixture lost event ${eventId}`)
    }
    return {
        event: { ...event, dataValues: { ...event.dataValues, ...live } },
        enrollmentId: RMNCH.enrollmentId,
    }
}

const row = (eventId: string, enrollmentId: string): EventsRuleRow => ({
    event: {
        id: eventId,
        programStageId: RMNCH.stageId,
        orgUnitId: 'ou',
        status: 'ACTIVE',
        dataValues: {},
    },
    enrollmentId,
})

const input = (
    rows: EventsRuleRow[],
    overrides: Partial<EventsRuleInput> = {}
): EventsRuleInput => ({
    rows,
    persons,
    tracker: true,
    personsLoaded: true,
    ...overrides,
})

const hiddenFollowUps = (
    rows: EventsRuleRow[],
    overrides: Partial<EventsRuleInput> = {}
) => {
    const effects = evaluateEventsRules(
        engine,
        contexts,
        input(rows, overrides),
        [LATER_VISIT]
    ).effects.get(LATER_VISIT)
    // An empty list must mean "none hidden", never "not evaluated".
    if (effects === undefined) {
        throw new Error('the later visit was not evaluated')
    }
    return RMNCH.chronicFollowUps.filter((id) => effects.hiddenFields.has(id))
}

/** The engine, failing on the later visit the way it fails on input it cannot read. */
class FailsOnLaterVisit extends engine.RuleEngineJs {
    override evaluateEvent(
        ...args: Parameters<engine.RuleEngineJs['evaluateEvent']>
    ) {
        if (args[0].event === LATER_VISIT) {
            throw new Error('the engine failed on the later visit')
        }
        return super.evaluateEvent(...args)
    }
}

const crossFields = crossEventFields(rmnchMetadata())

describe('crossEventFields', () => {
    it('lists the fields that feed other events', () => {
        expect(crossFields.has(RMNCH.chronic)).toBe(true)
        expect(crossFields.has(RMNCH.lmp)).toBe(true)
        // 18 data elements behind newest-event-in-program variables and 1 behind a newest-in-stage variable.
        expect(crossFields.size).toBe(19)
    })
})

describe('rowsAffectedBy', () => {
    it('re-runs the same person’s rows only for cross-event fields', () => {
        const rows = [
            row(FIRST_VISIT, 'P1'),
            row(LATER_VISIT, 'P1'),
            row('X', 'P2'),
        ]
        expect(
            rowsAffectedBy(rows, crossFields, FIRST_VISIT, RMNCH.chronic)
        ).toEqual([FIRST_VISIT, LATER_VISIT])
        expect(
            rowsAffectedBy(rows, crossFields, FIRST_VISIT, 'notACrossField')
        ).toEqual([FIRST_VISIT])
    })
})

// Values a person could enter in a field of each value type.
const VALUES = new Map([
    ['BOOLEAN', ['true', 'false']],
    ['TRUE_ONLY', ['true']],
    ['NUMBER', ['0', '1', '7.5', '42', '180']],
    ['INTEGER', ['0', '1', '12', '45', '300']],
    ['INTEGER_POSITIVE', ['1', '3', '28', '120']],
    ['INTEGER_ZERO_OR_POSITIVE', ['0', '2', '9', '40']],
    ['PERCENTAGE', ['0', '50', '100']],
    ['DATE', ['2020-01-01', '2023-06-15', '2024-02-29', '2025-12-31']],
    ['AGE', ['1990-05-05', '2010-10-10', '2024-01-01']],
])

describe('evaluateEventsRules', () => {
    // The rule hides the follow-ups unless chronic conditions is true, so an empty value also hides them: only a
    // 'true' that can come from another row proves that row was read.
    it('uses another row’s live value over the server’s', () => {
        expect(
            hiddenFollowUps([
                fixtureRow(FIRST_VISIT, { [RMNCH.chronic]: 'true' }),
                fixtureRow(LATER_VISIT),
            ])
        ).toEqual([])
    })

    it('hides the follow-ups when the other row says no', () => {
        expect(
            hiddenFollowUps([
                fixtureRow(FIRST_VISIT, { [RMNCH.chronic]: 'false' }),
                fixtureRow(LATER_VISIT),
            ])
        ).toEqual(RMNCH.chronicFollowUps)
    })

    it('includes unsaved rows of the same person as other events', () => {
        const withoutFirstVisit = {
            ...person,
            events: person.events.filter((e) => e.id !== FIRST_VISIT),
        }
        const unsaved = fixtureRow(FIRST_VISIT, { [RMNCH.chronic]: 'true' })
        expect(
            hiddenFollowUps(
                [
                    {
                        ...unsaved,
                        event: { ...unsaved.event, id: 'NewRow00001' },
                    },
                    fixtureRow(LATER_VISIT),
                ],
                { persons: new Map([[RMNCH.enrollmentId, withoutFirstVisit]]) }
            )
        ).toEqual([])
    })

    it('evaluates event-program rows alone', () => {
        // The server also says 'true', so only code that reads the person's events would show the follow-ups.
        const serverSaysTrue = {
            ...person,
            events: person.events.map((e) =>
                e.id === FIRST_VISIT
                    ? {
                          ...e,
                          dataValues: {
                              ...e.dataValues,
                              [RMNCH.chronic]: 'true',
                          },
                      }
                    : e
            ),
        }
        expect(
            hiddenFollowUps(
                [
                    fixtureRow(FIRST_VISIT, { [RMNCH.chronic]: 'true' }),
                    fixtureRow(LATER_VISIT),
                ],
                {
                    tracker: false,
                    persons: new Map([[RMNCH.enrollmentId, serverSaysTrue]]),
                }
            )
        ).toEqual(RMNCH.chronicFollowUps)
    })

    it('fails a row whose person the server did not return', () => {
        const { effects, failures } = evaluateEventsRules(
            engine,
            contexts,
            input([fixtureRow(FIRST_VISIT), fixtureRow(LATER_VISIT)], {
                persons: new Map(),
            }),
            [LATER_VISIT]
        )
        expect(effects.size).toBe(0)
        expect(failures.get(LATER_VISIT)?.message).toBe(
            'The enrollment of this event could not be read'
        )
    })

    it('evaluates a row without its person when no persons were fetched', () => {
        expect(
            hiddenFollowUps([fixtureRow(LATER_VISIT)], {
                persons: new Map(),
                personsLoaded: false,
            })
        ).toEqual(RMNCH.chronicFollowUps)
    })

    // An event rule that reads an attribute: the fetched person is female.
    const genderContexts = new Map([
        [
            'stage',
            buildRuleContext(
                engine,
                programMetadata({
                    variables: [
                        {
                            id: 'var_gender',
                            name: 'gender',
                            sourceType: 'TEI_ATTRIBUTE',
                            useCodeForOptionSet: false,
                            attributeId: 'gender',
                            fieldValueType: 'TEXT',
                        },
                    ],
                    rules: [
                        rule('r', "A{gender} == 'Male'", [
                            { id: 'a', type: 'HIDEFIELD', dataElementId: 'x' },
                        ]),
                    ],
                })
            ),
        ],
    ])
    const enrolled = (id: string, gender: string) => ({
        id,
        enrolledAt: '2026-10-01',
        orgUnitId: 'ou',
        attributes: { gender },
    })
    const genderRow = (enrollmentId: string): EventsRuleRow => ({
        event: { ...eventInput().event, id: `event-${enrollmentId}` },
        enrollmentId,
    })
    const hidesX = (row: EventsRuleRow) => {
        const { effects, failures } = evaluateEventsRules(
            engine,
            genderContexts,
            input([row], {
                persons: new Map([
                    [
                        'P1',
                        { enrollment: enrolled('P1', 'Female'), events: [] },
                    ],
                ]),
            }),
            [row.event.id]
        )
        expect(failures.size).toBe(0)
        return effects.get(row.event.id)?.hiddenFields.has('x')
    }

    it('a row’s own enrolment is used in place of the fetched one', () => {
        expect(hidesX(genderRow('P1'))).toBe(false)
        expect(
            hidesX({ ...genderRow('P1'), enrollment: enrolled('P1', 'Male') })
        ).toBe(true)
    })

    it('a new person’s row is evaluated with its own enrolment', () => {
        expect(
            hidesX({ ...genderRow('New'), enrollment: enrolled('New', 'Male') })
        ).toBe(true)
    })

    it('indexes a rows array once, however many calls read it', () => {
        const rows = [fixtureRow(FIRST_VISIT)]
        const evaluated = () =>
            evaluateEventsRules(engine, contexts, input(rows), [LATER_VISIT])
                .effects.size
        expect(evaluated()).toBe(0)
        // A row pushed into the same array is not in its index: callers pass a new array when the rows change.
        rows.push(fixtureRow(LATER_VISIT))
        expect(evaluated()).toBe(0)
        expect(
            evaluateEventsRules(engine, contexts, input([...rows]), [
                LATER_VISIT,
            ]).effects.size
        ).toBe(1)
    })

    it('returns no effects for a stage without rules', () => {
        const otherStages = new Map(
            [...contexts].filter(([stageId]) => stageId !== LATER_STAGE)
        )
        const { effects, failures } = evaluateEventsRules(
            engine,
            otherStages,
            input([fixtureRow(FIRST_VISIT), fixtureRow(LATER_VISIT)]),
            [FIRST_VISIT, LATER_VISIT]
        )
        expect([...effects.keys()]).toEqual([FIRST_VISIT])
        expect(failures.size).toBe(0)
    })

    it('keeps the other rows’ effects when the engine fails on one row', () => {
        const failing = new Map(
            [...contexts].map(([stageId, context]): [string, RuleContext] => [
                stageId,
                { ...context, engine: new FailsOnLaterVisit() },
            ])
        )
        const { effects, failures } = evaluateEventsRules(
            engine,
            failing,
            input([fixtureRow(FIRST_VISIT), fixtureRow(LATER_VISIT)]),
            [FIRST_VISIT, LATER_VISIT]
        )
        expect([...effects.keys()]).toEqual([FIRST_VISIT])
        expect([...failures.keys()]).toEqual([LATER_VISIT])
        expect(failures.get(LATER_VISIT)).toBeInstanceOf(Error)
        expect(failures.get(LATER_VISIT)?.message).toBe(
            'the engine failed on the later visit'
        )
    })

    it('returns no effects for a row id that is not in the rows', () => {
        const { effects, failures } = evaluateEventsRules(
            engine,
            contexts,
            input([fixtureRow(FIRST_VISIT)]),
            ['missing']
        )
        expect(effects.size).toBe(0)
        expect(failures.size).toBe(0)
    })

    it('re-evaluates changed-field readers and preserves unaffected effects', () => {
        const context = buildRuleContext(
            engine,
            programMetadata({
                variables: [
                    currentEventVariable('base', 'base'),
                    currentEventVariable('trigger', 'trigger'),
                    currentEventVariable('other', 'other'),
                    {
                        id: 'calculated',
                        name: 'calculated',
                        sourceType: 'CALCULATED_VALUE',
                        useCodeForOptionSet: false,
                        valueType: 'TEXT',
                    },
                ],
                rules: [
                    rule(
                        'fallback',
                        "#{other} == 'yes'",
                        [
                            {
                                id: 'fallback_assign',
                                type: 'ASSIGN',
                                dataElementId: 'assigned',
                                data: "'fallback'",
                            },
                        ],
                        { priority: 1 }
                    ),
                    rule(
                        'producer',
                        "#{base} == 'yes'",
                        [
                            {
                                id: 'producer_assign',
                                type: 'ASSIGN',
                                content: '#{calculated}',
                                data: "'ready'",
                            },
                        ],
                        { priority: 2 }
                    ),
                    rule(
                        'consumer',
                        "#{trigger} == 'on' && #{calculated} == 'ready'",
                        [
                            {
                                id: 'consumer_hide',
                                type: 'HIDEFIELD',
                                dataElementId: 'derived_effect',
                            },
                        ],
                        { priority: 3 }
                    ),
                    rule(
                        'changedAssignment',
                        "#{trigger} == 'on'",
                        [
                            {
                                id: 'changed_assign',
                                type: 'ASSIGN',
                                dataElementId: 'assigned',
                                data: "'changed'",
                            },
                        ],
                        { priority: 4 }
                    ),
                ],
            })
        )
        const event = {
            ...eventInput().event,
            id: 'incremental',
            dataValues: { base: 'yes', trigger: 'on', other: 'yes' },
        }
        const inputFor = (nextEvent: typeof event): EventsRuleInput => ({
            rows: [{ event: nextEvent }],
            persons: new Map(),
            tracker: false,
            personsLoaded: false,
        })
        const contexts = new Map([['stage', context]])
        const evaluator = createEventsRuleEvaluator(engine, contexts)
        const run = vi.spyOn(context.engine, 'evaluateEvent')

        evaluator(inputFor(event), [event.id])
        const changed = {
            ...event,
            dataValues: { ...event.dataValues, trigger: 'off' },
        }
        const incremental = evaluator(
            inputFor(changed),
            [event.id],
            ['trigger']
        )
        const full = evaluateEventsRules(engine, contexts, inputFor(changed), [
            event.id,
        ])

        expect(incremental).toEqual(full)
        expect(
            incremental.effects
                .get(event.id)
                ?.hiddenFields.has('derived_effect')
        ).toBe(false)
        expect(
            incremental.effects.get(event.id)?.assignedValues.get('assigned')
                ?.value
        ).toBe('fallback')
        expect(run.mock.calls).toHaveLength(3)
        expect(run.mock.calls.at(1)?.[3].rules).toHaveLength(3)
    })

    it('says what a full run says after each of a long run of changes to a real program', () => {
        const metadata = rmnchMetadata()
        const options = new Map(
            metadata.optionSets.map(({ id, options: all }) => [
                id,
                all.map(({ code }) => code),
            ])
        )
        // Every data element a rule variable reads, with values a person could enter there.
        const fields = [
            ...new Map(
                metadata.variables.flatMap((variable) =>
                    variable.dataElementId === undefined
                        ? []
                        : [[variable.dataElementId, variable] as const]
                )
            ),
        ].map(([id, variable]) => ({
            id,
            values: [
                undefined,
                ...((variable.optionSetId &&
                    options.get(variable.optionSetId)) ||
                    VALUES.get(variable.fieldValueType ?? '') || ['a', 'b']),
            ],
        }))
        // A small seeded generator: the same changes on every run.
        let seed = 20240607
        const below = (limit: number) => {
            seed = (seed * 1664525 + 1013904223) % 2 ** 32
            return Math.floor((seed / 2 ** 32) * limit)
        }
        const visits = [FIRST_VISIT, LATER_VISIT]
        const live = new Map(
            visits.map((id) => [id, fixtureRow(id).event.dataValues])
        )
        const rowsNow = () =>
            visits.map((id) => {
                const visit = fixtureRow(id)
                return {
                    ...visit,
                    event: { ...visit.event, dataValues: live.get(id) ?? {} },
                }
            })
        const evaluator = createEventsRuleEvaluator(engine, contexts)
        evaluator(input(rowsNow()), visits)
        const ran = vi.spyOn(engine.RuleEngineJs.prototype, 'evaluateEvent')
        let fewer = 0
        for (let step = 0; step < 100; step += 1) {
            // One field of one visit mostly, several at times, as a paste changes them.
            const visit = visits[below(visits.length)] ?? FIRST_VISIT
            const changed = Array.from(
                { length: 1 + below(3) },
                () => fields[below(fields.length)]
            ).flatMap((field) => field ?? [])
            const values = { ...live.get(visit) }
            for (const { id, values: all } of changed) {
                const value = all[below(all.length)]
                if (value === undefined) {
                    delete values[id]
                } else {
                    values[id] = value
                }
            }
            live.set(visit, values)
            const rows = rowsNow()
            // The piping's part: each row the change reaches, with the fields that reach it.
            const reached = new Map<string, string[]>()
            for (const { id } of changed) {
                for (const rowId of rowsAffectedBy(
                    rows,
                    crossFields,
                    visit,
                    id
                )) {
                    reached.set(rowId, [...(reached.get(rowId) ?? []), id])
                }
            }
            for (const [rowId, changedFields] of reached) {
                ran.mockClear()
                const incremental = evaluator(
                    input(rows),
                    [rowId],
                    changedFields
                )
                const all =
                    contexts.get(
                        rows.find((r) => r.event.id === rowId)?.event
                            .programStageId ?? ''
                    )?.rules.length ?? 0
                if ((ran.mock.calls[0]?.[3].rules.length ?? all) < all) {
                    fewer += 1
                }
                expect(incremental.failures.size).toBe(0)
                expect(incremental, `change ${step}, ${rowId}`).toEqual(
                    evaluateEventsRules(engine, contexts, input(rows), [rowId])
                )
            }
        }
        // A row no change reached still says what a full run says.
        expect(evaluator(input(rowsNow()), visits, [])).toEqual(
            evaluateEventsRules(engine, contexts, input(rowsNow()), visits)
        )
        ran.mockRestore()
        expect(fewer).toBeGreaterThan(80)
    })
})
