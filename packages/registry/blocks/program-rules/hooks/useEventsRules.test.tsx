import { renderHook } from 'vitest-browser-react'
import {
    RMNCH,
    rmnchEnrollmentResponse,
    rmnchResponses,
} from '../__tests__/rmnch'
import { SECOND_PERSON, serve } from '../__tests__/serve'
import type { EventsRuleRow, RuleEffects } from '../lib'
import {
    RuleEnrollmentResponseSchema,
    toRuleEnrollmentData,
} from './enrollment'
import { programRulesQueryKeys } from './queryKeys'
import {
    useEventsRules,
    type EventsRules,
    type UseEventsRulesOptions,
} from './useEventsRules'

const FIRST_VISIT = RMNCH.eventId
const LATER_VISIT = 'H693QbyyYhi'
const LATER_STAGE = 'edqlbukwRfQ'

const person = toRuleEnrollmentData(
    RuleEnrollmentResponseSchema.parse(rmnchEnrollmentResponse)
)
const stageIds = [...new Set(person.events.map((e) => e.programStageId))]

/** A fixture event as a row of the fixture's person, with live values over the server's. */
const row = (
    eventId: string,
    live: Record<string, string> = {},
    enrollmentId: string = RMNCH.enrollmentId
): EventsRuleRow => {
    const event = person.events.find((e) => e.id === eventId)
    if (event === undefined) {
        throw new Error(`the RMNCH fixture lost event ${eventId}`)
    }
    return {
        event: { ...event, dataValues: { ...event.dataValues, ...live } },
        enrollmentId,
    }
}

const options = (
    overrides: Partial<UseEventsRulesOptions> = {}
): UseEventsRulesOptions => ({
    programId: RMNCH.programId,
    programStageIds: stageIds,
    tracker: true,
    enrollmentIds: [RMNCH.enrollmentId],
    ...overrides,
})

/** Enrollment ids a1, a2, … from `first` to `last`, none of them known to the server. */
const people = (first: number, last: number) =>
    Array.from({ length: last - first + 1 }, (_, i) => `a${first + i}`)

const settle = async (read: () => string) => {
    await expect.poll(read, { timeout: 10_000 }).not.toBe('loading')
}

const hiddenFollowUps = (effects: Map<string, RuleEffects>, rowId: string) => {
    const forRow = effects.get(rowId)
    // An empty list must mean "none hidden", never "not evaluated".
    if (forRow === undefined) {
        throw new Error(`row ${rowId} was not evaluated`)
    }
    return RMNCH.chronicFollowUps.filter((id) => forRow.hiddenFields.has(id))
}

describe('useEventsRules', () => {
    it('becomes ready and evaluates rows across stages', async () => {
        const { wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        expect(result.current.status).toBe('loading')
        expect(result.current.rules).toBeUndefined()
        await settle(() => result.current.status)
        expect(result.current.error?.message).toBeUndefined()
        expect(result.current.status).toBe('ready')
        const rules = result.current.rules
        if (rules === undefined) {
            throw new Error('the rules did not load')
        }
        const saysNo = [
            row(FIRST_VISIT, { [RMNCH.chronic]: 'false' }),
            row(LATER_VISIT),
        ]
        expect(
            hiddenFollowUps(
                rules.evaluate(saysNo, [LATER_VISIT]).effects,
                LATER_VISIT
            )
        ).toEqual(RMNCH.chronicFollowUps)
        // Each row's rules come from its own stage's context.
        const both = rules.evaluate(saysNo, [FIRST_VISIT, LATER_VISIT]).effects
        expect([...both.keys()]).toEqual([FIRST_VISIT, LATER_VISIT])
        // A 'true' on the first visit can only reach the later visit through the person's other rows.
        const saysYes = [
            row(FIRST_VISIT, { [RMNCH.chronic]: 'true' }),
            row(LATER_VISIT),
        ]
        expect(
            hiddenFollowUps(
                rules.evaluate(saysYes, [LATER_VISIT]).effects,
                LATER_VISIT
            )
        ).toEqual([])
    })

    it('requests every person once, in one batch', async () => {
        const { requests, wrapper, queryClient } = serve(rmnchResponses)
        const { result } = await renderHook(
            () =>
                useEventsRules(
                    options({
                        // The same person twice, and one the server does not know.
                        enrollmentIds: [
                            RMNCH.enrollmentId,
                            'unknownPe01',
                            RMNCH.enrollmentId,
                        ],
                    })
                ),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        expect(
            requests.filter((name) => name === 'tracker/enrollments')
        ).toHaveLength(1)
        expect(requests.filter((name) => name === 'programRules')).toHaveLength(
            1
        )
        // Cached under the distinct ids.
        expect(
            queryClient.getQueryData(
                programRulesQueryKeys.enrollments(
                    [RMNCH.enrollmentId, 'unknownPe01'],
                    true
                )
            )
        ).toBeDefined()
    })

    it('caches the persons as plain data', async () => {
        const { wrapper, queryClient } = serve(rmnchResponses)
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        await settle(() => result.current.status)
        // A persisted cache restores a Map as {}, so the persons are cached as entries.
        const cached = queryClient.getQueryData(
            programRulesQueryKeys.enrollments([RMNCH.enrollmentId], true)
        )
        expect(Array.isArray(cached)).toBe(true)
    })

    it('loads no persons for an event program', async () => {
        const { requests, wrapper } = serve(rmnchResponses)
        // The rows carry enrollment ids, and the rules read them: only `tracker` keeps the request away.
        const { result } = await renderHook(
            () => useEventsRules(options({ tracker: false })),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        expect(requests).not.toContain('tracker/enrollments')
    })

    it('loads no persons for a tracker program without people, and never evaluates a row of a person not named', async () => {
        const { requests, wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(
            () => useEventsRules(options({ enrollmentIds: [] })),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        expect(requests).not.toContain('tracker/enrollments')
        expect(
            result.current.rules?.evaluate([row(FIRST_VISIT)], [FIRST_VISIT])
        ).toEqual({ effects: new Map(), failures: new Map() })
    })

    it('evaluates event-program rows alone', async () => {
        const { wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(
            () =>
                useEventsRules(options({ tracker: false, enrollmentIds: [] })),
            { wrapper }
        )
        await settle(() => result.current.status)
        const rules = result.current.rules
        if (rules === undefined) {
            throw new Error('the rules did not load')
        }
        // The first visit says 'true', but a row of an event program never reads another row.
        const rows = [
            row(FIRST_VISIT, { [RMNCH.chronic]: 'true' }),
            row(LATER_VISIT),
        ]
        expect(
            hiddenFollowUps(
                rules.evaluate(rows, [LATER_VISIT]).effects,
                LATER_VISIT
            )
        ).toEqual(RMNCH.chronicFollowUps)
        expect(rules.rowsAffectedBy(rows, FIRST_VISIT, RMNCH.chronic)).toEqual([
            FIRST_VISIT,
        ])
    })

    it('re-runs the same person’s rows when a field they read changes', async () => {
        const { wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        await settle(() => result.current.status)
        const rules = result.current.rules
        if (rules === undefined) {
            throw new Error('the rules did not load')
        }
        const rows = [
            row(FIRST_VISIT),
            row(LATER_VISIT),
            row('yDPqyTvcRpA', {}, 'otherPerson'),
        ]
        expect(rules.rowsAffectedBy(rows, FIRST_VISIT, RMNCH.chronic)).toEqual([
            FIRST_VISIT,
            LATER_VISIT,
        ])
        expect(
            rules.rowsAffectedBy(rows, FIRST_VISIT, 'notACrossField')
        ).toEqual([FIRST_VISIT])
    })

    it('lists rules the engine cannot parse once each', async () => {
        const { wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        await settle(() => result.current.status)
        // Program-wide rules sit in every stage's context, so each is listed once, not once per stage.
        expect(stageIds.length).toBeGreaterThan(1)
        const invalid = result.current.rules?.invalidRules ?? []
        expect(invalid).toHaveLength(3)
        expect(
            new Set(invalid.map((rule) => `${rule.ruleId}:${rule.actionId}`))
                .size
        ).toBe(3)
    })

    it('keeps the rules while its inputs have the same content', async () => {
        const { wrapper } = serve(rmnchResponses)
        const { result, rerender } = await renderHook(
            (props?: { options: UseEventsRulesOptions }) =>
                useEventsRules(props?.options ?? options()),
            { wrapper, initialProps: { options: options() } }
        )
        await settle(() => result.current.status)
        const first = result.current.rules
        expect(first).toBeDefined()
        await rerender({
            options: options({
                programStageIds: [...stageIds].reverse(),
                enrollmentIds: [RMNCH.enrollmentId],
            }),
        })
        expect(result.current.rules).toBe(first)
        await rerender({ options: options({ tracker: false }) })
        expect(result.current.rules).not.toBe(first)
    })

    it('fetches the org unit groups the rules name', async () => {
        const { requests, wrapper } = serve({
            ...rmnchResponses,
            rules: {
                programRules: [
                    {
                        id: 'inGroup',
                        name: 'In MCHP',
                        condition: "d2:inOrgUnitGroup('MCHP')",
                        programRuleActions: [
                            {
                                id: 'hide',
                                programRuleActionType: 'HIDEFIELD',
                                dataElement: { id: RMNCH.lmp },
                            },
                        ],
                    },
                ],
            },
        })
        const { result } = await renderHook(
            () => useEventsRules(options({ enrollmentIds: [] })),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(requests).toContain('organisationUnitGroups')
        expect(requests).not.toContain('tracker/enrollments')
        const effects = result.current.rules?.evaluate(
            [row(FIRST_VISIT)],
            [FIRST_VISIT]
        ).effects
        expect(effects?.get(FIRST_VISIT)?.hiddenFields.has(RMNCH.lmp)).toBe(
            true
        )
    })

    it('maps the option groups of every stage to their option codes', async () => {
        const hideGroup = (stageId: string, groupId: string, code: string) => ({
            id: `hide${groupId}`,
            name: `Hide ${groupId}`,
            condition: 'true',
            programStage: { id: stageId },
            programRuleActions: [
                {
                    id: `action${groupId}`,
                    programRuleActionType: 'HIDEOPTIONGROUP',
                    dataElement: { id: RMNCH.chronic },
                    optionGroup: { id: groupId, options: [{ code }] },
                },
            ],
        })
        const { wrapper } = serve({
            ...rmnchResponses,
            rules: {
                programRules: [
                    hideGroup(RMNCH.stageId, 'firstGroup', 'A'),
                    hideGroup(LATER_STAGE, 'laterGroup', 'B'),
                ],
            },
        })
        const { result } = await renderHook(
            () => useEventsRules(options({ enrollmentIds: [] })),
            { wrapper }
        )
        await settle(() => result.current.status)
        // Each stage's context holds only its own rule's group.
        expect(result.current.rules?.optionGroupOptions).toEqual(
            new Map([
                ['firstGroup', new Set(['A'])],
                ['laterGroup', new Set(['B'])],
            ])
        )
    })

    it('reports a failed person request', async () => {
        const { wrapper } = serve(rmnchResponses, ['tracker/enrollments'])
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        await settle(() => result.current.status)
        expect(result.current.status).toBe('error')
        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.rules).toBeUndefined()
    })

    it('reports a failed metadata request', async () => {
        const { wrapper } = serve(rmnchResponses, ['programRules'])
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        await settle(() => result.current.status)
        expect(result.current.status).toBe('error')
        expect(result.current.rules).toBeUndefined()
    })

    it('stays ready when a background refetch fails', async () => {
        const { requests, wrapper, failing, queryClient } =
            serve(rmnchResponses)
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        await settle(() => result.current.status)
        failing.push('tracker/enrollments', 'programRules')
        const before = requests.length
        await queryClient.invalidateQueries({
            queryKey: programRulesQueryKeys.all,
        })
        await expect.poll(() => requests.length).toBeGreaterThan(before)
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(result.current.status).toBe('ready')
        expect(result.current.error).toBeUndefined()
        expect(result.current.rules).toBeDefined()
    })

    it('reloads the persons when the enrollments prefix is invalidated, and keeps rules whose data is equal', async () => {
        const { requests, wrapper, queryClient } = serve(rmnchResponses)
        const { result } = await renderHook(() => useEventsRules(options()), {
            wrapper,
        })
        await settle(() => result.current.status)
        const loaded = result.current.rules
        const before = requests.filter(
            (name) => name === 'tracker/enrollments'
        ).length
        await queryClient.invalidateQueries({
            queryKey: [...programRulesQueryKeys.all, 'enrollments'],
        })
        await expect
            .poll(
                () =>
                    requests.filter((name) => name === 'tracker/enrollments')
                        .length
            )
            .toBe(before + 1)
        expect(requests.filter((name) => name === 'programRules')).toHaveLength(
            1
        )
        // Let the hook render the reloaded data before reading it.
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(loaded).toBeDefined()
        expect(result.current.rules).toBe(loaded)
    })

    it('keeps the rules while a new person loads, and leaves out that person’s rows', async () => {
        const { requests, wrapper, hold } = serve(rmnchResponses)
        const seen: Array<EventsRules | undefined> = []
        const { result, rerender } = await renderHook(
            (props?: { options: UseEventsRulesOptions }) => {
                const hook = useEventsRules(props?.options ?? options())
                seen.push(hook.rules)
                return hook
            },
            { wrapper, initialProps: { options: options() } }
        )
        await settle(() => result.current.status)
        const rows = [row(FIRST_VISIT), row('yDPqyTvcRpA', {}, SECOND_PERSON)]
        const ids = [FIRST_VISIT, 'yDPqyTvcRpA']
        const release = hold('tracker/enrollments')
        seen.length = 0
        await rerender({
            options: options({
                enrollmentIds: [RMNCH.enrollmentId, SECOND_PERSON],
            }),
        })
        await expect
            .poll(
                () =>
                    requests.filter((name) => name === 'tracker/enrollments')
                        .length
            )
            .toBe(2)
        // The first person's rows run on the data already loaded; the new person's wait for their own.
        const waiting = result.current.rules
        expect(result.current.status).toBe('ready')
        expect([
            ...(waiting?.evaluate(rows, ids).effects.keys() ?? []),
        ]).toEqual([FIRST_VISIT])
        release()
        await expect.poll(() => result.current.rules !== waiting).toBe(true)
        expect([
            ...(result.current.rules?.evaluate(rows, ids).effects.keys() ?? []),
        ]).toEqual(ids)
        expect(seen.every((rules) => rules !== undefined)).toBe(true)
        expect(result.current.status).toBe('ready')
    })

    it('requests only the chunk of 100 people that gained ids', async () => {
        const { queries, wrapper } = serve(rmnchResponses)
        const asked = () =>
            queries
                .filter(({ name }) => name === 'tracker/enrollments')
                .map(({ query }) =>
                    String(query.params?.enrollments).split(',')
                )
        const { result, rerender } = await renderHook(
            (props?: { options: UseEventsRulesOptions }) =>
                useEventsRules(props?.options ?? options()),
            {
                wrapper,
                initialProps: {
                    options: options({ enrollmentIds: people(1, 150) }),
                },
            }
        )
        await settle(() => result.current.status)
        expect(asked()).toEqual([people(1, 100), people(101, 150)])
        await rerender({
            options: options({ enrollmentIds: people(1, 200) }),
        })
        await expect.poll(() => asked().length).toBeGreaterThan(2)
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(asked().slice(2)).toEqual([people(101, 200)])
    })

    it('keeps the rules while a new chunk loads, and changes them once when it arrives', async () => {
        const { requests, wrapper, hold } = serve(rmnchResponses)
        const fullChunk = [RMNCH.enrollmentId, ...people(1, 99)]
        const seen = new Set<EventsRules | undefined>()
        const { result, rerender } = await renderHook(
            (props?: { options: UseEventsRulesOptions }) => {
                const hook = useEventsRules(props?.options ?? options())
                seen.add(hook.rules)
                return hook
            },
            {
                wrapper,
                initialProps: {
                    options: options({ enrollmentIds: fullChunk }),
                },
            }
        )
        await settle(() => result.current.status)
        const loaded = result.current.rules
        if (loaded === undefined) {
            throw new Error('the rules did not load')
        }
        const release = hold('tracker/enrollments')
        seen.clear()
        await rerender({
            options: options({
                enrollmentIds: [...fullChunk, SECOND_PERSON],
            }),
        })
        await expect
            .poll(
                () =>
                    requests.filter((name) => name === 'tracker/enrollments')
                        .length
            )
            .toBeGreaterThan(1)
        expect(result.current.rules).toBe(loaded)
        // The new person's row waits for their chunk: it is left out, not failed.
        const rows = [row(FIRST_VISIT), row('yDPqyTvcRpA', {}, SECOND_PERSON)]
        const ids = [FIRST_VISIT, 'yDPqyTvcRpA']
        const waiting = loaded.evaluate(rows, ids)
        expect([...waiting.effects.keys()]).toEqual([FIRST_VISIT])
        expect(waiting.failures.size).toBe(0)
        release()
        await expect.poll(() => result.current.rules !== loaded).toBe(true)
        expect([
            ...(result.current.rules?.evaluate(rows, ids).effects.keys() ?? []),
        ]).toEqual(ids)
        expect(seen).toEqual(new Set([loaded, result.current.rules]))
    })

    it('fails the rows of a person the server did not return', async () => {
        const { wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(
            () =>
                useEventsRules(
                    options({
                        enrollmentIds: [RMNCH.enrollmentId, 'unknownPe01'],
                    })
                ),
            { wrapper }
        )
        await settle(() => result.current.status)
        const { effects, failures } = result.current.rules?.evaluate(
            [row(FIRST_VISIT), row('yDPqyTvcRpA', {}, 'unknownPe01')],
            [FIRST_VISIT, 'yDPqyTvcRpA']
        ) ?? { effects: new Map(), failures: new Map() }
        expect([...effects.keys()]).toEqual([FIRST_VISIT])
        expect(failures.get('yDPqyTvcRpA')?.message).toBe(
            'The enrollment of this event could not be read'
        )
    })

    it('reports a failed batch for a new person', async () => {
        const { wrapper, failing } = serve(rmnchResponses)
        const { result, rerender } = await renderHook(
            (props?: { options: UseEventsRulesOptions }) =>
                useEventsRules(props?.options ?? options()),
            { wrapper, initialProps: { options: options() } }
        )
        await settle(() => result.current.status)
        failing.push('tracker/enrollments')
        await rerender({
            options: options({
                enrollmentIds: [RMNCH.enrollmentId, SECOND_PERSON],
            }),
        })
        await expect.poll(() => result.current.status).toBe('error')
        expect(result.current.error).toBeInstanceOf(Error)
    })

    it('does nothing while disabled', async () => {
        const { requests, wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(
            () => useEventsRules(options({ enabled: false })),
            { wrapper }
        )
        await new Promise((resolve) => setTimeout(resolve, 200))
        expect(result.current.status).toBe('loading')
        expect(requests).toEqual([])
    })
})
