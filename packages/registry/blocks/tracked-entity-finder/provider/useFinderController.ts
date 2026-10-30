import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { resourceClientOf, type TrackedEntityFinderClient } from '../api/client'
import { programMetadataQueryOptions } from '../api/queries'
import { useTrackedEntityFinderClient } from '../api/runtimeClient'
import type { FinderPerson } from '../api/search'
import { systemInfoQueryOptions } from '../api/systemInfo'
import { buildProgramModel } from '../rules/programModel'
import type { FieldValue, FormField } from '../rules/types'
import type {
    FinderContextValue,
    FinderStatus,
    FinderSubmission,
} from './context'
import { useSearchResults } from './useSearchResults'

interface Registration {
    key: string
    field: FormField
}

type Registrations = Readonly<Record<string, readonly Registration[]>>

const getFinderStatus = (failed: boolean, ready: boolean): FinderStatus => {
    if (failed) return 'error'
    return ready ? 'ready' : 'loading'
}

export interface FinderControllerOptions {
    program: string
    onSelect: (person: FinderPerson) => void
    client?: TrackedEntityFinderClient
}

/**
 * Holds everything the finder knows: program metadata, field values, form
 * registrations, the last submitted search and the page. Mount it under a
 * `key` of the program, so a new program starts from nothing.
 */
export const useFinderController = ({
    program,
    onSelect,
    client,
}: FinderControllerOptions): FinderContextValue => {
    const runtimeClient = useTrackedEntityFinderClient()
    const resourceClient = useMemo(
        () => resourceClientOf(client ?? runtimeClient),
        [client, runtimeClient]
    )
    const metadata = useQuery(
        programMetadataQueryOptions(resourceClient, program)
    )
    const systemInfo = useQuery(systemInfoQueryOptions(resourceClient))
    const model = useMemo(
        () => (metadata.data ? buildProgramModel(metadata.data) : undefined),
        [metadata.data]
    )
    // Dates need the server calendar, so the finder is ready only with both.
    const status = getFinderStatus(
        metadata.isError || systemInfo.isError,
        Boolean(model && systemInfo.data)
    )

    const [values, setValues] = useState<Readonly<Record<string, FieldValue>>>(
        {}
    )
    const [registrations, setRegistrations] = useState<Registrations>({})
    const [submission, setSubmission] = useState<FinderSubmission>()
    const [page, setPage] = useState(1)

    const results = useSearchResults({
        client: resourceClient,
        program,
        model,
        status,
        submission,
        page,
    })

    const onSelectRef = useRef(onSelect)
    onSelectRef.current = onSelect
    const logged = useRef(new Set<string>())

    const setValue = useCallback((id: string, value: FieldValue) => {
        setValues((current) => ({ ...current, [id]: value }))
    }, [])

    const register = useCallback(
        (formId: string, key: string, field: FormField) => {
            setRegistrations((current) => ({
                ...current,
                [formId]: [...(current[formId] ?? []), { key, field }],
            }))
            return () =>
                setRegistrations((current) => {
                    const { [formId]: form = [], ...others } = current
                    const remaining = form.filter((entry) => entry.key !== key)
                    return remaining.length
                        ? { ...others, [formId]: remaining }
                        : others
                })
        },
        []
    )

    const submit = useCallback<FinderContextValue['actions']['submit']>(
        (search) => {
            setSubmission((current) => ({
                search,
                id: (current?.id ?? 0) + 1,
            }))
            setPage(1)
        },
        []
    )

    const select = useCallback(
        (person: FinderPerson) => onSelectRef.current(person),
        []
    )

    const logProblem = useCallback((message: string) => {
        if (!logged.current.has(message)) {
            logged.current.add(message)
            console.error(message)
        }
    }, [])

    const forms = useMemo(
        () =>
            Object.freeze(
                Object.fromEntries(
                    Object.entries(registrations).map(([formId, entries]) => [
                        formId,
                        Object.freeze(entries.map(({ field }) => field)),
                    ])
                )
            ),
        [registrations]
    )
    const fields = useMemo(
        () => Object.freeze(Object.values(forms).flat()),
        [forms]
    )

    const actions = useMemo(
        () => ({ setValue, register, submit, setPage, select, logProblem }),
        [setValue, register, submit, select, logProblem]
    )

    return useMemo(
        () => ({
            state: {
                status,
                model,
                values,
                fields,
                forms,
                submission,
                page,
                results,
            },
            actions,
            meta: { program, client: resourceClient, info: systemInfo.data },
        }),
        [
            status,
            model,
            values,
            fields,
            forms,
            submission,
            page,
            results,
            actions,
            program,
            resourceClient,
            systemInfo.data,
        ]
    )
}
