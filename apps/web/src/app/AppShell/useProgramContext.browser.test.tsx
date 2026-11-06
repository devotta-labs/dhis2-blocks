import type {
    ResourceRequest,
    WorkingListClient,
} from '@/components/working-list/api/client'
import type { TrackerProgramsResponseSchema } from '@/components/working-list/api/schemas'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import type { z } from 'zod'
import { useProgramContext } from './useProgramContext'

const unit = { id: 'ou', displayName: 'Clinic', path: '/capture/ou' }
const root = { id: 'capture', displayName: 'Capture', path: '/capture' }
const program = {
    id: 'program',
    displayName: 'Program',
    programType: 'WITH_REGISTRATION',
    access: { data: { read: true } },
}
type ProgramSummary = z.infer<
    typeof TrackerProgramsResponseSchema
>['programs'][number]

const setup = (
    programs: ProgramSummary[],
    assignments: () => Promise<{
        organisationUnits: (typeof unit)[]
    }> = async () => ({ organisationUnits: [unit] })
) => {
    const requests: ResourceRequest[] = []
    const client: WorkingListClient = {
        query: async (request, schema) => {
            requests.push(request)
            return schema.parse(request.id ? await assignments() : { programs })
        },
        mutate: async () => {
            throw new Error('Unexpected mutation')
        },
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    const options = {
        client,
        programId: program.id,
        selectedOrganisationUnit: unit,
        captureRoots: [root],
        baseUrl: '/dhis2',
        apiVersion: 43,
    }
    return { requests, wrapper, options, queryClient }
}

describe('program context query and projection', () => {
    it('uses summary assignments without a duplicate detail read', async () => {
        const { requests, wrapper, options } = setup([
            { ...program, organisationUnits: [unit] },
        ])
        const { result, rerender } = await renderHook(
            () => useProgramContext(options),
            { wrapper }
        )
        await expect.poll(() => result.current.loading).toBe(false)
        expect(result.current.error).toBeFalsy()
        expect(result.current.selectedOrgUnitIsAllowed).toBe(true)
        expect(result.current.availability).toBe('all')
        expect(result.current.options).toEqual([
            expect.objectContaining({
                value: program.id,
                label: program.displayName,
            }),
        ])
        await rerender()
        expect(requests).toHaveLength(1)
        expect(requests[0].id).toBeUndefined()
    })

    it('treats empty summary assignments as authoritative even with cached detail assignments', async () => {
        const { requests, wrapper, options, queryClient } = setup([
            { ...program, organisationUnits: [] },
        ])
        queryClient.setQueryData(
            ['working-list', 'shell', 'program-org-units', program.id],
            { organisationUnits: [unit] }
        )
        const { result } = await renderHook(() => useProgramContext(options), {
            wrapper,
        })
        await expect.poll(() => result.current.loading).toBe(false)
        expect(result.current.selectedOrgUnitIsAllowed).toBe(false)
        expect(result.current.availability).toBe('empty')
        expect(result.current.options).toEqual([
            expect.objectContaining({
                value: program.id,
                excludeFromMenu: true,
            }),
        ])
        expect(requests).toHaveLength(1)
    })

    it('waits for missing assignments and uses the detail fallback for both validity and options', async () => {
        let resolveDetail: (value: {
            organisationUnits: (typeof unit)[]
        }) => void = () => undefined
        const { requests, wrapper, options } = setup(
            [program],
            () =>
                new Promise((resolve) => {
                    resolveDetail = resolve
                })
        )
        const { result } = await renderHook(() => useProgramContext(options), {
            wrapper,
        })
        await expect
            .poll(() => requests.filter((request) => request.id).length)
            .toBe(1)
        expect(result.current.loading).toBe(true)
        resolveDetail({ organisationUnits: [unit] })
        await expect.poll(() => result.current.loading).toBe(false)
        expect(result.current.selectedOrgUnitIsAllowed).toBe(true)
        expect(result.current.availability).toBe('all')
        expect(result.current.options[0].excludeFromMenu).toBeUndefined()
        expect(requests[1]).toMatchObject({
            id: program.id,
            params: { fields: 'organisationUnits[id,displayName,path]' },
        })
    })

    it('surfaces fallback failures and recovers through the context retry action', async () => {
        let failing = true
        const { requests, wrapper, options } = setup([program], async () => {
            if (failing) throw new Error('Detail unavailable')
            return { organisationUnits: [unit] }
        })
        const { result } = await renderHook(() => useProgramContext(options), {
            wrapper,
        })
        await expect
            .poll(() => result.current.error)
            .toEqual(new Error('Detail unavailable'))
        expect(result.current.loading).toBe(false)
        expect(result.current.selectedOrgUnitIsAllowed).toBe(false)
        expect(requests.filter((request) => request.id)).toHaveLength(3)
        failing = false
        result.current.retry()
        await expect
            .poll(() => result.current.selectedOrgUnitIsAllowed)
            .toBe(true)
        expect(result.current.error).toBeFalsy()
    })

    it('projects partially filtered choices while retaining an incompatible selection for display', async () => {
        const { wrapper, options } = setup([
            {
                ...program,
                organisationUnits: [
                    { ...unit, id: 'other', path: '/capture/other' },
                ],
            },
            { ...program, id: 'compatible', organisationUnits: [unit] },
            {
                ...program,
                id: 'inaccessible',
                organisationUnits: [unit],
                access: { data: { read: false } },
            },
        ])
        const { result } = await renderHook(() => useProgramContext(options), {
            wrapper,
        })
        await expect.poll(() => result.current.loading).toBe(false)
        expect(result.current.availability).toBe('filtered')
        expect(result.current.selectedOrgUnitIsAllowed).toBe(false)
        expect(result.current.options).toEqual([
            expect.objectContaining({
                value: program.id,
                excludeFromMenu: true,
            }),
            expect.objectContaining({ value: 'compatible' }),
        ])
    })

    it('requires both Capture hierarchy membership and exact program assignment', async () => {
        const { wrapper, options } = setup([
            { ...program, organisationUnits: [root] },
        ])
        const { result, rerender } = await renderHook(
            (selected = unit) =>
                useProgramContext({
                    ...options,
                    selectedOrganisationUnit: selected,
                }),
            { wrapper, initialProps: unit }
        )
        await expect.poll(() => result.current.loading).toBe(false)
        expect(result.current.selectedOrgUnitIsAllowed).toBe(false)
        await rerender(root)
        expect(result.current.selectedOrgUnitIsAllowed).toBe(true)
        await rerender({ ...root, path: '/outside' })
        expect(result.current.selectedOrgUnitIsAllowed).toBe(false)
        await rerender({ ...root, id: 'different' })
        expect(result.current.selectedOrgUnitIsAllowed).toBe(false)
    })
})
