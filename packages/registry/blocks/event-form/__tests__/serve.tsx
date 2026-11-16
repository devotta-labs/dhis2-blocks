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
    failing = [],
    held = [],
}: Served) => {
    const requests: Request[] = []
    let release = () => {}
    // Answers to the held resources wait until `release` is called.
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
            // As it arrives over the wire: plain JSON, no `undefined` members.
            return z
                .json()
                .parse(JSON.parse(JSON.stringify(body(request) ?? null)))
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
        // One org unit, for the categories and the location; a search for stored names finds none.
        organisationUnits: answer('organisationUnits', (request) =>
            request.id === undefined ? { organisationUnits: [] } : orgUnit
        ),
        tracker: answer('tracker', () => {
            if (refuse !== undefined) {
                throw Object.assign(new Error('Conflict'), { details: refuse })
            }
            return { status: 'OK', validationReport: { errorReports: [] } }
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
    /** The requests to one resource. */
    const to = (resource: string) =>
        requests.filter((request) => request.resource === resource)
    return { wrapper, requests, to, release }
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
