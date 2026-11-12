import { FetchError } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useStore } from 'zustand'
import { Button, buttonVariants } from '@/components/dhis2/ui/button'
import type { CellKey, CellState } from '../../model/types'
import { useCellView, useSpreadsheetContext } from '../../provider/context'
import type { SpreadsheetContext } from '../../provider/context'
import { useAnnounced } from '../OptionCell'
import type { PopupEditorProps } from '../popupEditors'
import { EditorButtons } from './EditorButtons'
import { useUploadFile } from './fileApi'

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

/** What the editor says, and shows, while a file uploads. */
const uploadingText = (file: File) =>
    i18n.t('Uploading {{file}}', { file: file.name, interpolation: AS_IS })

/**
 * Where `fileUrl` says the server serves a cell's file, while the cell holds the file it saved; a file not saved yet
 * has no address.
 */
export const storedFileUrl = (
    fileUrl: SpreadsheetContext['fileUrl'],
    key: CellKey,
    { value, base }: CellState,
    image: boolean
) => (value !== undefined && value === base ? fileUrl?.(key, image) : undefined)

// The upload running in each cell, whichever editor started it: a newer change to the cell stops it.
const running = new Map<CellKey, AbortController>()

/** Stops an upload, and forgets it as its cell's. */
const stopUpload = (key: CellKey, controller: AbortController | undefined) => {
    controller?.abort()
    if (running.get(key) === controller) {
        running.delete(key)
    }
}

/** Ends an upload as its cell's; says whether it still counts. */
const settle = (key: CellKey, controller: AbortController) => {
    if (running.get(key) === controller) {
        running.delete(key)
    }
    return !controller.signal.aborted
}

// The house button looks disabled only when `:disabled`; these buttons stay focusable and say it with `aria-disabled`.
const LOOKS_DISABLED =
    'aria-disabled:cursor-not-allowed aria-disabled:border-dhis2-border-strong aria-disabled:bg-dhis2-muted aria-disabled:text-dhis2-disabled-foreground aria-disabled:shadow-none aria-disabled:hover:bg-dhis2-muted aria-disabled:active:bg-dhis2-muted'

/**
 * A file, or an image, uploaded to DHIS2 as soon as it is chosen: a file cannot wait in the outbox, its id can. The
 * upload saves the id to the cell it was chosen in, even after the person has moved on, and then says so; a newer
 * choice, Remove or Save in the cell stops it, and so do Cancel and Escape, which keep the value. A saved file the
 * provider's `fileUrl` gives an address for offers "Download" in a new tab, and an image a preview, or its name when the
 * image does not load; any other file shows its name. Each upload, and why one failed, is said.
 */
export const FileEditor = ({
    field,
    value,
    cellKey,
    save,
    cancel,
}: PopupEditorProps) => {
    const { announce, effects, fileNames, offline, fileUrl } =
        useSpreadsheetContext()
    const image = field.valueType === 'IMAGE'
    const view = useCellView(cellKey)
    const url = storedFileUrl(fileUrl, cellKey, view, image)
    const name = useStore(fileNames, ({ names }) =>
        value === undefined ? undefined : names.get(value)
    )
    // Why the file last chosen was not uploaded at all.
    const [refusal, setRefusal] = useState<string>()
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
    const upload = useUploadFile({
        onSuccess: (uploaded, { file, controller }) => {
            if (!settle(cellKey, controller)) {
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
                                  effects.getState().cells[cellKey]?.readOnly ??
                                  '',
                              interpolation: AS_IS,
                          })
                )
            }
        },
        onError: (error, { controller }) => {
            if (settle(cellKey, controller)) {
                // Said even when the editor has closed: the person has moved on and sees no editor.
                announce(failure(error), 'assertive')
            }
        },
    })
    const disconnected = i18n.t('Connect to the internet to upload files')
    useAnnounced(offline ? disconnected : '')
    const busy = upload.isPending
    // A refusal shows at once, over an earlier upload still running.
    const problem =
        refusal ?? (upload.isError ? failure(upload.error) : undefined)
    const status =
        problem ??
        (upload.isPending ? uploadingText(upload.variables.file) : undefined) ??
        (offline ? disconnected : undefined)

    /** Cancel: this editor's upload stops and the value stays. */
    const quit = () => {
        stopUpload(cellKey, upload.variables?.controller)
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
        // A dropped or "All files" file may not be an image; an empty type (HEIC on some systems) passes.
        if (image && file.type !== '' && !file.type.startsWith('image/')) {
            const refused = i18n.t('Choose an image file')
            setRefusal(refused)
            announce(refused, 'assertive')
            return
        }
        // A newer choice wins over an upload still running in the cell, whichever editor started it.
        stopUpload(cellKey, running.get(cellKey))
        const controller = new AbortController()
        running.set(cellKey, controller)
        setRefusal(undefined)
        announce(uploadingText(file))
        upload.mutate({ file, controller })
    }

    const storedFile =
        value === undefined ? null : (
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
        )

    return (
        <>
            {url !== undefined && image && url !== unloadable ? (
                <img
                    src={`${url}?dimension=MEDIUM`}
                    alt={name ?? ''}
                    onError={() => setUnloadable(url)}
                    className="max-h-48 max-w-full self-start rounded-dhis2-sm object-contain"
                />
            ) : (
                storedFile
            )}
            {status === undefined ? null : (
                <p
                    className={
                        status === problem
                            ? 'text-xs text-dhis2-destructive'
                            : 'text-dhis2-muted-foreground'
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
