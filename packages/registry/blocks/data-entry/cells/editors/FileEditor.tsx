import { FetchError, useConfig, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useStore } from 'zustand'
import { Button, buttonVariants } from '@/components/dhis2/ui/button'
import type { CellKey, CellState } from '../../model/types'
import { useCellView, useDataEntryContext } from '../../provider/context'
import { useDataEntry } from '../../provider/hooks'
import { useAnnounced } from '../OptionCell'
import type { PopupEditorProps } from '../popupEditors'
import { EditorButtons } from './EditorButtons'
import { eventFileUrl, fileName, uploadFile } from './fileApi'

// A file's name and DHIS2's reason are said as they are, not HTML-escaped.
const AS_IS = { escapeValue: false }

const refusalSchema = z.object({ message: z.string() })

/** Why an upload failed, for the person: no connection, DHIS2's own reason, or neither. */
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
 * Where DHIS2 serves a cell's file, while the cell holds the file DHIS2 has for it; a file not saved to the event yet
 * has no address there. The cell's row is an event and its column a data element.
 */
export const storedFileUrl = (
    baseUrl: string,
    key: CellKey,
    { value, base }: CellState,
    image: boolean
) => {
    const dot = key.indexOf('.')
    return value !== undefined && value === base
        ? eventFileUrl(baseUrl, key.slice(0, dot), key.slice(dot + 1), image)
        : undefined
}

// The upload running in each cell, whichever editor started it: a newer change to the cell stops it.
const running = new Map<CellKey, AbortController>()

/** Stops an upload, and forgets it as its cell's. */
const stopUpload = (key: CellKey, controller: AbortController | undefined) => {
    controller?.abort()
    if (running.get(key) === controller) {
        running.delete(key)
    }
}

// The house button looks disabled only when `:disabled`; these buttons stay focusable and say it with `aria-disabled`.
const LOOKS_DISABLED =
    'aria-disabled:cursor-not-allowed aria-disabled:border-dhis2-grey-400 aria-disabled:bg-dhis2-grey-100 aria-disabled:text-dhis2-grey-600 aria-disabled:shadow-none aria-disabled:hover:bg-dhis2-grey-100 aria-disabled:active:bg-dhis2-grey-100'

interface Upload {
    /** What the editor says while it runs. */
    said: string
    controller: AbortController
}

/**
 * A file, or an image, uploaded to DHIS2 as soon as it is chosen: a file cannot wait in the outbox, its id can. The
 * upload saves the id to the cell it was chosen in, even after the person has moved on, and then says so; a newer
 * choice, Remove or Save in the cell stops it, and so do Cancel and Escape, which keep the value. A file DHIS2 holds for
 * the event offers "Download" in a new tab, and an image a preview, or its name when the image does not load; a file
 * not saved to the event yet shows its name. Each upload, and why one failed, is said.
 */
export const FileEditor = ({
    field,
    value,
    cellKey,
    save,
    cancel,
}: PopupEditorProps) => {
    const engine = useDataEngine()
    const { baseUrl } = useConfig()
    const { announce, effects, fileNames } = useDataEntryContext()
    const offline = useDataEntry((view) => view.sync === 'offline')
    const image = field.valueType === 'IMAGE'
    const url = storedFileUrl(baseUrl, cellKey, useCellView(cellKey), image)
    const name = useStore(fileNames, ({ names }) =>
        value === undefined ? undefined : names.get(value)
    )
    const [upload, setUpload] = useState<Upload>()
    const [problem, setProblem] = useState<string>()
    // An image that does not load leaves its name, as in the cell.
    const [unloadable, setUnloadable] = useState<string>()
    const picker = useRef<HTMLInputElement>(null)
    // Once the editor has closed, an upload that finishes says how it went.
    const closed = useRef(false)
    useEffect(() => {
        closed.current = false
        return () => {
            closed.current = true
        }
    }, [])
    const disconnected = i18n.t('Connect to the internet to upload files')
    useAnnounced(offline ? disconnected : '')
    const busy = upload !== undefined
    const status =
        upload?.said ?? problem ?? (offline ? disconnected : undefined)

    /** Cancel: this editor's upload stops and the value stays. */
    const quit = () => {
        stopUpload(cellKey, upload?.controller)
        cancel()
    }
    /** A change made here wins over an upload still running in the cell. */
    const change = (next: string | null) => {
        stopUpload(cellKey, running.get(cellKey))
        save(next)
    }
    // Escape is Cancel wherever focus is in the editor: a button disabled during an upload keeps keys from the dialog.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                quit()
            }
        }
        document.addEventListener('keydown', onKeyDown, true)
        return () => document.removeEventListener('keydown', onKeyDown, true)
    })

    const choose = (file: File) => {
        if (offline) {
            return
        }
        stopUpload(cellKey, running.get(cellKey))
        const controller = new AbortController()
        running.set(cellKey, controller)
        const clear = () =>
            setUpload((now) =>
                now?.controller === controller ? undefined : now
            )
        // However it is stopped, the editor stops waiting for it.
        controller.signal.addEventListener('abort', clear)
        /** Ends the upload as the cell's; says whether it still counts. */
        const settle = () => {
            if (running.get(cellKey) === controller) {
                running.delete(cellKey)
            }
            clear()
            return !controller.signal.aborted
        }
        const said = i18n.t('Uploading {{file}}', {
            file: file.name,
            interpolation: AS_IS,
        })
        setUpload({ said, controller })
        setProblem(undefined)
        announce(said)
        uploadFile(engine, file, controller.signal)
            // Named from the upload's own answer: nothing more is asked.
            .then(async (id) => ({ id, name: await fileName(engine, id) }))
            .then(
                (uploaded) => {
                    if (!settle()) {
                        return
                    }
                    fileNames.setState(({ names }) => ({
                        names: new Map(names).set(uploaded.id, uploaded.name),
                    }))
                    // The `save` of when the upload started commits by this cell's key, wherever focus is now.
                    const result = save(uploaded.id)
                    if (closed.current) {
                        announce(
                            result === 'queued'
                                ? i18n.t('Uploaded {{file}}', {
                                      file: file.name,
                                      interpolation: AS_IS,
                                  })
                                : i18n.t('Not saved: {{reason}}', {
                                      nsSeparator: '::',
                                      reason:
                                          effects.getState().cells[cellKey]
                                              ?.readOnly ?? '',
                                      interpolation: AS_IS,
                                  })
                        )
                    }
                },
                (error: Error) => {
                    if (!settle()) {
                        return
                    }
                    const reason = failure(error)
                    setProblem(reason)
                    // Said even when the editor has closed: the person has moved on and sees no editor.
                    announce(reason)
                }
            )
    }

    return (
        <>
            {url !== undefined && image && url !== unloadable ? (
                <img
                    src={`${url}?dimension=MEDIUM`}
                    alt={name ?? ''}
                    onError={() => setUnloadable(url)}
                    className="max-h-48 max-w-full self-start rounded-dhis2-sm object-contain"
                />
            ) : value === undefined ? null : (
                <p className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{name ?? value}</span>
                    {url === undefined ? null : (
                        // A new tab: across origins `download` is ignored, and the grid would be navigated away.
                        <a
                            href={url}
                            download
                            target="_blank"
                            rel="noopener"
                            className={buttonVariants({
                                variant: 'link',
                                size: 'sm',
                            })}
                        >
                            {i18n.t('Download')}
                        </a>
                    )}
                </p>
            )}
            {status === undefined ? null : (
                <p
                    className={
                        !busy && status === problem
                            ? 'text-xs text-dhis2-red-700'
                            : 'text-dhis2-grey-700'
                    }
                >
                    {status}
                </p>
            )}
            <input
                ref={picker}
                type="file"
                hidden
                accept={image ? 'image/*' : undefined}
                onChange={({ target }) => {
                    const file = target.files?.[0]
                    // Emptied, so choosing the same file again, after a failure, chooses it.
                    target.value = ''
                    if (file !== undefined) {
                        choose(file)
                    }
                }}
            />
            <EditorButtons
                save={() => {
                    if (!busy) {
                        change(value ?? null)
                    }
                }}
                cancel={quit}
            >
                {/* Focusable while disabled, so focus stays in the editor and the reason beside it is found. */}
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={offline || busy}
                    focusableWhenDisabled
                    onClick={() => picker.current?.click()}
                    className={LOOKS_DISABLED}
                >
                    {image
                        ? i18n.t('Choose an image')
                        : i18n.t('Choose a file')}
                </Button>
                {value === undefined ? null : (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        focusableWhenDisabled
                        onClick={() => change(null)}
                        className={LOOKS_DISABLED}
                    >
                        {i18n.t('Remove')}
                    </Button>
                )}
            </EditorButtons>
        </>
    )
}
