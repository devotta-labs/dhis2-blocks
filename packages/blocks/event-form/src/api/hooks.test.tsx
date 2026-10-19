import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { z } from 'zod'
import eventFixture from './__fixtures__/event.json'
import stageFixture from './__fixtures__/rmnch-stage.json'
import { useStageMetadata, useSystemCalendar, useTrackerEvent } from './hooks'

const stageResponse = z.json().parse(stageFixture)
const eventResponse = z.json().parse(eventFixture)

interface EventProps {
    id: string | undefined
}

const serve = () => {
    const requests: string[] = []
    const data = {
        programs: async () => {
            requests.push('programs')
            return stageResponse
        },
        'tracker/events': async () => {
            requests.push('tracker/events')
            return eventResponse
        },
        'system/info': async () => {
            requests.push('system/info')
            return z
                .json()
                .parse({ calendar: 'iso8601', dateFormat: 'yyyy-mm-dd' })
        },
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
    return { requests, wrapper }
}

describe('data hooks', () => {
    it('useStageMetadata loads the narrowed stage', async () => {
        const { wrapper } = serve()
        const { result } = await renderHook(
            () => useStageMetadata('WSGAb5XwJ3Y', 'WZbXY0S00lP'),
            { wrapper }
        )
        await expect.poll(() => result.current.data).toBeDefined()
        expect(result.current.data?.dataElements.size).toBe(49)
    })

    it('useStageMetadata exposes a missing stage as an error', async () => {
        const { wrapper } = serve()
        const { result } = await renderHook(
            () => useStageMetadata('WSGAb5XwJ3Y', 'unknownStg1'),
            { wrapper }
        )
        await expect.poll(() => result.current.error).toBeTruthy()
        expect(result.current.error?.kind).toBe('not-found')
    })

    it('useTrackerEvent fetches only once it has an event id', async () => {
        const { wrapper, requests } = serve()
        const initialProps: EventProps = { id: undefined }
        const { result, rerender } = await renderHook(
            (props?: EventProps) => useTrackerEvent(props?.id),
            { wrapper, initialProps }
        )
        expect(result.current.fetchStatus).toBe('idle')
        expect(requests).toEqual([])

        await rerender({ id: 'Evahwp3zrQ4' })
        await expect.poll(() => result.current.data?.event).toBe('Evahwp3zrQ4')
    })

    it('useSystemCalendar loads the calendar and date format', async () => {
        const { wrapper } = serve()
        const { result } = await renderHook(() => useSystemCalendar(), {
            wrapper,
        })
        await expect
            .poll(() => result.current.data)
            .toEqual({
                calendar: 'iso8601',
                dateFormat: 'YYYY-MM-DD',
            })
    })
})
