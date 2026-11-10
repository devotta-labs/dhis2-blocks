import type { DataRecord, EventRecord } from '../model/types'

const MAX_BATCH_SIZE = 2

export const evaluateEventBatch = <T>(
    rowIds: ReadonlyArray<string>,
    start: number,
    record: EventRecord,
    records: ReadonlyMap<string, DataRecord>,
    until: number,
    previousMs: number | undefined,
    isEmpty: (record: EventRecord) => boolean,
    evaluate: (rowIds: ReadonlyArray<string>) => T
) => {
    let batchSize = MAX_BATCH_SIZE
    if (Number.isFinite(until)) {
        batchSize =
            previousMs === undefined
                ? 1
                : Math.max(
                      1,
                      Math.min(
                          MAX_BATCH_SIZE,
                          Math.floor(
                              Math.max(0, until - performance.now()) /
                                  previousMs
                          )
                      )
                  )
    }

    const batch = [rowIds[start]]
    while (batch.length < batchSize && start + batch.length < rowIds.length) {
        const next = records.get(rowIds[start + batch.length])
        if (
            next?.kind !== 'event' ||
            next.programStageId !== record.programStageId ||
            next.enrollmentId !== record.enrollmentId ||
            isEmpty(next)
        ) {
            break
        }
        batch.push(next.id)
    }

    const started = performance.now()
    const result = evaluate(batch)
    return {
        rowIds: batch,
        result,
        millisecondsPerRow: (performance.now() - started) / batch.length,
    }
}
