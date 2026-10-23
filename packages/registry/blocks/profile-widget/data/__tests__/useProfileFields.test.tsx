import { renderHook } from 'vitest-browser-react'
import type { ProfileFieldInput } from '../../types'
import { toFormattableField, useProfileFields } from '../useProfileFields'
import { createHarness, type Responder } from './harness'

const inputs: readonly ProfileFieldInput[] = [
    {
        id: 'Weight00001',
        label: 'Weight',
        valueType: 'NUMBER',
        value: '3,50',
    },
    {
        id: 'Facility001',
        label: 'Facility',
        valueType: 'ORGANISATION_UNIT',
        value: 'DiszpKrYNg8',
    },
    {
        id: 'Report00001',
        label: 'Report',
        valueType: 'FILE_RESOURCE',
        value: 'FileResour1',
        fileEndpoint: 'tracker/events/EventId0001/dataValues/Report00001',
    },
    {
        id: 'Custom00001',
        label: 'Custom',
        valueType: 'SOMETHING_NEW',
        value: 'kept',
    },
]

describe('toFormattableField', () => {
    it('decodes the value type and wraps the file endpoint', () => {
        expect(toFormattableField(inputs[2])).toEqual({
            id: 'Report00001',
            label: 'Report',
            valueType: 'FILE_RESOURCE',
            rawValue: 'FileResour1',
            options: undefined,
            file: {
                endpoint: 'tracker/events/EventId0001/dataValues/Report00001',
            },
        })
        expect(toFormattableField(inputs[3])).toMatchObject({
            valueType: 'TEXT',
            file: undefined,
        })
    })
})

describe('useProfileFields', () => {
    it('stays pending while inputs are undefined, then formats them', async () => {
        const harness = createHarness()
        const hook = await renderHook(
            (props?: { inputs?: readonly ProfileFieldInput[] }) =>
                useProfileFields(props?.inputs),
            { wrapper: harness.wrapper, initialProps: {} }
        )

        expect(hook.result.current).toEqual({
            data: undefined,
            error: null,
            isPending: true,
        })
        expect(harness.resourcesRequested()).not.toContain('organisationUnits')

        await hook.rerender({ inputs })
        await expect.poll(() => hook.result.current.data).toBeDefined()

        expect(hook.result.current.isPending).toBe(false)
        expect(
            hook.result.current.data?.map((field) => [field.id, field.value])
        ).toEqual([
            ['Weight00001', { kind: 'text', text: '3.5' }],
            [
                'Facility001',
                {
                    kind: 'organisationUnit',
                    name: 'Ngelehun CHC',
                    path: ['Sierra Leone', 'Bo', 'Badjia'],
                },
            ],
            [
                'Report00001',
                {
                    kind: 'file',
                    name: 'consent.pdf',
                    href: 'https://dhis2.test/api/43/tracker/events/EventId0001/dataValues/Report00001/file',
                },
            ],
            ['Custom00001', { kind: 'text', text: 'kept' }],
        ])
    })

    it('formats inputs without lookups as soon as system info arrives', async () => {
        const harness = createHarness()
        const hook = await renderHook(
            () =>
                useProfileFields([
                    {
                        id: 'Done0000001',
                        label: 'Done',
                        valueType: 'BOOLEAN',
                        value: 'true',
                    },
                ]),
            { wrapper: harness.wrapper }
        )

        await expect.poll(() => hook.result.current.data).toBeDefined()
        expect(hook.result.current.data?.[0]?.value).toEqual({
            kind: 'text',
            text: 'Yes',
        })
        expect(harness.resourcesRequested()).toEqual(['system/info'])
    })

    it('reports a failed system/info request as a request error', async () => {
        const harness = createHarness(
            new Map<string, Responder>([
                [
                    'system/info',
                    () => {
                        throw new Error('Offline')
                    },
                ],
            ])
        )
        const hook = await renderHook(() => useProfileFields(inputs), {
            wrapper: harness.wrapper,
        })

        await expect.poll(() => hook.result.current.error).not.toBeNull()
        expect(hook.result.current).toMatchObject({
            data: undefined,
            isPending: false,
            error: { operation: 'Load system settings' },
        })
    })
})
