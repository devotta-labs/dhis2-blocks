import { CustomDataProvider } from '@dhis2/app-runtime'
import React, { act, type ComponentProps } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import { ObservationsProvider } from '../provider/ObservationsProvider'
import {
    createFakeServer,
    createWrapper,
    Probe,
    WEIGHT,
} from './observationsTestSupport'

const runtimeData = (
    server: ReturnType<typeof createFakeServer>
): ComponentProps<typeof CustomDataProvider>['data'] => {
    const data: ComponentProps<typeof CustomDataProvider>['data'] = {}
    for (const resource of [
        'programs',
        'tracker/enrollments',
        'tracker/events',
    ]) {
        data[resource] = async (_type, query) =>
            z.json().parse(
                (
                    await server.engine.query({
                        result: {
                            resource,
                            id: query.id,
                            params: {
                                trackedEntity: String(
                                    query.params?.trackedEntity
                                ),
                                program: String(query.params?.program),
                            },
                        },
                    })
                ).result
            )
    }
    return data
}

const observation = (id: string, seen?: string[]) => (
    <ObservationsProvider trackedEntity="te1" program="prog1">
        <Probe id={id} dataElement={WEIGHT} seen={seen} />
    </ObservationsProvider>
)

it('shares one real engine across providers and isolates other runtime engines', async () => {
    const first = createFakeServer()
    const second = createFakeServer({ weight: '99' })
    const Wrapper = createWrapper()
    await render(
        <Wrapper>
            <CustomDataProvider data={runtimeData(first)}>
                {observation('first')}
                {observation('same')}
            </CustomDataProvider>
            <CustomDataProvider data={runtimeData(second)}>
                {observation('second')}
            </CustomDataProvider>
        </Wrapper>
    )
    for (const id of ['first', 'same']) {
        await expect.element(page.getByTestId(id)).toHaveTextContent('ready 70')
    }
    await expect
        .element(page.getByTestId('second'))
        .toHaveTextContent('ready 99')
    for (const source of [first, second]) {
        expect(source.countOf('programs')).toBe(1)
        expect(source.countOf('tracker/enrollments')).toBe(1)
        expect(source.countOf('tracker/events')).toBe(1)
    }
})

it('does not display a delayed old engine response after the runtime engine changes', async () => {
    const first = createFakeServer({ deferEventsFor: 'te1' })
    const second = createFakeServer({ weight: '99' })
    const Wrapper = createWrapper()
    const seen: string[] = []
    const ui = (source: ReturnType<typeof createFakeServer>) => (
        <Wrapper>
            <CustomDataProvider data={runtimeData(source)}>
                {observation('weight', seen)}
            </CustomDataProvider>
        </Wrapper>
    )
    const screen = await render(ui(first))
    await expect.poll(() => first.countOf('tracker/events')).toBe(1)
    await expect
        .element(page.getByTestId('weight'))
        .toHaveTextContent('pending')
    await screen.rerender(ui(second))
    await expect
        .element(page.getByTestId('weight'))
        .toHaveTextContent('ready 99')
    await act(async () => {
        first.release()
    })
    expect(seen).not.toContain('ready 70')
    await expect
        .element(page.getByTestId('weight'))
        .toHaveTextContent('ready 99')
    expect(second.requests).toHaveLength(3)
})
