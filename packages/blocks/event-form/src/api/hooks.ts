import { useQuery } from '@tanstack/react-query'
import {
    captureOrgUnitsQueryOptions,
    stageMetadataQueryOptions,
    systemCalendarQueryOptions,
    trackerEventQueryOptions,
} from './queries'
import { useEventFormClient } from './runtimeClient'

export const useStageMetadata = (programId: string, stageId: string) =>
    useQuery(
        stageMetadataQueryOptions(useEventFormClient(), programId, stageId)
    )

export const useTrackerEvent = (eventId: string | undefined) =>
    useQuery(trackerEventQueryOptions(useEventFormClient(), eventId))

export const useSystemCalendar = () =>
    useQuery(systemCalendarQueryOptions(useEventFormClient()))

/** The organisation units the user captures data for. */
export const useCaptureOrgUnits = () =>
    useQuery(captureOrgUnitsQueryOptions(useEventFormClient()))
