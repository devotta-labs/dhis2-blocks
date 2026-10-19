import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { createEventFormStore, selectNote } from '../state/store'
import { buildEventPayload } from './payload'
import { generateUid } from './uid'
import { registerEventFormMutations, useSaveEvent } from './useSaveEvent'
import type { EventWriter } from './writer'

const setup = (writer: EventWriter) => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    registerEventFormMutations(queryClient, writer)
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    return renderHook(() => useSaveEvent(), { wrapper })
}

const payloadFor = (eventId: string) => {
    const store = createEventFormStore({
        eventId,
        isNew: true,
        stored: { a: '1' },
        context: { occurredAt: '2026-03-12', orgUnitId: 'm7fBMpmVpSM' },
        status: 'ACTIVE',
    })
    const state = store.getState()
    return buildEventPayload({
        eventId: state.eventId,
        programId: 'WSGAb5XwJ3Y',
        programStageId: 'WZbXY0S00lP',
        enrollmentId: 'PE6abx7Zhn0',
        status: state.status,
        context: state.context,
        effective: state.stored,
        initialStored: state.initialStored,
        note: selectNote(state),
        isNew: state.isNew,
    })
}

describe('useSaveEvent', () => {
    it('same payload saved twice uses the same event uid', async () => {
        const calls: string[] = []
        const writer: EventWriter = async ({ events }) => {
            calls.push(events[0].event)
            return Result.ok({ outcome: 'saved' as const })
        }
        const { result, act } = await setup(writer)
        const payload = payloadFor(generateUid())

        await act(async () => {
            await Promise.all([
                result.current.mutateAsync(payload),
                result.current.mutateAsync(payload),
            ])
        })

        expect(calls).toHaveLength(2)
        expect(calls[0]).toBe(calls[1])
        expect(calls[0]).toBe(payload.events[0].event)
    })

    it('queued outcome reaches the mutation result', async () => {
        const writer: EventWriter = async () =>
            Result.ok({ outcome: 'queued' as const })
        const { result, act } = await setup(writer)

        await act(async () => {
            await result.current.mutateAsync(payloadFor(generateUid()))
        })

        expect(result.current.data).toEqual(Result.ok({ outcome: 'queued' }))
    })
})
