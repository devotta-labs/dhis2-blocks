import {
    useMutation,
    type QueryClient,
    type UseMutationResult,
} from '@tanstack/react-query'
import type { Result } from 'better-result'
import type { EventPayload } from './payload'
import type { EventWriter, SaveError, SaveOutcome } from './writer'

export const eventFormMutationKeys = {
    save: ['event-form', 'save'] as const,
}

type SaveResult = Result<{ outcome: SaveOutcome }, SaveError>

/** Registers the writer as the save mutation's default, so a persisted mutation can resume after a reload. */
export const registerEventFormMutations = (
    queryClient: QueryClient,
    writer: EventWriter
) => {
    queryClient.setMutationDefaults(eventFormMutationKeys.save, {
        mutationFn: writer,
    })
}

/**
 * The save mutation. Without a `writer` its `mutationFn` is the default from
 * `registerEventFormMutations`. A `writer` serves this observer only: it never becomes the
 * QueryClient's default, so other forms and a host-registered writer are unaffected.
 */
export const useSaveEvent = (
    writer?: EventWriter
): UseMutationResult<SaveResult, Error, EventPayload> =>
    useMutation<SaveResult, Error, EventPayload>({
        mutationKey: eventFormMutationKeys.save,
        ...(writer !== undefined && { mutationFn: writer }),
    })
