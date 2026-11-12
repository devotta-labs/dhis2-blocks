import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useState, type ReactNode } from 'react'
import { z } from 'zod'
import {
    RequestSchema,
    TestRuntime,
    type CustomData,
    type CustomResource,
    type Request,
} from './testEngine'

type Json = z.infer<ReturnType<typeof z.json>>
type JsonObject = { [key: string]: Json }

const JsonObjectSchema = z.record(z.string(), z.json())

/** A request that never gets an answer, so what waits on it stays pending. */
export const silent = () => new Promise<never>(() => undefined)

export const fakeProgram = {
    id: 'Program0001',
    displayName: 'Child programme',
    programType: 'WITH_REGISTRATION',
    programTrackedEntityAttributes: [
        {
            displayInList: true,
            trackedEntityAttribute: {
                id: 'Attribute01',
                displayName: 'First name',
                valueType: 'TEXT',
            },
        },
    ],
    programStages: [
        {
            id: 'ProgStage01',
            displayName: 'Visit',
            access: { read: true },
            programStageDataElements: [],
        },
    ],
} satisfies JsonObject

const everyAccess = {
    read: true,
    update: true,
    delete: true,
    write: true,
    manage: true,
}

/** The two resources DHIS2 keeps saved lists in, and what each holds. */
interface SavedLists {
    trackedEntityInstanceFilters: JsonObject[]
    programStageWorkingLists: JsonObject[]
}

interface FakeServerOptions {
    program?: JsonObject
    systemInfo?: JsonObject
    /** Saved tracked-entity lists, as `trackedEntityInstanceFilters` returns them. */
    trackedEntityLists?: JsonObject[]
    /** Saved event lists, as `programStageWorkingLists` returns them. */
    eventLists?: JsonObject[]
    /** Answers `tracker/trackedEntities` and `tracker/events`. */
    records?: (request: Request) => Json | Promise<Json>
    /**
     * Replaces the server's answer to a saved-list write. The write is still
     * recorded, but the lists stay as they were.
     */
    answerWrite?: (write: Request & { type: string }) => Json | Promise<Json>
    /** Any other resource, or a replacement for one of the built-in ones. */
    resources?: CustomData
}

/**
 * A DHIS2 server small enough to read: a program, its saved lists and its
 * records. Saved-list writes change what the next read returns, as they do on
 * a server, so a test sees the block reload rather than a canned answer.
 */
export const createFakeServer = ({
    program = fakeProgram,
    systemInfo = {
        calendar: 'gregorian',
        dateFormat: 'YYYY-MM-DD',
        serverTimeZoneId: 'UTC',
    },
    trackedEntityLists = [],
    eventLists = [],
    records = () => ({ trackedEntities: [], events: [] }),
    answerWrite,
    resources = {},
}: FakeServerOptions = {}) => {
    /** Every read, in the order the server received it. */
    const reads: Request[] = []
    /** Every saved-list write, in the order the server received it. */
    const writes: Array<Request & { type: string }> = []
    const lists: SavedLists = {
        trackedEntityInstanceFilters: [...trackedEntityLists],
        programStageWorkingLists: [...eventLists],
    }
    let created = 0

    const savedLists =
        (name: keyof SavedLists): CustomResource =>
        async (type, query): Promise<Json> => {
            const request = RequestSchema.parse(query)
            if (type === 'read') {
                reads.push(request)
                return { [name]: lists[name] }
            }
            const write = { ...request, type }
            writes.push(write)
            if (answerWrite) return answerWrite(write)
            if (type === 'delete') {
                lists[name] = lists[name].filter(
                    (list) => list.id !== request.id
                )
                return { httpStatus: 'OK', httpStatusCode: 200, status: 'OK' }
            }
            const body = JsonObjectSchema.parse(request.data)
            const id =
                request.id ?? `Created${String(++created).padStart(4, '0')}`
            const stored = {
                ...body,
                id,
                displayName: body.name ?? null,
                access: everyAccess,
            }
            lists[name] = request.id
                ? lists[name].map((list) => (list.id === id ? stored : list))
                : [...lists[name], stored]
            return {
                httpStatus: 'OK',
                httpStatusCode: 200,
                status: 'OK',
                response: { uid: id },
            }
        }
    const read =
        (respond: (request: Request) => Json | Promise<Json>): CustomResource =>
        async (_type, query) => {
            const request = RequestSchema.parse(query)
            reads.push(request)
            return respond(request)
        }

    const data: CustomData = {
        'system/info': read(() => systemInfo),
        programs: read(() => program),
        trackedEntityInstanceFilters: savedLists(
            'trackedEntityInstanceFilters'
        ),
        programStageWorkingLists: savedLists('programStageWorkingLists'),
        'tracker/trackedEntities': read(records),
        'tracker/events': read(records),
        organisationUnits: read(() => ({ organisationUnits: [] })),
        ...resources,
    }

    return { data, reads, writes, lists }
}

/** A saved tracked-entity list the signed-in user may change and delete. */
export const savedTrackedEntityList = (
    id: string,
    displayName: string,
    entityQueryCriteria: JsonObject = {}
) => ({
    id,
    displayName,
    program: { id: fakeProgram.id },
    entityQueryCriteria,
    access: everyAccess,
    publicAccess: '--------',
    externalAccess: false,
    userAccesses: [],
    userGroupAccesses: [],
})

/** app-runtime over the fake server, and the query cache the block reads through. */
export const FakeServerRuntime = ({
    server,
    apiVersion,
    children,
}: {
    server: { data: CustomData }
    apiVersion?: number
    children: ReactNode
}) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: { queries: { retry: false } },
            })
    )
    return (
        <TestRuntime data={server.data} apiVersion={apiVersion}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </TestRuntime>
    )
}
