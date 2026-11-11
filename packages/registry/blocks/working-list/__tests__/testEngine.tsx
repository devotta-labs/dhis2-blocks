import { CustomDataProvider, Provider, useDataEngine } from '@dhis2/app-runtime'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { z } from 'zod'
import type { DataEngine } from '../api/request'

export type CustomData = ComponentProps<typeof CustomDataProvider>['data']
export type CustomResource = CustomData[string]

/** A request as the data engine hands it to the server. */
export const RequestSchema = z.object({
    resource: z.string(),
    id: z.string().optional(),
    params: z.record(z.string(), z.json()).optional(),
    data: z.json().optional(),
})
export type Request = z.infer<typeof RequestSchema>

/**
 * The engine app-runtime builds over `data`, for tests that call a fetcher
 * or a mutation function outside a component.
 */
export const createTestEngine = async (
    data: CustomData
): Promise<DataEngine> => {
    const { result } = await renderHook(() => useDataEngine(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <CustomDataProvider data={data}>{children}</CustomDataProvider>
        ),
    })
    return result.current
}

/**
 * app-runtime's own provider, so the block reads the API version and the
 * connection status as in an app, with the fake server behind its engine.
 */
export const TestRuntime = ({
    data,
    apiVersion = 43,
    children,
}: {
    data: CustomData
    apiVersion?: number
    children: ReactNode
}) => (
    <Provider
        config={{ baseUrl: '..', apiVersion }}
        userInfo={undefined}
        plugin={false}
        parentAlertsAdd={undefined}
        showAlertsInPlugin={false}
    >
        <CustomDataProvider data={data}>{children}</CustomDataProvider>
    </Provider>
)
