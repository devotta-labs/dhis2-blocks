import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { z } from 'zod'
import {
    DataEntry,
    DataEntrySummary,
    DataGrid,
    useCell,
} from '@/components/data-entry'
import { useEventsRules } from '@/components/program-rules'
import {
    CUSTOM_FUNCTIONS,
    DEFAULT_EXPRESSION,
    ENROLLMENT,
    HISTORY,
    HistorySchema,
    PROGRAM,
    STAGE,
    TEST,
    LOOKUP,
} from './customFunctions'
import {
    createCustomLabServer,
    type CustomLabSettings,
} from './customFunctionsServer'

const CONTROL =
    'rounded border border-input bg-background px-3 py-2 text-sm text-foreground'
const PANEL = 'rounded-lg border border-border bg-card p-4'
const DEFAULTS: CustomLabSettings = {
    expression: DEFAULT_EXPRESSION,
    history: HISTORY,
    network: 'normal',
}
const PRESETS = {
    number: DEFAULT_EXPRESSION,
    string: "custom:string('findText', { testCode: #{selectedTest} })",
    boolean: "custom:boolean('hasResult', { testCode: #{selectedTest} })",
    reordered:
        "custom:number('findResult', { resultDataElement: 'labValue001', stageId: 'labStage001', testCode: #{selectedTest} })",
    invalid:
        "custom:number('findResult', { testCode: #{selectedTest}, typo: true })",
    duplicate:
        "custom:number('findResult', { testCode: 'HB', testCode: 'GLUCOSE' })",
}
const PresetSchema = z.enum([
    'number',
    'string',
    'boolean',
    'reordered',
    'invalid',
    'duplicate',
])
const NetworkSchema = z.enum(['normal', 'slow', 'error', 'hang'])

const Diagnostics = () => {
    const state = useEventsRules({
        programId: PROGRAM,
        programStageIds: [STAGE],
        tracker: true,
        enrollmentIds: [ENROLLMENT],
        customFunctions: CUSTOM_FUNCTIONS,
    })
    const selected = useCell(`currentRow1.${TEST}`)
    const result = state.rules?.evaluate(
        [
            {
                enrollmentId: ENROLLMENT,
                event: {
                    id: 'currentRow1',
                    programStageId: STAGE,
                    status: 'ACTIVE',
                    orgUnitId: 'orgUnit0001',
                    occurredAt: '2026-04-01',
                    dataValues: { [TEST]: selected.value ?? 'HB' },
                },
            },
        ],
        ['currentRow1']
    )
    const failure = result?.failures.get('currentRow1')
    const value = result?.effects
        .get('currentRow1')
        ?.assignedValues.get(LOOKUP)?.value
    return (
        <div aria-live="polite" className="space-y-2 text-sm">
            <p>
                Engine: <strong>{state.status}</strong>
            </p>
            <p>
                Evaluated result:{' '}
                <output aria-label="Evaluated custom result">
                    {state.status !== 'ready'
                        ? 'Loading'
                        : (value ?? 'No match')}
                </output>
            </p>
            <p className="text-muted-foreground">
                The preview evaluates immediately. The grid applies assignments
                only after you edit a row, so opening it never writes data.
            </p>
            {failure && (
                <p role="alert" className="text-destructive">
                    {failure.message}
                </p>
            )}
            {state.error && (
                <p role="alert" className="text-destructive">
                    {state.error.message}
                </p>
            )}
            {state.rules?.invalidRules.map((rule) => (
                <p role="alert" key={rule.ruleId} className="text-destructive">
                    {rule.message}
                </p>
            ))}
        </div>
    )
}

const RequestLog = ({
    server,
}: {
    server: ReturnType<typeof createCustomLabServer>
}) => {
    const requests = useSyncExternalStore(
        server.requests.subscribe,
        server.requests.getSnapshot
    )
    const start = requests[0]?.start ?? 0
    return (
        <section className={PANEL} aria-label="Request waterfall">
            <h2 className="mb-3 font-semibold">Fake DHIS2 requests</h2>
            {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No requests yet.
                </p>
            ) : (
                <ol className="space-y-2 text-sm">
                    {requests.map((entry) => (
                        <li
                            key={entry.id}
                            className="grid gap-1 sm:grid-cols-[1fr_10rem]"
                        >
                            <span className="break-all font-mono text-xs">
                                {entry.resource}
                            </span>
                            <span>
                                {entry.status} ·{' '}
                                {Math.round(entry.start - start)} ms
                                {entry.duration === undefined
                                    ? ''
                                    : ` + ${Math.round(entry.duration)} ms`}
                            </span>
                            <div className="h-1.5 overflow-hidden rounded bg-muted sm:col-span-2">
                                <div
                                    className="h-full bg-primary"
                                    style={{
                                        marginLeft: `${Math.min(80, (entry.start - start) / 30)}%`,
                                        width: `${Math.max(2, Math.min(100, (entry.duration ?? 30) / 30))}%`,
                                    }}
                                />
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    )
}

const Run = ({ settings }: { settings: CustomLabSettings }) => {
    const [client] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
    )
    const server = useMemo(() => createCustomLabServer(settings), [settings])
    // Keep the provider's children stable: logging must not replace app-runtime's data engine mid-edit.
    const content = useMemo(
        () => (
            <QueryClientProvider client={client}>
                <div className="space-y-4">
                    <section className={PANEL}>
                        <div className="mt-3 overflow-auto">
                            <DataEntry
                                source={server.source}
                                customFunctions={CUSTOM_FUNCTIONS}
                            >
                                <Diagnostics />
                                <DataGrid />
                                <DataEntrySummary />
                            </DataEntry>
                        </div>
                    </section>
                    <RequestLog server={server} />
                </div>
            </QueryClientProvider>
        ),
        [client, server]
    )
    return (
        <Provider
            config={{
                baseUrl: 'https://custom-functions.invalid',
                apiVersion: 43,
            }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={server.data}>
                {content}
            </CustomDataProvider>
        </Provider>
    )
}

/** `/lab.html?mode=custom`: an offline, app-shipped-functions playground on the spreadsheet branch. */
export const CustomFunctionsLab = () => {
    const [expression, setExpression] = useState(DEFAULT_EXPRESSION)
    const [history, setHistory] = useState(JSON.stringify(HISTORY, null, 2))
    const [network, setNetwork] =
        useState<CustomLabSettings['network']>('normal')
    const [run, setRun] = useState({ version: 0, settings: DEFAULTS })
    const [error, setError] = useState<string>()
    const [dark, setDark] = useState(false)
    const apply = () => {
        try {
            const parsed = HistorySchema.parse(JSON.parse(history))
            setRun((previous) => ({
                version: previous.version + 1,
                settings: { expression, history: parsed, network },
            }))
            setError(undefined)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause))
        }
    }
    return (
        <div className={dark ? 'dark' : ''}>
            <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <header className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Data entry lab / experimental
                            </p>
                            <h1 className="mt-2 text-2xl font-semibold">
                                Custom rule functions
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                                Real Kotlin/JS engine, object-shaped props,
                                complete synthetic tracked-entity history. No
                                login or API server needed.
                            </p>
                        </div>
                        <button
                            className={CONTROL}
                            onClick={() => setDark(!dark)}
                        >
                            {dark ? 'Light theme' : 'Dark theme'}
                        </button>
                    </header>
                    <section className={`${PANEL} space-y-4`}>
                        <div className="flex flex-wrap gap-3">
                            <label className="flex flex-col gap-1 text-sm">
                                Example
                                <select
                                    className={CONTROL}
                                    defaultValue="number"
                                    onChange={(event) =>
                                        setExpression(
                                            PRESETS[
                                                PresetSchema.parse(
                                                    event.target.value
                                                )
                                            ]
                                        )
                                    }
                                >
                                    <option value="number">
                                        Number lookup
                                    </option>
                                    <option value="string">
                                        String lookup
                                    </option>
                                    <option value="boolean">
                                        Boolean lookup
                                    </option>
                                    <option value="reordered">
                                        Reordered props
                                    </option>
                                    <option value="invalid">
                                        Unknown prop
                                    </option>
                                    <option value="duplicate">
                                        Duplicate key
                                    </option>
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm">
                                History request
                                <select
                                    className={CONTROL}
                                    value={network}
                                    onChange={(event) =>
                                        setNetwork(
                                            NetworkSchema.parse(
                                                event.target.value
                                            )
                                        )
                                    }
                                >
                                    <option value="normal">Normal</option>
                                    <option value="slow">Slow (1.5 s)</option>
                                    <option value="error">Failure</option>
                                    <option value="hang">Never resolves</option>
                                </select>
                            </label>
                        </div>
                        <label className="flex flex-col gap-2 text-sm font-medium">
                            Action expression
                            <textarea
                                className={`${CONTROL} min-h-36 w-full font-mono`}
                                value={expression}
                                onChange={(event) =>
                                    setExpression(event.target.value)
                                }
                                spellCheck={false}
                            />
                        </label>
                        <details>
                            <summary className="cursor-pointer text-sm font-medium">
                                Edit event history JSON ({HISTORY.length}{' '}
                                default events, two enrollments)
                            </summary>
                            <label className="mt-3 flex flex-col gap-2 text-sm">
                                Event history
                                <textarea
                                    className={`${CONTROL} min-h-72 w-full font-mono text-xs`}
                                    value={history}
                                    onChange={(event) =>
                                        setHistory(event.target.value)
                                    }
                                    spellCheck={false}
                                />
                            </label>
                        </details>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                                onClick={apply}
                            >
                                Apply and run
                            </button>
                            <span className="text-sm text-muted-foreground">
                                Try HB → 13.4, GLUCOSE → 6.1, or an unknown code
                                → no value.
                            </span>
                        </div>
                        {error && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {error}
                            </p>
                        )}
                    </section>
                    <Run key={run.version} settings={run.settings} />
                    <section
                        className={`${PANEL} space-y-2 text-sm text-muted-foreground`}
                    >
                        <h2 className="font-semibold text-foreground">
                            Function contract
                        </h2>
                        <p>
                            <code>findResult(props, context)</code> searches the
                            newest matching event (date, then event ID), reads a
                            sibling value on that event, and returns a nullable
                            number. The context includes both enrollments;
                            GLUCOSE demonstrates the second enrollment.
                        </p>
                        <p>
                            Props are validated against a strict Zod schema.
                            Strings, numbers, booleans and null are allowed;
                            duplicate keys, nested objects and arrays are
                            rejected. Functions are synchronous TypeScript
                            shipped with the app, not editable JavaScript
                            executed from this page.
                        </p>
                        <p>
                            Live grid edits overlay the snapshot between
                            evaluations. Props observe earlier rule assignments;
                            context is the start-of-pass snapshot. Full
                            server/API parity is not part of this POC.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    )
}
