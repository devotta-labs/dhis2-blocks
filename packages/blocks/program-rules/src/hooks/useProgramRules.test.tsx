import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { z } from 'zod'
import {
    RMNCH,
    rmnchEnrollmentResponse,
    rmnchInput,
    rmnchResponses,
} from '../../test/rmnch'
import { programRulesQueryKeys } from './queryKeys'
import { useProgramRuleContext } from './useProgramRuleContext'
import {
    useProgramRules,
    type ProgramRulesInput,
    type UseProgramRulesOptions,
} from './useProgramRules'

interface RawRules {
    programRules: ReadonlyArray<{
        id: string
        name: string
        condition: string
        programRuleActions: ReadonlyArray<{
            id: string
            programRuleActionType: string
            dataElement?: { id: string }
        }>
    }>
}
type Responses = Omit<typeof rmnchResponses, 'rules'> & { rules: RawRules }

const serve = (
    responses: Responses,
    initiallyFailing: ReadonlyArray<string> = []
) => {
    const requests: string[] = []
    const failing = [...initiallyFailing]
    const resource =
        <T,>(name: string, body: () => T) =>
        async () => {
            requests.push(name)
            if (failing.includes(name)) {
                // An access error, so the hook's retry policy doesn't retry it.
                throw new FetchError({
                    type: 'access',
                    message: `${name} failed`,
                })
            }
            // Served as it would arrive over the wire: plain JSON, no `undefined` members.
            return z.json().parse(JSON.parse(JSON.stringify(body())))
        }
    const data = {
        programRules: resource('programRules', () => responses.rules),
        programRuleVariables: resource(
            'programRuleVariables',
            () => responses.variables
        ),
        constants: resource('constants', () => responses.constants),
        programs: resource('programs', () => responses.program),
        me: resource('me', () => responses.me),
        organisationUnitGroups: resource('organisationUnitGroups', () => ({
            organisationUnitGroups: [
                {
                    id: 'EYbopBOJWsW',
                    code: 'MCHP',
                    organisationUnits: [{ id: 'm7fBMpmVpSM' }],
                },
            ],
        })),
        'tracker/enrollments': resource(
            'tracker/enrollments',
            () => rmnchEnrollmentResponse
        ),
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { requests, wrapper, failing, queryClient }
}

const currentEvent = (values: Record<string, string | null> = {}) =>
    rmnchInput(values).event

const options = (
    input: ProgramRulesInput,
    overrides: Partial<UseProgramRulesOptions> = {}
): UseProgramRulesOptions => ({
    programId: RMNCH.programId,
    programStageId: RMNCH.stageId,
    enrollmentId: RMNCH.enrollmentId,
    input,
    ...overrides,
})

const settle = async (read: () => string) => {
    await expect.poll(read, { timeout: 10_000 }).not.toBe('loading')
}

describe('useProgramRules', () => {
    it('fetches what RMNCH needs and evaluates the event', async () => {
        const { requests, wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(
            () =>
                useProgramRules(
                    options({
                        event: currentEvent({ [RMNCH.chronic]: 'false' }),
                    })
                ),
            { wrapper }
        )
        expect(result.current.status).toBe('loading')
        await settle(() => result.current.status)
        expect(result.current.error?.message).toBeUndefined()
        expect(result.current.status).toBe('ready')
        expect(
            result.current.effects?.hiddenFields.has(RMNCH.chronicFollowUps[0])
        ).toBe(true)
        expect(
            result.current.explain(RMNCH.chronicFollowUps[0])[0]?.condition
        ).toBe('!#{chronicconditions}')
        expect(result.current.invalidRules).toHaveLength(3)
        expect(result.current.effects?.hiddenProgramStages).toEqual(
            new Set([RMNCH.postpartumStage])
        )
        expect(
            requests.filter((name) => name === 'tracker/enrollments')
        ).toHaveLength(1)
    })

    it('does not fetch the enrollment when the host passes it', async () => {
        const { requests, wrapper } = serve(rmnchResponses)
        const full = rmnchInput()
        const { result } = await renderHook(
            () => useProgramRules(options(full)),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        expect(requests).not.toContain('tracker/enrollments')
    })

    it('is ready with no effects for a program without rules', async () => {
        const { requests, wrapper } = serve({
            ...rmnchResponses,
            rules: { programRules: [] },
        })
        const { result } = await renderHook(
            () => useProgramRules(options({ event: currentEvent() })),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        expect(result.current.effects?.hiddenFields.size).toBe(0)
        expect(requests).not.toContain('tracker/enrollments')
    })

    it('evaluates without an enrollment when there is no enrollment id', async () => {
        const { requests, wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(
            () =>
                useProgramRules(
                    options(
                        { event: currentEvent({ [RMNCH.chronic]: 'false' }) },
                        { enrollmentId: undefined }
                    )
                ),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        expect(requests).not.toContain('tracker/enrollments')
    })

    it('keeps the effects when the input content is unchanged', async () => {
        const { wrapper } = serve(rmnchResponses)
        const { result, rerender } = await renderHook(
            (props?: { input: ProgramRulesInput }) =>
                useProgramRules(options(props?.input ?? rmnchInput())),
            { wrapper, initialProps: { input: rmnchInput() } }
        )
        await settle(() => result.current.status)
        const first = result.current.effects
        expect(first).toBeDefined()
        await rerender({ input: rmnchInput() })
        expect(result.current.effects).toBe(first)
        await rerender({ input: rmnchInput({ [RMNCH.chronic]: 'true' }) })
        expect(result.current.effects).not.toBe(first)
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
            () => useProgramRules(options({ event: currentEvent() })),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.effects?.hiddenFields.has(RMNCH.lmp)).toBe(true)
        expect(requests).toContain('organisationUnitGroups')
        expect(requests).not.toContain('tracker/enrollments')
    })

    it('reports a failed metadata request', async () => {
        const { wrapper } = serve(rmnchResponses, ['programRules'])
        const { result } = await renderHook(
            () => useProgramRules(options({ event: currentEvent() })),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('error')
        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.effects).toBeUndefined()
    })

    it('stays ready when a background refetch fails', async () => {
        const { requests, wrapper, failing, queryClient } =
            serve(rmnchResponses)
        const { result } = await renderHook(
            () => useProgramRules(options({ event: currentEvent() })),
            { wrapper }
        )
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
        expect(result.current.effects).toBeDefined()
    })

    it('recovers when a failed enrollment request is no longer needed', async () => {
        const { wrapper } = serve(rmnchResponses, ['tracker/enrollments'])
        const { result, rerender } = await renderHook(
            (props?: { input: ProgramRulesInput }) =>
                useProgramRules(
                    options(props?.input ?? { event: currentEvent() })
                ),
            { wrapper, initialProps: { input: { event: currentEvent() } } }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('error')
        await rerender({ input: rmnchInput() })
        await expect.poll(() => result.current.status).toBe('ready')
    })

    it('keeps the engine module out of the query cache', async () => {
        const { wrapper, queryClient } = serve(rmnchResponses)
        const { result } = await renderHook(
            () => useProgramRules(options(rmnchInput())),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('ready')
        // A persisted cache would restore the module as {} and never reload it.
        expect(
            queryClient
                .getQueryCache()
                .getAll()
                .map((query) => JSON.stringify(query.queryKey))
                .filter((key) => key.includes('engine'))
        ).toEqual([])
    })

    it('does nothing while disabled', async () => {
        const { requests, wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(
            () =>
                useProgramRules(
                    options({ event: currentEvent() }, { enabled: false })
                ),
            { wrapper }
        )
        await new Promise((resolve) => setTimeout(resolve, 200))
        expect(result.current.status).toBe('loading')
        expect(requests).toEqual([])
    })
})

describe('useProgramRuleContext', () => {
    it('builds the stage graph without an event or an enrollment', async () => {
        const { requests, wrapper } = serve(rmnchResponses)
        const { result } = await renderHook(
            () =>
                useProgramRuleContext({
                    programId: RMNCH.programId,
                    programStageId: RMNCH.stageId,
                }),
            { wrapper }
        )
        expect(result.current.status).toBe('loading')
        await settle(() => result.current.status)
        expect(result.current.error?.message).toBeUndefined()
        const { context, metadata } = result.current
        expect(context?.invalidRules).toHaveLength(3)
        expect(context?.requirements.enrollment).toBe(true)
        expect(context?.graph.fieldWriters.get(RMNCH.gestationalAge)).toEqual([
            'KRMEVVbex0q',
        ])
        expect(context?.graph.fieldReaders.get(RMNCH.chronic)).toHaveLength(1)
        expect(
            metadata?.rules.every(
                (rule) =>
                    rule.programStageId === undefined ||
                    rule.programStageId === RMNCH.stageId
            )
        ).toBe(true)
        expect(requests).not.toContain('tracker/enrollments')
    })

    it('reports a failed metadata request', async () => {
        const { wrapper } = serve(rmnchResponses, ['programRuleVariables'])
        const { result } = await renderHook(
            () =>
                useProgramRuleContext({
                    programId: RMNCH.programId,
                    programStageId: RMNCH.stageId,
                }),
            { wrapper }
        )
        await settle(() => result.current.status)
        expect(result.current.status).toBe('error')
        expect(result.current.context).toBeUndefined()
    })
})
