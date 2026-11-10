import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { announce as announceInHouse } from '@/components/dhis2/ui/announcer'
import { Button, buttonVariants } from '@/components/dhis2/ui/button'
import { useAnnounced } from '../announce'
import { EditorButtons } from './EditorButtons'
import { useLocalFileUploads } from './fileUploads'
import type { PopupEditorProps } from './popupEditors'

// The house button looks disabled only when `:disabled`; these buttons stay focusable and say it with `aria-disabled`.
const LOOKS_DISABLED =
    'aria-disabled:cursor-not-allowed aria-disabled:border-dhis2-border-strong aria-disabled:bg-dhis2-muted aria-disabled:text-dhis2-disabled-foreground aria-disabled:shadow-none aria-disabled:hover:bg-dhis2-muted aria-disabled:active:bg-dhis2-muted'

/** "Download" for the file at `url`, in a new tab: across origins `download` is ignored, and the page would be left. */
export const DownloadLink = ({ url }: { url: string }) => (
    <a
        href={url}
        download
        target="_blank"
        rel="noopener"
        className={buttonVariants({ variant: 'link', size: 'sm' })}
    >
        {i18n.t('Download')}
    </a>
)

/**
 * A file, or an image, uploaded to DHIS2 as soon as it is chosen: a file cannot wait in the outbox, its id can. The
 * upload runs in `uploads`, the field's own by default, and saves the id; a newer choice, Remove or Save stops it, and
 * so do Cancel and Escape, which keep the value. A stored file with a `fileUrl` offers "Download" in a new tab, and an
 * image a preview, or its name when the image does not load; any other file shows its name. Each upload, and why one
 * failed, is said.
 */
export const FileEditor = ({
    field,
    value,
    fileName: name,
    fileUrl: url,
    offline = false,
    uploads: given,
    announce = announceInHouse,
    inline = false,
    save,
    cancel,
}: PopupEditorProps) => {
    const uploads = useLocalFileUploads(given)
    const running = useSyncExternalStore(uploads.subscribe, uploads.running)
    const image = field.valueType === 'IMAGE'
    const [problem, setProblem] = useState<string>()
    // An image that does not load leaves its name, as in the cell.
    const [unloadable, setUnloadable] = useState<string>()
    const picker = useRef<HTMLInputElement>(null)
    const disconnected = i18n.t('Connect to the internet to upload files')
    useAnnounced(offline ? disconnected : '', announce)
    useAnnounced(running ?? '', announce)
    const busy = running !== undefined
    // A refusal shows at once, over an earlier upload still running.
    const status = problem ?? running ?? (offline ? disconnected : undefined)

    /** Cancel: this editor's upload stops and the value stays. */
    const quit = () => {
        if (busy) {
            uploads.stop()
        }
        cancel()
    }
    /** A change made here wins over an upload still running. */
    const change = (next: string | null) => {
        uploads.stop()
        save(next)
    }
    // Escape is Cancel wherever focus is in the editor: a button disabled during an upload keeps keys from the dialog.
    // A form has no Cancel: Escape is the page's.
    useEffect(() => {
        if (inline) {
            return undefined
        }
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
        setProblem(undefined)
        uploads.start(file, image, save, (reason) => {
            setProblem(reason)
            // Said even when the editor has closed: the person has moved on and sees no editor.
            announce(reason, 'assertive')
        })
    }

    const storedFile =
        value === undefined ? null : (
            <p className="flex min-w-0 items-center gap-2">
                <span className="truncate">{name ?? value}</span>
                {url === undefined ? null : <DownloadLink url={url} />}
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
                inline={inline}
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
