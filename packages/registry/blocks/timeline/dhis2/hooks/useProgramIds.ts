import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { TimelineNotice, TimelineStatus } from '../../core/types'
import { refetchOf, statusOf, trackedEntityQuery } from '../queryState'
import { useTimelineClient } from './useTimelineClient'

export interface ProgramIds {
    /** Undefined until the enrollments have answered. */
    ids?: string[]
    status: TimelineStatus
    isFetching: boolean
    refetch(): void
    notices: TimelineNotice[]
}

const sortedUnique = (ids: Iterable<string>) => [...new Set(ids)].sort()

/**
 * The programs a history covers: `programs` when given, otherwise every
 * program the tracked entity is enrolled in (one request, shared with the
 * enrollments).
 */
export const useProgramIds = ({
    trackedEntity,
    programs,
}: {
    trackedEntity: string
    programs?: ReadonlyArray<string>
}): ProgramIds => {
    const client = useTimelineClient()
    const given = programs !== undefined
    const entity = useQuery({
        ...trackedEntityQuery(client, trackedEntity),
        enabled: !given,
    })
    const programKey = programs?.join(',')
    const enrolledKey = entity.data?.enrollments
        .map((enrollment) => enrollment.program)
        .join(',')
    const ids = useMemo(() => {
        const key = programKey ?? enrolledKey
        if (key === undefined) {
            return undefined
        }
        return sortedUnique(key === '' ? [] : key.split(','))
    }, [programKey, enrolledKey])
    if (given) {
        return {
            ids,
            status: 'success',
            isFetching: false,
            refetch: () => undefined,
            notices: [],
        }
    }
    const status = statusOf(entity)
    return {
        ids,
        status,
        isFetching: entity.isFetching,
        refetch: refetchOf(entity),
        notices:
            status === 'error'
                ? [
                      {
                          id: 'enrollments-failed',
                          tone: 'error',
                          message: i18n.t("The enrollments couldn't load."),
                          retry: refetchOf(entity),
                      },
                  ]
                : [],
    }
}
