import { Button } from '@/components/dhis2/ui/button'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import React, { useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { EnrollmentProfile } from './EnrollmentProfile'
import { PersonPanel } from './PersonPanel'

const TRACKED_ENTITY_PARAMETER = 'trackedEntityId'
const PROGRAM_PARAMETER = 'programId'

export const ProfileWidgetShowcase = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const trackedEntityId = searchParams.get(TRACKED_ENTITY_PARAMETER) ?? ''
    const programId = searchParams.get(PROGRAM_PARAMETER) ?? ''
    const [deletedTrackedEntityId, setDeletedTrackedEntityId] = useState<
        string | null
    >(null)
    const trackedEntityInputId = useId()
    const programInputId = useId()

    const handleDeleted = () => {
        setDeletedTrackedEntityId(trackedEntityId)
        setSearchParams(programId ? { [PROGRAM_PARAMETER]: programId } : {}, {
            replace: true,
        })
    }

    return (
        <main
            className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-6"
            data-testid="profile-widget-showcase"
        >
            <h1 className="m-0 text-xl font-medium text-dhis2-grey-900">
                {i18n.t('Profile widget')}
            </h1>
            <form
                key={`form:${trackedEntityId}:${programId}`}
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget)
                    const nextTrackedEntityId = String(
                        form.get(TRACKED_ENTITY_PARAMETER) ?? ''
                    ).trim()
                    const nextProgramId = String(
                        form.get(PROGRAM_PARAMETER) ?? ''
                    ).trim()
                    const next = new URLSearchParams()
                    if (nextTrackedEntityId) {
                        next.set(TRACKED_ENTITY_PARAMETER, nextTrackedEntityId)
                    }
                    if (nextProgramId) {
                        next.set(PROGRAM_PARAMETER, nextProgramId)
                    }
                    setDeletedTrackedEntityId(null)
                    setSearchParams(next)
                }}
            >
                <div className="flex flex-col gap-1">
                    <Label htmlFor={trackedEntityInputId}>
                        {i18n.t('Tracked entity ID')}
                    </Label>
                    <Input
                        id={trackedEntityInputId}
                        name={TRACKED_ENTITY_PARAMETER}
                        defaultValue={trackedEntityId}
                        className="w-48"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={programInputId}>
                        {i18n.t('Program ID (optional)')}
                    </Label>
                    <Input
                        id={programInputId}
                        name={PROGRAM_PARAMETER}
                        defaultValue={programId}
                        className="w-48"
                    />
                </div>
                <Button type="submit" variant="secondary">
                    {i18n.t('Show profile')}
                </Button>
            </form>

            {deletedTrackedEntityId && (
                <p role="status" className="m-0 text-sm text-dhis2-grey-800">
                    {i18n.t('Deleted tracked entity {{trackedEntityId}}', {
                        trackedEntityId: deletedTrackedEntityId,
                    })}
                </p>
            )}

            {trackedEntityId === '' ? (
                <p className="m-0 text-sm text-dhis2-grey-700">
                    {i18n.t(
                        'Enter a tracked entity ID to show its profile. Add a program ID to scope it to an enrollment.'
                    )}
                </p>
            ) : programId ? (
                <EnrollmentProfile
                    key={`${trackedEntityId}:${programId}`}
                    trackedEntityId={trackedEntityId}
                    programId={programId}
                    onDeleted={handleDeleted}
                />
            ) : (
                <PersonPanel
                    key={trackedEntityId}
                    trackedEntityId={trackedEntityId}
                    onDeleted={handleDeleted}
                />
            )}
        </main>
    )
}
