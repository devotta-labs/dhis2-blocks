import * as engine from '@dhis2/rule-engine'
import {
    RuleEnrollmentResponseSchema,
    toRuleEnrollmentData,
} from '../hooks/enrollment'
import {
    RMNCH,
    rmnchEnrollmentResponse,
    rmnchMetadata,
} from '../__tests__/rmnch'
import { buildRuleContext } from './buildContext'
import {
    crossEventFields,
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
})
