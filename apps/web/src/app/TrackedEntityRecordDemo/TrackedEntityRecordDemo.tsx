import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { Input } from '@/components/dhis2/ui/input'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    TrackedEntityRecordProvider,
    useTrackedEntityRecord,
    type TrackedEntityRecord,
} from '@/components/tracked-entity-record'
import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { PersonHeader } from './PersonHeader'
import { ProgramViews, type ViewMode } from './ProgramViews'
import { UnavailableNotice } from './UnavailableNotice'

type RecordViewProps = { record: TrackedEntityRecord }

const RecordView = ({ record }: RecordViewProps) => {
    const { actions, meta } = useTrackedEntityRecord()
    const [mode, setMode] = useState<ViewMode>('single')
    const [selected, setSelected] = useState<string>()
    const [refreshError, setRefreshError] = useState<string>()
    const [firstId] = [...record.programs.keys()]
    const selectedId =
        selected !== undefined && record.programs.has(selected)
            ? selected
            : firstId
    const headerProgramId = mode === 'single' ? selectedId : firstId

    const refresh = async () => {
        setRefreshError(undefined)
        try {
            await actions.refresh()
        } catch (cause) {
            setRefreshError(
                cause instanceof Error
                    ? cause.message
                    : i18n.t('The record could not be refreshed.')
            )
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Button variant="outline" onClick={refresh}>
                    {i18n.t('Refresh')}
                </Button>
                {meta.isFetching && (
                    <span
                        data-testid="record-fetching"
                        className="flex items-center gap-2 text-sm"
                    >
                        <Spinner aria-label={i18n.t('Refreshing')} />
                        {i18n.t('Refreshing the record…')}
                    </span>
                )}
            </div>
            {refreshError && (
                <ErrorAlert
                    title={i18n.t('The record could not be refreshed.')}
                >
                    {refreshError}
                </ErrorAlert>
            )}
            <PersonHeader record={record} programId={headerProgramId} />
            <ProgramViews
                record={record}
                selectedId={selectedId}
                onSelect={setSelected}
                mode={mode}
                onModeChange={setMode}
            />
        </div>
    )
}

const RecordScreen = () => {
    const { state } = useTrackedEntityRecord()
    switch (state.status) {
        case 'pending':
            return <Spinner aria-label={i18n.t('Loading the record')} />
        case 'unavailable':
            return (
                <UnavailableNotice
                    message={i18n.t(
                        'This person is not available. They may not exist, or you may not have access.'
                    )}
                />
            )
        case 'error':
            return (
                <ErrorAlert title={i18n.t('The record could not be loaded.')}>
                    <Button variant="outline" onClick={state.retry}>
                        {i18n.t('Try again')}
                    </Button>
                </ErrorAlert>
            )
        case 'ready':
            return <RecordView record={state.record} />
    }
}

const PersonIdForm = () => {
    const [, setSearchParams] = useSearchParams()
    const [id, setId] = useState('')
    return (
        <form
            className="flex max-w-md flex-col gap-2"
            onSubmit={(event) => {
                event.preventDefault()
                if (id.trim()) setSearchParams({ trackedEntity: id.trim() })
            }}
        >
            <label htmlFor="tracked-entity-id" className="text-sm">
                {i18n.t('Tracked entity ID')}
            </label>
            <div className="flex gap-2">
                <Input
                    id="tracked-entity-id"
                    value={id}
                    onChange={(event) => setId(event.target.value)}
                />
                <Button type="submit">{i18n.t('Open')}</Button>
            </div>
        </form>
    )
}

/**
 * `#/tracked-entity-record?trackedEntity=<id>&programs=<id,id>`: one record,
 * several recipe views, all read from the same provider.
 */
export const TrackedEntityRecordDemo = () => {
    const [searchParams] = useSearchParams()
    const trackedEntity = searchParams.get('trackedEntity')
    const programsParameter = searchParams.get('programs')
    const programs = useMemo(
        () =>
            programsParameter
                ? programsParameter.split(',').filter(Boolean)
                : undefined,
        [programsParameter]
    )
    return (
        <main
            data-testid="tracked-entity-record-demo"
            className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col gap-4 bg-[#f3f5f7] p-6"
        >
            <h1 className="m-0 text-xl font-medium">
                {i18n.t('Tracked entity record')}
            </h1>
            {trackedEntity ? (
                <TrackedEntityRecordProvider
                    trackedEntityId={trackedEntity}
                    programs={programs}
                >
                    <RecordScreen />
                </TrackedEntityRecordProvider>
            ) : (
                <PersonIdForm />
            )}
        </main>
    )
}
