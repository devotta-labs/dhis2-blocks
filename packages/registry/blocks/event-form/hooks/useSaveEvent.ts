import { useDataEngine } from '@dhis2/app-runtime'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { programRulesQueryKeys } from '@/components/program-rules'
import { reportIn } from '../lib/importReport'
import type { ImportReport } from '../lib/importReport'
import { IMPORT_PARAMS } from '../lib/payload'
import type { eventPayload } from '../lib/payload'

export type SaveResult =
    | { ok: true }
    | { ok: false; reason?: string; report?: ImportReport }

/** Sends one event in a tracker import. A refused import is an error whose details are the import report. */
export const useSaveEvent = (eventId: string, enrollmentId?: string) => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()
    return async (
        payload: ReturnType<typeof eventPayload>
    ): Promise<SaveResult> => {
        try {
            const report = reportIn(
                z
                    .json()
                    .catch(null)
                    .parse(
                        await engine.mutate({
                            resource: 'tracker',
                            type: 'create',
                            params: IMPORT_PARAMS,
                            data: payload,
                        })
                    )
            )
            if (report?.status === 'ERROR') {
                return { ok: false, report }
            }
        } catch (error) {
            const report =
                error instanceof Error && 'details' in error
                    ? reportIn(z.json().catch(null).parse(error.details))
                    : undefined
            return report === undefined
                ? {
                      ok: false,
                      reason:
                          error instanceof Error ? error.message : undefined,
                  }
                : { ok: false, report }
        }
        void queryClient.invalidateQueries({
            queryKey: ['event-form', 'event', eventId],
        })
        // So the next event opened is not evaluated against this one as it was.
        if (enrollmentId !== undefined) {
            void queryClient.invalidateQueries({
                queryKey: programRulesQueryKeys.enrollment(enrollmentId),
            })
        }
        return { ok: true }
    }
}
