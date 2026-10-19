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

/** The save mutation. Its `mutationFn` comes from `registerEventFormMutations`. */
export const useSaveEvent = (): UseMutationResult<
    SaveResult,
    Error,
    EventPayload
> =>
    useMutation<SaveResult, Error, EventPayload>({
        mutationKey: eventFormMutationKeys.save,
    })
