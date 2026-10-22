import React from 'react'
import { render } from 'vitest-browser-react'
import {
    TimelineProvider,
    useTimelineActions,
    useTimelineMeta,
    useTimelineState,
} from './TimelineContext'
import { TimelineItem } from './TimelineParts'
import { actionsOf, entry, META, stateOf } from './__fixtures__/timelineFixtures'

const Probe = ({ hook }: { hook: () => void }) => {
    hook()
    return null
}

describe('timeline hooks', () => {
    it('throws a clear error when a hook is used outside a provider', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const message = 'Timeline hooks must be used within Timeline or TimelineProvider.'
        for (const hook of [
            () => useTimelineState((state) => state.status),
            () => useTimelineMeta((meta) => meta.today),
            () => useTimelineActions(),
        ]) {
            await expect(render(<Probe hook={hook} />)).rejects.toThrow(message)
        }
        error.mockRestore()
    })

    it('re-renders a useTimelineState consumer only when its selected value changes', async () => {
        const renders = { status: 0, count: 0 }
        const Status = React.memo(() => {
            const status = useTimelineState((state) => state.status)
            renders.status += 1
            return <p>{status}</p>
        })
        const Count = React.memo(() => {
            const count = useTimelineState((state) => state.entries.length)
            renders.count += 1
            return <p data-testid="count">{count}</p>
        })
        const Tree = ({ ids }: { ids: string[] }) => (
            <TimelineProvider
                state={stateOf({
                    entries: ids.map((id) => entry(id, '2026-10-20T09:00')),
                })}
                actions={actionsOf()}
                meta={META}
            >
                <Status />
                <Count />
            </TimelineProvider>
        )
        const { rerender, container } = await render(<Tree ids={['a']} />)
        const before = { ...renders }

        await rerender(<Tree ids={['a', 'b']} />)

        expect(container.querySelector('[data-testid=count]')?.textContent).toBe('2')
        expect(renders.status).toBe(before.status)
        expect(renders.count).toBeGreaterThan(before.count)
    })

    it('hands consumers one stable actions object that calls the latest host actions', async () => {
        const identities = new Set<unknown>()
        const calls: string[] = []
        const Actions = () => {
            const actions = useTimelineActions()
            identities.add(actions)
            return (
                <button type="button" onClick={() => actions.loadMore()}>
                    go
                </button>
            )
        }
        const Tree = ({ tag }: { tag: string }) => (
            <TimelineProvider
                state={stateOf()}
                actions={actionsOf({ loadMore: () => calls.push(tag) })}
                meta={META}
            >
                <Actions />
            </TimelineProvider>
        )
        const { rerender, container } = await render(<Tree tag="first" />)
        await rerender(<Tree tag="second" />)
        container.querySelector('button')?.click()

        expect(calls).toEqual(['second'])
        expect(identities.size).toBe(1)
    })

    it('shows every consumer the current state in the same render as the new props', async () => {
        const seen: string[] = []
        const Probe = ({ props }: { props: number }) => {
            const fromState = useTimelineState((state) => state.entries.length)
            seen.push(`${props}:${fromState}`)
            return null
        }
        const Tree = ({ ids }: { ids: string[] }) => (
            <TimelineProvider
                state={stateOf({
                    entries: ids.map((id) => entry(id, '2026-10-20T09:00')),
                })}
                actions={actionsOf()}
                meta={META}
            >
                <Probe props={ids.length} />
            </TimelineProvider>
        )
        const { rerender } = await render(<Tree ids={['a']} />)
        await rerender(<Tree ids={['a', 'b']} />)

        expect(seen.length).toBeGreaterThan(1)
        for (const pair of seen) {
            const [props, fromState] = pair.split(':')
            expect(fromState).toBe(props)
        }
    })

    it('gives a TimelineItem for a newly arrived entry its index on the first render', async () => {
        /** The item's index attribute when each entry first appeared. */
        const atMount = new Map<string, string | null>()
        const Mounted = ({ id }: { id: string }) => {
            const ref = React.useRef<HTMLSpanElement>(null)
            React.useLayoutEffect(() => {
                atMount.set(
                    id,
                    ref.current
                        ?.closest('li')
                        ?.getAttribute('data-timeline-entry-index') ?? null
                )
            }, [id])
            return <span ref={ref} />
        }
        const withItems = (ids: string[]) => {
            const entries = ids.map((id) => entry(id, '2026-10-20T09:00'))
            return (
                <TimelineProvider
                    state={stateOf({ entries })}
                    actions={actionsOf()}
                    meta={META}
                >
                    <ul>
                        {entries.map((item) => (
                            <TimelineItem key={item.id} entry={item}>
                                <Mounted id={item.id} />
                            </TimelineItem>
                        ))}
                    </ul>
                </TimelineProvider>
            )
        }
        const { rerender } = await render(withItems(['a']))
        await rerender(withItems(['a', 'b']))

        expect(Object.fromEntries(atMount)).toEqual({ a: '0', b: '1' })
    })
})
