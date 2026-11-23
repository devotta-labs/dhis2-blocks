import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { uploadFile } from './fileApi'
import type { DataEngine } from './fileApi'

/** A field's file uploads, which the file editor starts and shows. */
export interface FileUploads {
    /** What the running upload for this field says, if one runs. */
    running(): string | undefined
    /** Starts an upload; `done` gets the file resource id. A newer start or `stop` aborts the one before. */
    start(
        file: File,
        image: boolean,
        done: (id: string) => void,
        failed: (message: string) => void
    ): void
    stop(): void
    /** A host may count subscribers to know an editor is open, so an editor subscribes exactly while it is open. */
    subscribe(listener: () => void): () => void
}

const AS_IS = { escapeValue: false }

const refusalSchema = z.object({ message: z.string() })

const failure = (error: Error) => {
    if (error instanceof FetchError && error.type === 'network') {
        return i18n.t('Connect to the internet to upload files')
    }
    const refusal = refusalSchema.safeParse(
        error instanceof FetchError ? error.details : undefined
    )
    return refusal.success
        ? i18n.t('Could not upload the file: {{reason}}', {
              nsSeparator: '::',
              reason: refusal.data.message,
              interpolation: AS_IS,
          })
        : i18n.t('Could not upload the file. Try again.')
}

/**
 * Uploads for the field `key` names. The one running for it is kept in `runs`, which can outlive these uploads: a
 * start here aborts it, whoever started it, and so does `stop`. `running` says only an upload started here. `kept`
 * hears each file DHIS2 keeps, with the name it keeps it under, before `done` does.
 */
export const createFileUploads = (
    engine: DataEngine,
    runs: Map<string, AbortController>,
    key: string,
    kept?: (id: string, name: string) => void
) => {
    const listeners = new Set<() => void>()
    let own: { said: string; controller: AbortController } | undefined
    const settle = (controller: AbortController) => {
        if (runs.get(key) === controller) {
            runs.delete(key)
        }
        if (own?.controller === controller) {
            own = undefined
            listeners.forEach((listener) => listener())
        }
        return !controller.signal.aborted
    }
    const stop = () => runs.get(key)?.abort()
    const uploads: FileUploads = {
        running: () => own?.said,
        start(file, image, done, failed) {
            if (image && file.type !== '' && !file.type.startsWith('image/')) {
                failed(i18n.t('Choose an image file'))
                return
            }
            stop()
            const controller = new AbortController()
            runs.set(key, controller)
            controller.signal.addEventListener('abort', () =>
                settle(controller)
            )
            own = {
                said: i18n.t('Uploading {{file}}', {
                    file: file.name,
                    interpolation: AS_IS,
                }),
                controller,
            }
            listeners.forEach((listener) => listener())
            uploadFile(engine, file, controller.signal).then(
                (uploaded) => {
                    if (settle(controller)) {
                        kept?.(uploaded.id, uploaded.name)
                        done(uploaded.id)
                    }
                },
                (error: Error) => {
                    if (settle(controller)) {
                        failed(failure(error))
                    }
                }
            )
        },
        stop,
        subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
    }
    return uploads
}

/**
 * `given`, or else the field's own uploads, made only when needed (`wanted`, and none given) and stopped when the
 * component unmounts.
 */
export function useLocalFileUploads(given: FileUploads | undefined): FileUploads
export function useLocalFileUploads(
    given: undefined,
    wanted: boolean
): FileUploads | undefined
export function useLocalFileUploads(
    given: FileUploads | undefined,
    wanted = true
) {
    const engine = useDataEngine()
    const [own, setOwn] = useState<FileUploads>()
    let current = own
    if (current === undefined && given === undefined && wanted) {
        current = createFileUploads(engine, new Map(), '')
        setOwn(current)
    }
    useEffect(() => current?.stop, [current])
    return given ?? current
}
