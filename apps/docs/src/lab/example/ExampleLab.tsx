import { useDataQuery } from '@dhis2/app-runtime'
import { useState } from 'react'
import { LabLayout } from '../LabLayout'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import { RequestWaterfall } from '../RequestWaterfall'
import type { LabNetwork, NetworkRequest, RequestLogEntry } from '../network'

/** Every resource the block asks for; each gets a row in the network controls. */
const RESOURCES = ['me'] as const

/** The fake server: what DHIS2 would answer to each request. */
const answer = (request: NetworkRequest) => {
    if (request.resource === 'me') {
        return { id: 'labUser0001', displayName: 'Lab user' }
    }
    throw new Error(`The example lab does not serve ${request.resource}`)
}

const ME_QUERY = {
    me: { resource: 'me', params: { fields: 'id,displayName' } },
}

/** Stands in for the block under test. Replace it with the block's parts. */
const Subject = () => {
    const { loading, error, data, refetch } = useDataQuery(ME_QUERY)
    if (loading) return <p className="m-0 bg-white p-3">Loading…</p>
    if (error) {
        return (
            <p className="m-0 bg-white p-3" role="alert">
                {error.message}{' '}
                <button type="button" onClick={() => void refetch()}>
                    Try again
                </button>
            </p>
        )
    }
    return (
        <pre className="m-0 bg-white p-3">
            {JSON.stringify(data?.me, null, 2)}
        </pre>
    )
}

/** The smallest lab: a block on a fake server, its network controls and its requests. Copy this folder to start one. */
export const ExampleLab = () => {
    const [network, setNetwork] = useState<LabNetwork>({
        delay: 300,
        endpoints: {},
    })
    const [requests, setRequests] = useState<RequestLogEntry[]>([])
    const [run, setRun] = useState(0)
    // A fresh scope drops the cache, so the block asks again.
    const restart = () => {
        setRequests([])
        setRun((count) => count + 1)
    }

    return (
        <LabLayout
            title="Example lab"
            status={<span>{requests.length} REQ</span>}
            sidebar={
                <>
                    <NetworkControls
                        network={network}
                        endpoints={RESOURCES}
                        onChange={(next) => {
                            setNetwork(next)
                            restart()
                        }}
                    />
                    <button
                        type="button"
                        className="self-start"
                        onClick={restart}
                    >
                        Restart
                    </button>
                </>
            }
            panel={{
                title: 'Requests',
                children: <RequestWaterfall requests={requests} />,
            }}
        >
            <CanvasBoundary key={run}>
                <LabServerScope
                    key={run}
                    network={network}
                    resources={RESOURCES}
                    respond={answer}
                    log={setRequests}
                >
                    <Subject />
                </LabServerScope>
            </CanvasBoundary>
        </LabLayout>
    )
}
