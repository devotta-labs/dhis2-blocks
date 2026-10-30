import type { DataEngineLike } from '@/components/tracked-entity-finder'
import type { LabAttribute, LabConfig } from './labConfig'

type EngineQuery = Parameters<DataEngineLike['query']>[0]
type EngineResult = Awaited<ReturnType<DataEngineLike['query']>>
type EngineValue = EngineResult[string]
type Request = EngineQuery[string]

export interface RequestLogEntry {
    id: number
    at: string
    resource: string
    params?: Request['params']
    ms?: number
    outcome: 'pending' | 'ok' | 'failed' | 'aborted'
    detail?: string
}

const FIRST_NAMES = ['Amina', 'Fatmata', 'Mohamed', 'Isata', 'Abu', 'Mariama']
const LAST_NAMES = ['Bangura', 'Kamara', 'Sesay', 'Conteh', 'Koroma', 'Turay']

const isoDate = (index: number) =>
    `${1960 + ((index * 7) % 60)}-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + ((index * 3) % 28)).padStart(2, '0')}`

/** A value for person `index` that reads like what the attribute holds. */
const sampleValue = (attribute: LabAttribute, index: number): string => {
    if (attribute.options?.length) {
        return attribute.options[index % attribute.options.length].code
    }
    const label = attribute.label.toLowerCase()
    switch (attribute.valueType) {
        case 'BOOLEAN':
            return index % 2 === 0 ? 'true' : 'false'
        case 'TRUE_ONLY':
            return index % 3 === 0 ? 'true' : ''
        case 'NUMBER':
        case 'PERCENTAGE':
            return String(40 + ((index * 13) % 50) + 0.5)
        case 'INTEGER':
        case 'INTEGER_POSITIVE':
        case 'INTEGER_ZERO_OR_POSITIVE':
            return String((index * 7) % 90)
        case 'INTEGER_NEGATIVE':
            return String(-1 - (index % 9))
        case 'DATE':
        case 'AGE':
            return isoDate(index)
        case 'DATETIME':
            return `${isoDate(index + 40)}T08:${String(index % 60).padStart(2, '0')}:00.000`
        case 'IMAGE':
        case 'FILE_RESOURCE':
            return `fileResource${index}`
        case 'COORDINATE':
            return '[-11.78,8.43]'
        default:
            if (attribute.unique) {
                return `SL-${String(1000 + index)}-${index % 90}`
            }
            if (label.includes('first') || label === 'name') {
                return FIRST_NAMES[index % FIRST_NAMES.length]
            }
            if (label.includes('last')) {
                return LAST_NAMES[(index * 5) % LAST_NAMES.length]
            }
            return `${attribute.label} ${index + 1}`
    }
}

/** The raw `GET programs/<uid>` response for the lab program. */
const programResponse = ({ program }: LabConfig): EngineValue => ({
    displayName: program.name,
    minAttributesRequiredToSearch: program.minAttributes,
    maxTeiCountToReturn: program.maxResults,
    trackedEntityType: { id: 'labPerson' },
    programTrackedEntityAttributes: program.attributes.map(
        (attribute, sortOrder) => ({
            searchable: attribute.searchable,
            displayInList: attribute.displayInList,
            sortOrder,
            trackedEntityAttribute: {
                id: attribute.id,
                displayName: attribute.label,
                valueType: attribute.valueType,
                unique: attribute.unique,
                optionSet: attribute.options
                    ? {
                          options: attribute.options.map(({ code, name }) => ({
                              code,
                              displayName: name,
                          })),
                      }
                    : null,
                preferredSearchOperator: attribute.preferred ?? null,
                blockedSearchOperators: attribute.blocked.map((operator) =>
                    operator.toUpperCase()
                ),
                minCharactersToSearch: attribute.minCharacters,
            },
        })
    ),
})

const searchResponse = (
    { program, server }: LabConfig,
    request: Request
): EngineValue => {
    const page = Number(request.params?.page ?? 1)
    const pageSize = Number(request.params?.pageSize ?? 10)
    const first = (page - 1) * pageSize
    const count = Math.max(0, Math.min(pageSize, server.matches - first))
    const trackedEntities = Array.from({ length: count }, (_, offset) => {
        const index = first + offset
        return {
            trackedEntity: `labTe${String(index).padStart(4, '0')}`,
            trackedEntityType: 'labPerson',
            orgUnit: 'labOrgUnit',
            programOwners: [{ orgUnit: 'labOwner', program: 'labProgram' }],
            attributes: program.attributes.map((attribute) => ({
                attribute: attribute.id,
                value: sampleValue(attribute, index),
            })),
        }
    })
    return server.reportsTotal
        ? { trackedEntities, pager: { page, pageSize, total: server.matches } }
        : { trackedEntities, pager: { page, pageSize } }
}

const httpError = (status: number, message: string) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status, message },
    })

const wait = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort)
            resolve()
        }, ms)
        signal?.addEventListener('abort', abort, { once: true })
    })

const never = () => new Promise<never>(() => {})

const answer = async (
    config: LabConfig,
    request: Request,
    signal?: AbortSignal
): Promise<EngineValue> => {
    const { server } = config
    switch (request.resource) {
        case 'programs':
            await wait(Math.min(server.latency, 800), signal)
            if (server.program === 'never') return never()
            if (server.program === 'fails') {
                throw httpError(404, 'Program not found')
            }
            return programResponse(config)
        case 'system/info':
            if (server.systemInfo === 'never') return never()
            if (server.systemInfo === 'fails') {
                throw httpError(500, 'System info failed')
            }
            return { calendar: server.calendar, dateFormat: server.dateFormat }
        default:
            await wait(server.latency, signal)
            switch (server.search) {
                case 'never':
                    return never()
                case 'conflict':
                    throw httpError(
                        409,
                        'maxTeiCountReached: the search matched more than the program allows'
                    )
                case 'bad-request':
                    throw httpError(400, 'Invalid filter')
                case 'server-error':
                    throw httpError(500, 'Internal server error')
                default:
                    return searchResponse(config, request)
            }
    }
}

/** Wraps an engine so each request it runs lands in the log. */
export const loggingEngine = (
    engine: DataEngineLike,
    log: (update: (entries: RequestLogEntry[]) => RequestLogEntry[]) => void
): DataEngineLike => {
    let next = 0
    return {
        query: async (query, options) => {
            const [request] = Object.values(query)
            const id = ++next
            const started = performance.now()
            const settle = (
                outcome: RequestLogEntry['outcome'],
                detail?: string
            ) =>
                log((entries) =>
                    entries.map((entry) =>
                        entry.id === id
                            ? {
                                  ...entry,
                                  outcome,
                                  detail,
                                  ms: Math.round(performance.now() - started),
                              }
                            : entry
                    )
                )
            log((entries) =>
                [
                    {
                        id,
                        at: new Date().toLocaleTimeString(),
                        resource: request.resource,
                        params: request.params,
                        outcome: 'pending' as const,
                    },
                    ...entries,
                ].slice(0, 100)
            )
            try {
                const result = await engine.query(query, options)
                settle('ok')
                return result
            } catch (error) {
                settle(
                    // app-runtime reports a cancelled request as a network error.
                    options?.signal?.aborted ||
                        (error instanceof Error && error.name === 'AbortError')
                        ? 'aborted'
                        : 'failed',
                    error instanceof Error ? error.message : 'Request failed'
                )
                throw error
            }
        },
    }
}

/** A data engine that answers as the lab config says. */
export const labEngine = (config: LabConfig): DataEngineLike => ({
    query: async (query, options) =>
        Object.fromEntries(
            await Promise.all(
                Object.entries(query).map(async ([key, request]) => [
                    key,
                    await answer(config, request, options?.signal),
                ])
            )
        ),
})
