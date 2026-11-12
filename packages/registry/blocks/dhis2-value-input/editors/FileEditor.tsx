import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { announce as announceInHouse } from '@/components/dhis2/ui/announcer'
import { Button, buttonVariants } from '@/components/dhis2/ui/button'
import { useAnnounced } from '../announce'
import { EditorButtons } from './EditorButtons'
import { useLocalFileUploads } from './fileUploads'
import type { FormEditorProps, PopupEditorProps } from './popupEditors'

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

/** The uploads, what they say, and a change made here, which wins over an upload still running. */
const useFile = ({
    field,
    offline = false,
    uploads: given,
    announce = announceInHouse,
    save,
}: Pick<
    PopupEditorProps,
    'field' | 'offline' | 'uploads' | 'announce' | 'save'
>) => {
    const uploads = useLocalFileUploads(given)
    const running = useSyncExternalStore(uploads.subscribe, uploads.running)
    const image = field.valueType === 'IMAGE'
    const [problem, setProblem] = useState<string>()
    const picker = useRef<HTMLInputElement>(null)
    const disconnected = i18n.t('Connect to the internet to upload files')
    useAnnounced(offline ? disconnected : '', announce)
    useAnnounced(running ?? '', announce)
    return {
        uploads,
        image,
        offline,
        picker,
        problem,
        busy: running !== undefined,
        // A refusal shows at once, over an earlier upload still running.
        status: problem ?? running ?? (offline ? disconnected : undefined),
        change: (next: string | null) => {
            uploads.stop()
            save(next)
        },
        choose: (file: File) => {
            if (offline) {
                return
            }
            setProblem(undefined)
            uploads.start(file, image, save, (reason) => {
                setProblem(reason)
                // Said even when the editor has closed: the person has moved on and sees no editor.
                announce(reason, 'assertive')
            })
        },
    }
}

type FileState = ReturnType<typeof useFile>

/** The stored file (an image's preview, or the file's name and "Download"), what the upload says, and the picker. */
const FileShown = ({
    editor: { image, picker, problem, status, choose },
    value,
    fileName: name,
    fileUrl: url,
}: Pick<PopupEditorProps, 'value' | 'fileName' | 'fileUrl'> & {
    editor: FileState
}) => {
    // An image that does not load leaves its name, as in the cell.
    const [unloadable, setUnloadable] = useState<string>()
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
        </>
    )
}

/** "Choose a file" or "Choose an image", and "Remove" for a stored file. */
const FileChoices = ({
    editor: { image, offline, busy, picker, change },
    value,
}: {
    editor: FileState
    value: string | undefined
}) => (
    <>
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
            {image ? i18n.t('Choose an image') : i18n.t('Choose a file')}
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
    </>
)

/**
 * A file, or an image, uploaded to DHIS2 as soon as it is chosen: a file cannot wait in the outbox, its id can. The
 * upload runs in `uploads`, the field's own by default, and saves the id; a newer choice, Remove or Save stops it, and
 * so do Cancel and Escape, which keep the value. A stored file with a `fileUrl` offers "Download" in a new tab, and an
 * image a preview, or its name when the image does not load; any other file shows its name. Each upload, and why one
 * failed, is said.
 */
export const FileEditor = (props: PopupEditorProps) => {
    const { value, cancel } = props
    const editor = useFile(props)
    /** Cancel: this editor's upload stops and the value stays. */
    const quit = () => {
        if (editor.busy) {
            editor.uploads.stop()
        }
        cancel()
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
    return (
        <>
            <FileShown
                editor={editor}
                value={value}
                fileName={props.fileName}
                fileUrl={props.fileUrl}
            />
            <EditorButtons
                save={() => {
                    if (!editor.busy) {
                        editor.change(value ?? null)
                    }
                }}
                cancel={quit}
            >
                <FileChoices editor={editor} value={value} />
            </EditorButtons>
        </>
    )
}

/** A file or an image in a form: it has no Save or Cancel, and Escape is the page's. */
export const FileFormEditor = (props: FormEditorProps) => {
    const editor = useFile(props)
    return (
        <>
            <FileShown
                editor={editor}
                value={props.value}
                fileName={props.fileName}
                fileUrl={props.fileUrl}
            />
            <div className="flex gap-2">
                <FileChoices editor={editor} value={props.value} />
            </div>
        </>
    )
}
