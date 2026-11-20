import { useEffect, useState, type ReactNode } from 'react'
import { LabServerScope } from '../../playground/LabServer'
import type { LabNetwork } from '../../playground/network'
import { loadMockServer, type MockServer } from './mockServers'

/** No waiting: the docs' mock DHIS2 answers at once. */
const NETWORK: LabNetwork = { delay: 0, endpoints: {} }
const noLog = () => {}

/**
 * Hosts a docs example on the playground's fake DHIS2 instead of a live
 * server, so it needs no proxy, sign-in or session. `placeholder` shows
 * while the fake server's code loads; the example's own placeholder takes
 * over after that.
 */
export const MockPreviewHost = ({
    slug,
    placeholder,
    children,
}: {
    slug: string
    placeholder: ReactNode
    children: ReactNode
}) => {
    const [loaded, setLoaded] = useState<{ slug: string; server: MockServer }>()
    const [error, setError] = useState<Error>()

    useEffect(() => {
        let current = true
        loadMockServer(slug)
            .then((server) => current && setLoaded({ slug, server }))
            .catch((failure: Error) => current && setError(failure))
        return () => {
            current = false
        }
    }, [slug])

    if (error) throw error
    if (loaded?.slug !== slug) return placeholder

    return (
        <LabServerScope network={NETWORK} log={noLog} {...loaded.server}>
            {children}
        </LabServerScope>
    )
}
