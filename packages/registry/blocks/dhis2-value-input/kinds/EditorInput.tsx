import { useDhis2ConnectionStatus } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef, useState } from 'react'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { useLocalFileUploads } from '../editors/fileUploads'
import type { FileUploads } from '../editors/fileUploads'
import { formEditorFor } from '../editors/popupEditors'
import type { EditorProblem } from '../editors/popupEditors'
import { composing } from '../composing'
import { useReported } from '../useReported'
import { unknownName } from './SearchInput'
import { intoOwnCalendar } from './ownCalendar'

type OnChange = (value: string | null, problem?: EditorProblem) => void

/**
 * What a pop-up field has committed: `commit` reports to the host and shows a problem, `send` only reports. The
 * problem shows until a change without one. A `value` from the host that is not the one last reported (a rule assigned
 * it), another field or calendar (`fieldKey`), or the field being locked, is another `version`, for the editor to start
 * again on, without the problem; the value last reported, however late it comes back, is not.
 */
export const useEditorCommits = (
    value: string | undefined,
    onChange: OnChange,
    fieldKey: string,
    readOnly: boolean
) => {
    const [state, setState] = useState<{
        fieldKey: string
        readOnly: boolean
        version: number
        problem?: EditorProblem
    }>({ fieldKey, readOnly, version: 0 })
    const echo = useReported(value)
    const held = useRef(value)
    held.current = value
    let current = state
    if (
        echo.isNew ||
        fieldKey !== state.fieldKey ||
        readOnly !== state.readOnly
    ) {
        const again =
            echo.isNew ||
            fieldKey !== state.fieldKey ||
            (readOnly && !state.readOnly)
        current = again
            ? { fieldKey, readOnly, version: state.version + 1 }
            : { ...state, readOnly }
        if (again) {
            echo.forget()
        }
        setState(current)
    }
    const send: OnChange = (next, problem) => {
        echo.report(next)
        onChange(next, problem)
    }
    return {
        version: current.version,
        problem: current.problem,
        held: () => held.current ?? null,
        send,
        commit: (next: string | null, problem?: EditorProblem) => {
            setState((now) => ({ ...now, problem }))
            send(next, problem)
        },
        changed: (problem?: EditorProblem) => {
            if (problem === undefined) {
                setState((now) =>
                    now.problem === undefined ? now : { ...now, problem }
                )
            }
        },
    }
}

/**
 * A pop-up value type's editor drawn in the form. Its changes are reported when focus leaves it, its saves (a file
 * uploaded, Remove) at once. A running upload is reported as a problem, so the host cannot save the field without its
 * file; if the field leaves the page it stops, and what the field held is reported again.
 */
export const EditorInput = ({
    labelId,
    describedBy,
    invalid,
    field,
    settings,
    value,
    valueName,
    fileUrl,
    hiddenOptions,
    commits,
}: {
    labelId: string
    /** The ids of the field's description and messages. */
    describedBy: string | undefined
    /** The field has a problem or an error message. */
    invalid: boolean
    field: Field
    settings: ValueSettings
    value: string | undefined
    valueName: string | undefined
    /** The stored file's link, given only while the field holds that file. */
    fileUrl: string | undefined
    hiddenOptions: ReadonlySet<string> | undefined
    commits: ReturnType<typeof useEditorCommits>
}) => {
    const Editor = formEditorFor(field.valueType)
    const { isDisconnected } = useDhis2ConnectionStatus()
    const pending = useRef<Parameters<OnChange>>()
    const version = useRef(commits.version)
    const replaced = useRef<{ before: string | null }>()
    if (version.current !== commits.version) {
        version.current = commits.version
        pending.current = undefined
        replaced.current = undefined
    }
    const latest = useRef(commits)
    latest.current = commits
    useEffect(
        () => () => {
            const before = replaced.current?.before
            const held = latest.current.held()
            if (before !== undefined && (held === null || held === before)) {
                latest.current.send(before)
            }
        },
        []
    )
    const [learned, setLearned] = useState<{ id: string; name: string }>()
    const local = useLocalFileUploads(
        undefined,
        field.valueType === 'FILE_RESOURCE' || field.valueType === 'IMAGE'
    )
    useEffect(() => local?.stop, [local, commits.version])
    const uploads: FileUploads | undefined = local && {
        ...local,
        start(file, image, done, failed) {
            const before = value ?? null
            let started = false
            local.start(
                file,
                image,
                (id) => {
                    replaced.current = undefined
                    setLearned({ id, name: file.name })
                    done(id)
                },
                (reason) => {
                    replaced.current = undefined
                    failed(reason)
                    if (started) {
                        commits.send(before)
                    }
                }
            )
            started = local.running() !== undefined
            if (started) {
                pending.current = undefined
                replaced.current = { before }
                commits.send(null, {
                    message: i18n.t('Still uploading'),
                    text: file.name,
                })
            }
        },
    }
    const name = learned?.id === value ? learned?.name : valueName
    const flush = () => {
        const change = pending.current
        pending.current = undefined
        if (change !== undefined) {
            commits.commit(...change)
        }
    }
    if (Editor === undefined) {
        return null
    }
    return (
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- not a control: it hears Enter from the editor's own fields
        <div
            className="flex flex-col gap-2"
            onBlur={(event) => {
                if (
                    !event.currentTarget.contains(event.relatedTarget) &&
                    !intoOwnCalendar(event.currentTarget, event.relatedTarget)
                ) {
                    flush()
                }
            }}
            onKeyDown={(event) => {
                if (
                    event.key === 'Enter' &&
                    !composing(event) &&
                    !(event.target instanceof HTMLTextAreaElement)
                ) {
                    flush()
                }
            }}
        >
            <Editor
                key={commits.version}
                field={field}
                value={value}
                settings={settings}
                labelledBy={labelId}
                describedBy={describedBy}
                invalid={invalid}
                hiddenOptions={hiddenOptions}
                fileName={
                    name ??
                    (value === undefined ? undefined : unknownName(value))
                }
                fileUrl={fileUrl}
                offline={isDisconnected}
                uploads={uploads}
                report={(next, problem) => {
                    pending.current = [next, problem]
                    commits.changed(problem)
                }}
                save={(next) => {
                    pending.current = undefined
                    commits.commit(next)
                    return 'queued'
                }}
            />
        </div>
    )
}
