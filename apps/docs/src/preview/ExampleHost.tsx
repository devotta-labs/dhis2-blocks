import type { ReactNode } from 'react'
import type { ExampleDefinition } from '../examples/registry'
import { LivePreviewHost } from './LivePreviewHost'
import { MockPreviewHost } from './mock/MockPreviewHost'
import { hasMockServer } from './mock/registry'

/**
 * Gives an example what it runs on: the fake DHIS2 of its block when it has
 * one, a live DHIS2 when it is `live` without, else nothing.
 */
export const ExampleHost = ({
    example,
    placeholder,
    signInUrl,
    children,
}: {
    example: ExampleDefinition
    placeholder: ReactNode
    signInUrl?: string
    children: ReactNode
}) => {
    if (hasMockServer(example.slug)) {
        return (
            <MockPreviewHost slug={example.slug} placeholder={placeholder}>
                {children}
            </MockPreviewHost>
        )
    }
    if (example.live) {
        return (
            <LivePreviewHost placeholder={placeholder} signInUrl={signInUrl}>
                {children}
            </LivePreviewHost>
        )
    }
    return children
}
