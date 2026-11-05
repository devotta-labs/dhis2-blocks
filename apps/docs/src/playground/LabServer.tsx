import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    Component,
    createContext,
    useContext,
    useMemo,
    useState,
    type ComponentProps,
    type ReactNode,
} from 'react'
import {
    throughNetwork,
    type LabNetwork,
    type Log,
    type NetworkRequest,
} from './network'

const LabContentContext = createContext<ReactNode>(null)
const LabContent = () => useContext(LabContentContext)

/**
 * A fake DHIS2 under the block: app-runtime and TanStack Query, with every
 * request for `resources` sent through the lab network to `respond`. Remount it
 * (change its `key`) for a fresh cache.
 */
export interface LabServerProps<Request extends NetworkRequest> {
    network: LabNetwork
    resources: readonly string[]
    /** Answers one request, a read or a mutation by `type`, with JSON shaped like DHIS2's response. */
    respond: (
        request: Request,
        type: 'read' | 'create' | 'update' | 'replace' | 'delete'
    ) => object | Promise<object>
    log: Log
    apiVersion?: number
    /** What app-runtime's `useConfig().systemInfo` returns, for blocks that read it there. */
    systemInfo?: ComponentProps<typeof Provider>['config']['systemInfo'] & {
        calendar?: string
    }
    children: ReactNode
}

export const LabServerScope = <Request extends NetworkRequest>({
    network,
    resources,
    respond,
    log,
    apiVersion = 43,
    systemInfo,
    children,
}: LabServerProps<Request>) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { refetchOnWindowFocus: false, retry: false },
                },
            })
    )
    const data = useMemo(() => {
        const answer = (
            type: 'read' | 'create' | 'update' | 'replace' | 'delete',
            request: Request,
            options?: { signal?: AbortSignal }
        ) =>
            throughNetwork(
                network,
                type === 'read' ? request : { ...request, type },
                () => respond(request, type),
                log,
                options?.signal
            )
        // SAFETY: `respond` returns plain JSON shaped like DHIS2's responses.
        return Object.fromEntries(
            resources.map((resource) => [resource, answer])
        ) as ComponentProps<typeof CustomDataProvider>['data']
    }, [log, network, resources, respond])
    // CustomDataProvider creates an engine on each render. Log and child updates
    // must not replace that engine and restart the block's source-aware queries.
    const runtime = useMemo(
        () => (
            <Provider
                config={{ baseUrl: '..', apiVersion, systemInfo }}
                userInfo={undefined}
                plugin={false}
                parentAlertsAdd={undefined}
                showAlertsInPlugin={false}
            >
                <CustomDataProvider data={data}>
                    <QueryClientProvider client={queryClient}>
                        <LabContent />
                    </QueryClientProvider>
                </CustomDataProvider>
            </Provider>
        ),
        [apiVersion, data, queryClient, systemInfo]
    )
    return (
        <LabContentContext.Provider value={children}>
            {runtime}
        </LabContentContext.Provider>
    )
}

interface CanvasBoundaryState {
    error?: Error
}

/** Keeps the lab usable when a scenario crashes the block, and shows why. */
export class CanvasBoundary extends Component<
    { children: ReactNode },
    CanvasBoundaryState
> {
    state: CanvasBoundaryState = {}

    static getDerivedStateFromError(error: Error) {
        return { error }
    }

    render() {
        const { error } = this.state
        if (!error) return this.props.children
        return (
            <div
                className="flex flex-col gap-2 bg-white p-4 text-sm"
                role="alert"
            >
                <strong className="text-dhis2-red-700">
                    The block crashed: {error.message}
                </strong>
                <pre className="m-0 overflow-x-auto text-xs whitespace-pre-wrap text-dhis2-grey-700">
                    {error.stack?.split('\n').slice(0, 6).join('\n')}
                </pre>
                <button
                    type="button"
                    className="self-start rounded border border-dhis2-grey-500 bg-white px-1.5 py-0.5"
                    onClick={() => this.setState({ error: undefined })}
                >
                    Try again
                </button>
            </div>
        )
    }
}
