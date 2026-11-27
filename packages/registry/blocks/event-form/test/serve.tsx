import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import { EventForm } from '../ui/EventForm'
import type { EventFormProps } from '../ui/EventForm'
import type { importReportSchema } from '../lib/importReport'
import {
    CHILD_VISIT,
    CHILD_VISIT_PATH,
    CHILD_VISIT_RULES,
    CHILD_VISIT_VARIABLES,
    childVisitProgram,
    SAVED_VISIT,
} from './childVisit'

interface Served {
    program: unknown
    rules: unknown
    variables: unknown
    event?: unknown
    /** What `organisationUnits/<id>` answers; the Child visit org unit's path by default. */
    orgUnit?: unknown
    /** The user's authorities, as `me` answers them; none by default. */
    authorities?: readonly string[]
    /** The import report a refused save throws with. */
    refuse?: z.infer<typeof importReportSchema>
    /** What a save answers when it is not refused; an import report by default. */
    saved?: Json
    /** Resources that fail with an access error, so the rules' hooks do not retry. */
    failing?: readonly string[]
    /** Resources that answer only once `release` is called. */
    held?: readonly string[]
}

type Json = z.infer<ReturnType<typeof z.json>>

interface Request {
    resource: string
    id?: string
    params?: Record<string, Json | undefined>
    data?: Json
}

/** The form's server through the app-runtime, with every request recorded. */
export const serve = ({
    program,
    rules,
    variables,
    event,
    orgUnit = { path: CHILD_VISIT_PATH },
    authorities = [],
    refuse,
    saved = { status: 'OK', validationReport: { errorReports: [] } },
    failing = [],
    held = [],
}: Served) => {
    const requests: Request[] = []
    const answers = new Map<string, PromiseWithResolvers<void>>()
    const answeredSignal = (resource: string) => {
        const signal = answers.get(resource) ?? Promise.withResolvers<void>()
        answers.set(resource, signal)
        return signal
    }
    let release = () => {}
    const holding = new Promise<void>((resolve) => {
        release = resolve
    })
    const answer =
        <T,>(resource: string, body: (request: Request) => T) =>
        async (_type: string, request: Request) => {
            requests.push({
                resource,
                id: request.id,
                params: request.params,
                data: request.data,
            })
            if (held.includes(resource)) {
                await holding
            }
            if (failing.includes(resource)) {
                throw new FetchError({
                    type: 'access',
                    message: `${resource} failed`,
                })
            }
            const parsed = z
                .json()
                .parse(JSON.parse(JSON.stringify(body(request) ?? null)))
            answeredSignal(resource).resolve()
            return parsed
        }
    const data = {
        programs: answer('programs', () => program),
        'system/info': answer('system/info', () => ({
            calendar: 'iso8601',
            dateFormat: 'yyyy-MM-dd',
        })),
        'tracker/events': answer('tracker/events', () => event),
        programRules: answer('programRules', () => rules),
        programRuleVariables: answer('programRuleVariables', () => variables),
        constants: answer('constants', () => ({ constants: [] })),
        me: answer('me', () => ({
            userRoles: [],
            userGroups: [],
            authorities,
        })),
        organisationUnits: answer('organisationUnits', (request) =>
            request.id === undefined ? { organisationUnits: [] } : orgUnit
        ),
        tracker: answer('tracker', () => {
            if (refuse !== undefined) {
                throw Object.assign(new Error('Conflict'), { details: refuse })
            }
            return saved
        }),
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    const to = (resource: string) =>
        requests.filter((request) => request.resource === resource)
    const answered = (resource: string) => answeredSignal(resource).promise
    return { wrapper, requests, to, release, answered }
}

/** A prop's callback that records each value it is called with; `until` resolves once those values pass `done`. */
export const recorded = <T,>() => {
    const values: T[] = []
    const waiting = new Set<{
        done: (values: readonly T[]) => boolean
        resolve: () => void
    }>()
    const callback = (value: T) => {
        values.push(value)
        for (const wait of waiting) {
            if (wait.done(values)) {
                waiting.delete(wait)
                wait.resolve()
            }
        }
    }
    const until = (done: (values: readonly T[]) => boolean) => {
        if (done(values)) {
            return Promise.resolve()
        }
        const { promise, resolve } = Promise.withResolvers<void>()
        waiting.add({ done, resolve })
        return promise
    }
    return { callback, values, until }
}

/** The Child visit form for a new event, or `SAVED_VISIT` with `eventId`, on a fake server. */
export const renderForm = async (
    served: Partial<Served> = {},
    props: Partial<EventFormProps> = {}
) => {
    const server = serve({
        program: childVisitProgram(),
        rules: CHILD_VISIT_RULES,
        variables: CHILD_VISIT_VARIABLES,
        event: SAVED_VISIT,
        ...served,
    })
    await render(
        <EventForm
            programId={CHILD_VISIT.programId}
            programStageId={CHILD_VISIT.stageId}
            orgUnitId={CHILD_VISIT.orgUnitId}
            blame="off"
            {...props}
        />,
        { wrapper: server.wrapper }
    )
    return server
}

/** Waits until the rules have loaded and the form can be edited. */
export const editable = async () => {
    await expect
        .element(page.getByRole('textbox', { name: 'Weight (kg)' }), {
            timeout: 10_000,
        })
        .not.toHaveAttribute('readonly')
}
