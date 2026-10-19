import { CustomDataProvider } from '@dhis2/app-runtime'
import React, { type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { buildEventPayload } from '../save/payload'
import { createOnlineEventWriter } from '../save/writer'
import { useEventFormClient } from './runtimeClient'

interface Call {
    type: string
    resource: string
    params: unknown
    data: unknown
}

const payload = buildEventPayload({
    eventId: 'Evahwp3zrQ4',
    programId: 'WSGAb5XwJ3Y',
    programStageId: 'WZbXY0S00lP',
    enrollmentId: 'PE6abx7Zhn0',
    status: 'ACTIVE',
    context: { occurredAt: '2026-03-12', orgUnitId: 'm7fBMpmVpSM' },
    effective: { de0FEHSIoxh: 'OLD_CODE' },
    initialStored: {},
    noteDraft: '',
    isNew: true,
})

const setup = (respond: () => Record<string, string>) => {
    const calls: Call[] = []
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider
            data={{
                tracker: async (
                    type: string,
                    query: {
                        resource: string
                        params?: unknown
                        data?: unknown
                    }
                ) => {
                    calls.push({
                        type,
                        resource: query.resource,
                        params: query.params,
                        data: query.data,
                    })
                    return respond()
                },
            }}
        >
            {children}
        </CustomDataProvider>
    )
    return { calls, wrapper }
}

describe('useEventFormClient mutations', () => {
    it('sends the save through the runtime data engine and reports saved', async () => {
        const { calls, wrapper } = setup(() => ({ status: 'OK' }))
        const { result } = await renderHook(() => useEventFormClient(), {
            wrapper,
        })
        const saved = await createOnlineEventWriter(result.current)(payload)
        expect(saved.isOk() && saved.value).toEqual({ outcome: 'saved' })
        expect(calls).toEqual([
            {
                type: 'create',
                resource: 'tracker',
                params: {
                    importStrategy: 'CREATE_AND_UPDATE',
                    atomicMode: 'OBJECT',
                    async: false,
                },
                data: payload,
            },
        ])
    })

    it('maps a 409 thrown by the runtime to a field error', async () => {
        const { wrapper } = setup(() => {
            throw Object.assign(new Error('Import failed'), {
                type: 'access',
                details: {
                    httpStatusCode: 409,
                    response: {
                        validationReport: {
                            errorReports: [
                                {
                                    message: 'bad option',
                                    args: ['de0FEHSIoxh'],
                                },
                            ],
                        },
                    },
                },
            })
        })
        const { result } = await renderHook(() => useEventFormClient(), {
            wrapper,
        })
        const saved = await createOnlineEventWriter(result.current)(payload)
        expect(saved.isErr() && saved.error).toEqual({
            kind: 'validation',
            fieldErrors: { de0FEHSIoxh: 'bad option' },
            formErrors: [],
        })
    })

    it('turns a mutation the adapter cannot build into an error, not a throw', async () => {
        const { calls, wrapper } = setup(() => ({}))
        const { result } = await renderHook(() => useEventFormClient(), {
            wrapper,
        })
        const outcome = await result.current.mutate({
            resource: 'tracker',
            type: 'create',
            data: 'not an object',
        })
        expect(outcome.isErr()).toBe(true)
        expect(calls).toEqual([])
    })
})
