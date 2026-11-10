import { renderHook } from 'vitest-browser-react'
import { RMNCH, rmnchResponses } from '../__tests__/rmnch'
import { serve } from '../__tests__/serve'
import type { EventsRuleRow } from '../lib'
import { rulesWorker } from './backgroundRules'
import { useEventsRules } from './useEventsRules'

afterEach(() => vi.restoreAllMocks())

const rows: EventsRuleRow[] = [
    {
        event: {
            id: 'e1',
            programStageId: RMNCH.stageId,
            orgUnitId: 'ou',
            status: 'ACTIVE',
            dataValues: {},
        },
    },
]

/** A worker that builds the rules, then throws on the first rows it is asked for. */
const failingWorker = () =>
    new Worker(
        URL.createObjectURL(
            new Blob(
                [
                    `self.onmessage = ({ data }) => {
                        if (data.type === 'evaluate') {
                            throw new Error('out of memory')
                        }
                        if (data.type === 'setup') {
                            self.postMessage({ setup: data.setup, ready: true })
                        }
                    }`,
                ],
                { type: 'text/javascript' }
            )
        )
    )

test('a worker that fails hands its rows back to the main thread, and is not started again', async () => {
    const worker = failingWorker()
    const terminate = vi.spyOn(worker, 'terminate')
    const start = vi.spyOn(rulesWorker, 'start').mockReturnValue(worker)
    const { wrapper } = serve(rmnchResponses)
    const render = () =>
        renderHook(
            () =>
                useEventsRules({
                    programId: RMNCH.programId,
                    programStageIds: [RMNCH.stageId],
                    tracker: false,
                    enrollmentIds: [],
                }),
            { wrapper }
        )
    const { result } = await render()
    await expect
        .poll(() => result.current.rules?.evaluateInBackground?.(rows, [], 0), {
            timeout: 10_000,
        })
        .toBeDefined()
    const rules = result.current.rules
    // The worker's failure answers what it was asked: undefined, so the rows run here.
    await expect(
        rules?.evaluateInBackground?.(rows, ['e1'], 100)
    ).resolves.toBeUndefined()
    expect(terminate).toHaveBeenCalledTimes(1)
    expect(rules?.evaluateInBackground?.(rows, ['e1'], 100)).toBeUndefined()
    expect(rules?.evaluate(rows, ['e1']).effects.has('e1')).toBe(true)

    // Another grid's rules stay on the main thread too.
    const again = await render()
    await expect.poll(() => again.result.current.rules).toBeDefined()
    expect(
        again.result.current.rules?.evaluateInBackground?.(rows, ['e1'], 100)
    ).toBeUndefined()
    expect(start).toHaveBeenCalledTimes(1)
})
