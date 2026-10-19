import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import { buildEventPayload, type EventPayload } from './payload'
import {
    eventFormMutationKeys,
    registerEventFormMutations,
} from './useSaveEvent'
import type { EventWriter } from './writer'

type SaveResult = Awaited<ReturnType<EventWriter>>

const payload = buildEventPayload({
    eventId: 'Evahwp3zrQ4',
    programId: 'WSGAb5XwJ3Y',
    programStageId: 'WZbXY0S00lP',
    enrollmentId: 'PE6abx7Zhn0',
    status: 'ACTIVE',
    context: { occurredAt: '2026-03-12', orgUnitId: 'm7fBMpmVpSM' },
    effective: { a: '1' },
    initialStored: {},
    noteDraft: '',
    isNew: true,
})

describe('save mutation defaults', () => {
    it('uses a stable key and resolves through the registered writer without an inline mutationFn', async () => {
        expect(eventFormMutationKeys.save).toEqual(['event-form', 'save'])
        const queryClient = new QueryClient()
        const writer: EventWriter = async () =>
            Result.ok({ outcome: 'queued' as const })
        registerEventFormMutations(queryClient, writer)

        const observer = new MutationObserver<SaveResult, Error, EventPayload>(
            queryClient,
            { mutationKey: eventFormMutationKeys.save }
        )
        const result = await observer.mutate(payload)
        expect(result).toEqual(Result.ok({ outcome: 'queued' }))
    })

    it('a mutation rehydrated from the cache resumes with the registered writer', async () => {
        const queryClient = new QueryClient()
        const received: unknown[] = []
        registerEventFormMutations(queryClient, async (p) => {
            received.push(p)
            return Result.ok({ outcome: 'saved' as const })
        })
        // What a persister does after a reload: build a paused mutation from stored state.
        const mutation = queryClient.getMutationCache().build(queryClient, {
            mutationKey: eventFormMutationKeys.save,
        })
        await mutation.execute(payload)
        expect(received).toEqual([payload])
    })
})
