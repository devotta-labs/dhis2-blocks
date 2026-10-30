import { useInfiniteQuery } from '@tanstack/react-query'
import { useConfig } from '@dhis2/app-runtime'
import {
    Timeline,
    TimelineEmpty,
    TimelineError,
    TimelineFeed,
    TimelineLoading,
    TimelineNotices,
    TimelineShowMore,
    type TimelineNotice,
    type TimelineStatus,
} from '@/components/timeline'
import {
    TimelineHistoryEntry,
    eventEntry,
    timelineKeys,
    useOrgUnitNames,
    useProgramInfo,
    useSystemCalendar,
    useTimelineClient,
    type HistoryEntryData,
} from '@/components/timeline-dhis2'
import { Result } from 'better-result'
import React, { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { OpenInCapture } from './CaseHistoryDemo'
import { ParamsForm } from './ParamsForm'
import { fetchUpdatedToday, serverToday } from './updatedToday'

// Capture's demo database: Ngelehun CHC, where the e2e seed records its events.
const DEFAULT_ORG_UNIT = 'DiszpKrYNg8'
const DEFAULT_PROGRAM = 'TlE2ePrg001'
const PAGE_SIZE = 50

/**
 * A host's own server-paged feed: `useInfiniteQuery` pages the events, the
 * block's hooks name them, and the same entry parts render them.
 */
const UpdatedToday = ({
    program,
    orgUnit,
}: {
    program: string
    orgUnit: string
}) => {
    const client = useTimelineClient()
    const calendar = useSystemCalendar()
    const { systemInfo } = useConfig()
    const today = serverToday(systemInfo?.serverTimeZoneId)
    const pages = useInfiniteQuery({
        queryKey: [
            ...timelineKeys.root,
            'updatedToday',
            program,
            orgUnit,
            today,
        ],
        initialPageParam: 1,
        getNextPageParam: (last: { nextPage?: number }) => last.nextPage,
        queryFn: async ({ pageParam, signal }) => {
            const result = await fetchUpdatedToday(
                client,
                {
                    program,
                    orgUnit,
                    today,
                    page: pageParam,
                    pageSize: PAGE_SIZE,
                },
                signal
            )
            if (Result.isError(result)) {
                throw result.error
            }
            return result.value
        },
    })
    // An event saved while paging moves to the top, so the next page repeats
    // the one it pushed down: keep each event once.
    // shortcut: the event pushed off page one shows only after a refetch;
    // page by an updatedAt cursor if a host needs it at once.
    const events = useMemo(
        () => [
            ...new Map(
                (pages.data?.pages ?? [])
                    .flatMap((page) => page.events)
                    .map((event) => [event.event, event])
            ).values(),
        ],
        [pages.data]
    )
    const info = useProgramInfo([program])
    const orgUnitIds = useMemo(
        () =>
            [...new Set(events.flatMap((event) => event.orgUnit ?? []))].sort(),
        [events]
    )
    const names = useOrgUnitNames(pages.data ? orgUnitIds : undefined)
    const entries = useMemo(
        () =>
            events.map((event) =>
                eventEntry(event, {
                    timeField: 'updatedAt',
                    today,
                    program: info.programs.get(program),
                    orgUnitNames: names.names,
                })
            ),
        [events, today, info.programs, program, names.names]
    )
    // A failed later page is a notice: the pages already loaded stay.
    let status: TimelineStatus = 'success'
    if (pages.isError && pages.data === undefined) {
        status = 'error'
    } else if (
        pages.isPending ||
        info.pending ||
        // A later page's org units keep the known names on show.
        (names.pending && names.names.size === 0)
    ) {
        status = 'pending'
    }
    const notices: TimelineNotice[] = [
        ...(pages.isFetchNextPageError
            ? [
                  {
                      id: 'next-page-failed',
                      tone: 'error' as const,
                      message: i18n.t("More events couldn't load."),
                      retry: () => void pages.fetchNextPage(),
                  },
              ]
            : []),
        ...info.notices,
        ...names.notices,
    ]
    return (
        <Timeline<HistoryEntryData>
            entries={status === 'pending' ? [] : entries}
            status={status}
            calendar={calendar}
            locale={i18n.language}
        >
            <TimelineLoading />
            <TimelineError onRetry={() => void pages.refetch()} />
            <TimelineNotices notices={notices} />
            <TimelineEmpty>
                {i18n.t('No events were updated today.')}
            </TimelineEmpty>
            <TimelineFeed<HistoryEntryData>>
                {(entry) => (
                    <TimelineHistoryEntry
                        entry={entry}
                        eventActions={<OpenInCapture />}
                    />
                )}
            </TimelineFeed>
            <TimelineShowMore
                hasMore={pages.hasNextPage}
                loading={pages.isFetchingNextPage}
                onShowMore={() => void pages.fetchNextPage()}
            />
        </Timeline>
    )
}

export const UpdatedTodayDemo = () => {
    const [params] = useSearchParams()
    // `||`: a cleared field submits an empty value.
    const program = params.get('program') || DEFAULT_PROGRAM
    const orgUnit = params.get('orgUnit') || DEFAULT_ORG_UNIT
    return (
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
            <header className="flex flex-col gap-3">
                <h1 className="m-0 text-xl font-medium">
                    {i18n.t('Events updated today')}
                </h1>
                <ParamsForm
                    submitLabel={i18n.t('Show events')}
                    fields={[
                        {
                            name: 'program',
                            label: i18n.t('Program ID'),
                            value: program,
                        },
                        {
                            name: 'orgUnit',
                            label: i18n.t('Organisation unit ID'),
                            value: orgUnit,
                        },
                    ]}
                />
            </header>
            <UpdatedToday
                key={`${program}:${orgUnit}`}
                program={program}
                orgUnit={orgUnit}
            />
        </main>
    )
}
