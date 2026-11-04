import { renderHook } from 'vitest-browser-react'
import { RMNCH, rmnchResponses } from '../__tests__/rmnch'
import { serve } from '../__tests__/serve'
import { useEventsRules } from './useEventsRules'

it('does not load custom history or expanded metadata for a rule-free program', async () => {
    const { requests, wrapper } = serve(
        { ...rmnchResponses, rules: { programRules: [] } },
        ['tracker/enrollments']
    )
    const { result } = await renderHook(
        () =>
            useEventsRules({
                programId: RMNCH.programId,
                programStageIds: [RMNCH.stageId],
                tracker: true,
                enrollmentIds: [RMNCH.enrollmentId],
                customFunctions: {},
            }),
        { wrapper }
    )
    await expect.poll(() => result.current.status).not.toBe('loading')
    expect(result.current.status).toBe('ready')
    expect(result.current.error).toBeUndefined()
    expect(result.current.rules?.invalidRules).toEqual([])
    expect(requests).not.toContain('tracker/enrollments')
    expect(requests.filter((name) => name === 'programs')).toHaveLength(1)
})
