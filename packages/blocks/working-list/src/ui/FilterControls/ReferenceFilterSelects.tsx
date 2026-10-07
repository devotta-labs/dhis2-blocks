import {
    Box,
    Field,
    MultiSelect,
    MultiSelectOption,
    OrganisationUnitTree,
} from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import React, { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import type { WorkingListClient } from '../../api/client'
import { useWorkingListText } from '../WorkingListText'

const UserReferenceSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        username: z.string().optional(),
    })
    .passthrough()

const UsersResponseSchema = z
    .object({ users: z.array(UserReferenceSchema) })
    .passthrough()

const OrganisationUnitReferenceSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().optional(),
        path: z.string().min(1),
    })
    .passthrough()

const OrganisationUnitRootsSchema = z
    .object({ organisationUnits: z.array(OrganisationUnitReferenceSchema) })
    .passthrough()

export const UserFilterSelect = ({
    client,
    selected,
    onChange,
}: {
    client: WorkingListClient
    selected: string[]
    onChange: (selected: string[]) => void
}) => {
    const i18n = { t: useWorkingListText() }
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const searchTimeout = useRef<number>()

    // EFFECT: window.setTimeout -- Cancel the event-scheduled user search timer when this field unmounts.
    useEffect(() => {
        return () => window.clearTimeout(searchTimeout.current)
    }, [])

    const usersQuery = useQuery({
        queryKey: ['working-list', 'users', debouncedSearch],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'users',
                    params: (() => {
                        const params = {
                            fields: 'id,displayName,username',
                            pageSize: 50,
                        }

                        return debouncedSearch
                            ? { ...params, query: debouncedSearch }
                            : params
                    })(),
                },
                UsersResponseSchema,
                signal
            ),
        placeholderData: (previous) => previous,
        staleTime: 60_000,
    })

    const users = usersQuery.data?.users ?? []
    const knownIds = new Set(users.map((user) => user.id))

    return (
        <div
            className="[&>*+*]:mt-[12px]"
            data-testid="assignee-user-selector"
            onChangeCapture={(event) => {
                const target = event.target

                if (
                    target instanceof HTMLInputElement &&
                    target.name === 'filter'
                ) {
                    const nextSearch = target.value.trim()
                    window.clearTimeout(searchTimeout.current)
                    searchTimeout.current = window.setTimeout(
                        () => setDebouncedSearch(nextSearch),
                        250
                    )
                }
            }}
        >
            <Field dataTest="assignee-users" label={i18n.t('Users')}>
                <Box minWidth="100px">
                    <MultiSelect
                        collapseSelectionAfter={1}
                        dense
                        filterable
                        filterPlaceholder={i18n.t('Search users')}
                        loading={usersQuery.isPending || usersQuery.isFetching}
                        selected={selected}
                        noMatchText={i18n.t('No users match')}
                        onChange={({ selected: next }) => onChange(next)}
                    >
                        {users.map((user) => (
                            <MultiSelectOption
                                key={user.id}
                                value={user.id}
                                label={
                                    user.username
                                        ? `${user.displayName} (${user.username})`
                                        : user.displayName
                                }
                            />
                        ))}
                        {selected
                            .filter((id) => !knownIds.has(id))
                            .map((id) => (
                                <MultiSelectOption
                                    key={id}
                                    value={id}
                                    label={id}
                                />
                            ))}
                    </MultiSelect>
                </Box>
            </Field>
            {usersQuery.error && (
                <p role="alert">
                    {i18n.t('Could not load users')}: {String(usersQuery.error)}
                </p>
            )}
        </div>
    )
}

export const OrganisationUnitFilterSelect = ({
    client,
    selectedId,
    onChange,
}: {
    client: WorkingListClient
    selectedId: string
    onChange: (id: string) => void
}) => {
    const i18n = { t: useWorkingListText() }

    const rootsQuery = useQuery({
        queryKey: ['working-list', 'filter-organisation-unit-roots'],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'me',
                    params: {
                        fields: 'organisationUnits[id,displayName,path]',
                    },
                },
                OrganisationUnitRootsSchema,
                signal
            ),
        staleTime: 60 * 60_000,
    })

    const selectedQuery = useQuery({
        queryKey: ['working-list', 'filter-organisation-unit', selectedId],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'organisationUnits',
                    id: selectedId,
                    params: { fields: 'id,displayName,path' },
                },
                OrganisationUnitReferenceSchema,
                signal
            ),
        enabled: Boolean(selectedId),
        staleTime: 60 * 60_000,
    })

    const roots = rootsQuery.data?.organisationUnits ?? []

    if (rootsQuery.error || selectedQuery.error) {
        return <p role="alert">{i18n.t('Could not load organisation units')}</p>
    }

    return (
        <div
            className="max-h-[min(52vh,520px)] overflow-auto rounded-[3px] bg-[#fff] p-[8px] [border:1px_solid_#d5dde5] [&>*+*]:mt-[12px]"
            data-testid="filter-organisation-unit-tree"
            aria-busy={rootsQuery.isPending || selectedQuery.isPending}
        >
            {rootsQuery.isPending ? (
                <p>{i18n.t('Loading organisation units…')}</p>
            ) : (
                <OrganisationUnitTree
                    roots={roots.map((root) => root.id)}
                    selected={
                        selectedQuery.data ? [selectedQuery.data.path] : []
                    }
                    singleSelection
                    initiallyExpanded={roots.map((root) => root.path)}
                    onChange={(payload) => {
                        if (payload.checked) {
                            onChange(payload.id)
                        }
                    }}
                />
            )}
        </div>
    )
}
