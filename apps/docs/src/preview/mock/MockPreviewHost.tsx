import { useEffect, useState, type ReactNode } from 'react'
import { LabServerScope } from '../../playground/LabServer'
import { loadMockServer } from './registry'
import { MOCK_NETWORK, type MockServer } from './servers'

const ignore = () => undefined

/**
 * The live preview host without a DHIS2: the example runs on the playground's
 * fake server for its block, with no sign-in and no proxy round trip.
 * `placeholder` shows until the server's module has loaded; pass the one the
 * example suspends with.
 */
export const MockPreviewHost = ({
    slug,
    children,
    placeholder,
}: {
    slug: string
    children: ReactNode
    placeholder: ReactNode
}) => {
    const [server, setServer] = useState<MockServer>()

    useEffect(() => {
        let current = true
        void loadMockServer(slug)?.then((loaded) => {
            if (current) setServer(loaded)
        })
        return () => {
            current = false
        }
    }, [slug])

    if (!server) return placeholder

    return (
        <LabServerScope
            network={MOCK_NETWORK}
            resources={server.resources}
            respond={server.respond}
            log={ignore}
            apiVersion={server.apiVersion}
            systemInfo={server.systemInfo}
        >
            {children}
        </LabServerScope>
    )
}
