import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/dhis2/ui/card'
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'
import {
    currentEnrollment,
    enrollmentAllowance,
    type EnrollmentAllowanceReason,
    type ProgramRecord,
    type TrackedEntityRecord,
} from '@/components/tracked-entity-record'
import React, { useState } from 'react'
import i18n from '../../i18n'
import { AddNote, EnrollmentNotes } from './AddNote'
import { day } from './day'
import { LatestValues } from './LatestValues'
import { UnavailableNotice } from './UnavailableNotice'
import { Visits } from './Visits'

export type ViewMode = 'single' | 'side-by-side'

type ProgramViewsProps = {
    record: TrackedEntityRecord
    selectedId?: string
    onSelect: (programId: string) => void
    mode: ViewMode
    onModeChange: (mode: ViewMode) => void
}
type ProgramViewProps = { record: TrackedEntityRecord; entry: ProgramRecord }
type AllowanceProps = ProgramViewProps

const programLabel = (entry: ProgramRecord) =>
    entry.status === 'unavailable' || entry.status === 'error'
        ? entry.programId
        : entry.program.name

const allowanceReasons = () =>
    ({
        unavailable: i18n.t('Enrollment is not available in this program.'),
        'no-write-access': i18n.t(
            'You cannot enroll this person in this program.'
        ),
        'active-enrollment-exists': i18n.t(
            'This person already has an active enrollment in this program.'
        ),
        'only-enroll-once': i18n.t(
            'This program allows one enrollment per person, so this person can only be enrolled once.'
        ),
    }) satisfies Record<EnrollmentAllowanceReason, string>

/** Recipe: whether "Enroll" would be offered, from `enrollmentAllowance`. */
const Allowance = ({ record, entry }: AllowanceProps) => {
    const allowance = enrollmentAllowance(record, entry)
    return (
        <p data-testid="enrollment-allowance" className="m-0 text-sm">
            {allowance.allowed
                ? i18n.t('This person can be enrolled in this program.')
                : allowanceReasons()[allowance.reason]}
        </p>
    )
}

type EnrolledProgramProps = {
    record: TrackedEntityRecord
    entry: Extract<ProgramRecord, { status: 'enrolled' }>
}

const EnrolledProgram = ({ record, entry }: EnrolledProgramProps) => {
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>()
    const enrollment = currentEnrollment(entry, selectedEnrollmentId)
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{entry.program.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <Allowance record={record} entry={entry} />
                    {entry.enrollments.length > 1 && (
                        <ToggleGroup
                            aria-label={i18n.t('Enrollment')}
                            value={enrollment ? [enrollment.id] : []}
                            onValueChange={([next]) =>
                                next && setSelectedEnrollmentId(next)
                            }
                        >
                            {entry.enrollments.map((candidate) => (
                                <ToggleGroupItem
                                    key={candidate.id}
                                    value={candidate.id}
                                    variant="outline"
                                    data-testid={`enrollment-${candidate.id}`}
                                >
                                    {day(candidate.enrolledAt)} ·{' '}
                                    {candidate.status}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    )}
                    {!enrollment && (
                        <p className="m-0 text-sm">
                            {i18n.t('Choose an enrollment to see its details.')}
                        </p>
                    )}
                </CardContent>
            </Card>
            {enrollment && (
                <>
                    <LatestValues
                        program={entry.program}
                        enrollment={enrollment}
                    />
                    <Visits program={entry.program} enrollment={enrollment} />
                    <EnrollmentNotes enrollment={enrollment} />
                    {entry.access.canWrite ? (
                        <AddNote
                            program={entry.program}
                            enrollment={enrollment}
                        />
                    ) : (
                        <p
                            data-testid="read-only-notice"
                            className="m-0 text-sm"
                        >
                            {i18n.t(
                                'This enrollment is read-only because the person is inactive or you only have read access.'
                            )}
                        </p>
                    )}
                </>
            )}
        </>
    )
}

const ProgramView = ({ record, entry }: ProgramViewProps) => {
    const id =
        entry.status === 'unavailable' || entry.status === 'error'
            ? entry.programId
            : entry.program.id
    return (
        <section
            data-testid={`program-view-${id}`}
            aria-label={programLabel(entry)}
            className="flex min-w-0 flex-1 flex-col gap-4"
        >
            {entry.status === 'unavailable' && <UnavailableNotice />}
            {entry.status === 'error' && (
                <ErrorAlert title={i18n.t('This program could not be loaded.')}>
                    <Button variant="outline" onClick={entry.retry}>
                        {i18n.t('Try again')}
                    </Button>
                </ErrorAlert>
            )}
            {entry.status === 'not-enrolled' && (
                <Card>
                    <CardHeader>
                        <CardTitle>{entry.program.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <p className="m-0 text-sm">
                            {i18n.t('Not enrolled in this program.')}
                        </p>
                        <Allowance record={record} entry={entry} />
                    </CardContent>
                </Card>
            )}
            {entry.status === 'enrolled' && (
                <EnrolledProgram record={record} entry={entry} />
            )}
        </section>
    )
}

/** Recipe: one program at a time (switcher) or two at once, from one record. */
export const ProgramViews = ({
    record,
    selectedId,
    onSelect,
    mode,
    onModeChange,
}: ProgramViewsProps) => {
    const entries = [...record.programs.entries()]
    const shown =
        mode === 'single'
            ? entries.filter(([id]) => id === selectedId)
            : entries.slice(0, 2)
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
                <ToggleGroup
                    aria-label={i18n.t('Layout')}
                    value={[mode]}
                    onValueChange={([next]) => next && onModeChange(next)}
                >
                    <ToggleGroupItem
                        value="single"
                        variant="outline"
                        data-testid="view-mode-single"
                    >
                        {i18n.t('One program')}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        value="side-by-side"
                        variant="outline"
                        data-testid="view-mode-side-by-side"
                    >
                        {i18n.t('Side by side')}
                    </ToggleGroupItem>
                </ToggleGroup>
                {mode === 'single' && (
                    <ToggleGroup
                        aria-label={i18n.t('Program')}
                        data-testid="program-switcher"
                        value={selectedId ? [selectedId] : []}
                        onValueChange={([next]) => next && onSelect(next)}
                    >
                        {entries.map(([id, entry]) => (
                            <ToggleGroupItem
                                key={id}
                                value={id}
                                variant="outline"
                            >
                                {programLabel(entry)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                )}
            </div>
            {entries.length === 0 && (
                <p className="m-0 text-sm">
                    {i18n.t('This person has no programs to show.')}
                </p>
            )}
            <div className="flex flex-wrap gap-4 [&>*]:min-w-[320px]">
                {shown.map(([id, entry]) => (
                    <ProgramView key={id} record={record} entry={entry} />
                ))}
            </div>
        </div>
    )
}
