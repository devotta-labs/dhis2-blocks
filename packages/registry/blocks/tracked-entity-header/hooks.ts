import { useCallback } from 'react'
import {
    isForbidden,
    isNotFound,
    useAttributeMetadata,
    useTrackedEntity,
} from './api/queries'
import type { AttributeMetadata, TrackedEntityRecord } from './api/types'
import { useHeaderContext } from './provider/context'

export type TrackedEntityHeaderState =
    | {
          status: 'loading' | 'failed' | 'restricted' | 'not-found'
          retry(): void
      }
    | {
          status: 'ready'
          retry(): void
          trackedEntity: TrackedEntityRecord
          metadata: AttributeMetadata
      }

/**
 * The provider's two requests. Every part and hook calls them: React Query
 * makes each request once and shares the answer.
 */
const useHeaderQueries = () => {
    const { trackedEntity, program } = useHeaderContext()
    const entity = useTrackedEntity({ trackedEntity, program })
    // Without a program, the tracked entity type says which attributes there are.
    const type = entity.data?.type
    const typeSubject =
        type === undefined ? undefined : { trackedEntityType: type }
    const subject = program === undefined ? typeSubject : { program }
    // Without a tracked entity id nothing is asked for, the program's attributes neither.
    const metadata = useAttributeMetadata(
        trackedEntity === '' ? undefined : subject
    )
    return { entity, metadata }
}

/** A refetch that fails keeps what loaded, unless access was withdrawn. */
const blocking = (error: Error | null, loaded: boolean) =>
    error && (!loaded || isForbidden(error)) ? error : null

/** The provider's tracked entity and attribute metadata, or why there are none yet. */
export const useTrackedEntityHeader = (): TrackedEntityHeaderState => {
    const { entity, metadata } = useHeaderQueries()

    const { refetch: refetchEntity } = entity
    const { refetch: refetchMetadata } = metadata
    const entityFailed = entity.isError
    const metadataFailed = metadata.isError
    const retry = useCallback(() => {
        if (entityFailed) {
            void refetchEntity()
        }
        if (metadataFailed) {
            void refetchMetadata()
        }
    }, [entityFailed, metadataFailed, refetchEntity, refetchMetadata])

    const entityError = blocking(entity.error, entity.data !== undefined)
    const metadataError = blocking(metadata.error, metadata.data !== undefined)
    const errors = [entityError, metadataError].filter(
        (error) => error !== null
    )
    // Restricted outranks failed: the record can't be shown however the other request went.
    if (errors.some(isForbidden)) {
        return { status: 'restricted', retry }
    }
    // Asked for again without the program and still missing: there is no such record.
    if (entityError && isNotFound(entityError)) {
        return { status: 'not-found', retry }
    }
    if (errors.length > 0) {
        return { status: 'failed', retry }
    }
    if (!entity.data || !metadata.data) {
        return { status: 'loading', retry }
    }
    return {
        status: 'ready',
        retry,
        trackedEntity: entity.data,
        metadata: metadata.data,
    }
}

/** The program's name once its metadata loads, even when the tracked entity request is refused. */
export const useProgramName = (): string | undefined => {
    const { metadata } = useHeaderQueries()
    return metadata.data?.programName
}
