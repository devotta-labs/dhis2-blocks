import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
    createWorkingListQueryClient,
    WorkingListQueryBoundary,
} from '../WorkingListQueryBoundary'

describe('WorkingListQueryBoundary', () => {
    it('provides a package-owned query client without a host provider', () => {
        const Probe = () => {
            const client = useQueryClient()
            return <span>{client ? 'provided' : 'missing'}</span>
        }

        expect(
            renderToStaticMarkup(
                <WorkingListQueryBoundary>
                    <Probe />
                </WorkingListQueryBoundary>
            )
        ).toContain('provided')
    })

    it('accepts a shared query client when the host wants shared caching', () => {
        const sharedClient = createWorkingListQueryClient()
        const Probe = () => (
            <span>
                {useQueryClient() === sharedClient ? 'shared' : 'owned'}
            </span>
        )

        expect(
            renderToStaticMarkup(
                <WorkingListQueryBoundary client={sharedClient}>
                    <Probe />
                </WorkingListQueryBoundary>
            )
        ).toContain('shared')
    })

    it('reuses an inherited client without requiring explicit plumbing', () => {
        const inheritedClient = createWorkingListQueryClient()
        const Probe = () => {
            const resolvedClient = useQueryClient()
            return (
                <span>
                    {resolvedClient === inheritedClient
                        ? 'inherited'
                        : 'replaced'}
                </span>
            )
        }

        expect(
            renderToStaticMarkup(
                <QueryClientProvider client={inheritedClient}>
                    <WorkingListQueryBoundary>
                        <Probe />
                    </WorkingListQueryBoundary>
                </QueryClientProvider>
            )
        ).toContain('inherited')
    })
})
