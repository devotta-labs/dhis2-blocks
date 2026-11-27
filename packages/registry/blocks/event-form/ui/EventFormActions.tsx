import i18n from '@dhis2/d2-i18n'
import { useEffect } from 'react'
import type { MouseEvent } from 'react'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/dhis2/ui/alert-dialog'
import { announce } from '@/components/dhis2/ui/announcer'
import { Button } from '@/components/dhis2/ui/button'
import { captureOf, locationLabel } from '../lib/location'
import { EVENT_DATE, LOCATION } from '../lib/validate'
import { failedAttempt, useEventFormContext } from './context'

// Labels and DHIS2's texts are shown as written, not HTML-escaped.
const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

// The field keeps focus until the click: its commit on leaving moves the layout, which would move the button away.
const keepFocus = (event: MouseEvent) => event.preventDefault()
// Focus on the button commits the field typed in, before the form reads it.
const commitField = (event: MouseEvent<HTMLButtonElement>) =>
    event.currentTarget.focus()

/** A button that names a field's error and puts focus in the field. */
const ToField = ({ fieldId, text }: { fieldId: string; text: string }) => {
    const { form, formId } = useEventFormContext()
    let label =
        form.fields.get(fieldId)?.label ??
        form.categories.find(({ id }) => id === fieldId)?.name ??
        ''
    if (fieldId === EVENT_DATE) {
        label = form.eventDateLabel
    }
    const capture = captureOf(form.featureType)
    if (fieldId === LOCATION && capture !== undefined) {
        label = locationLabel(capture)
    }
    return (
        <Button
            type="button"
            variant="link"
            className="h-auto px-0"
            onClick={() =>
                document.getElementById(`${formId}-${fieldId}`)?.focus()
            }
        >
            {i18n.t('{{label}}: {{text}}', { ...AS_IS, label, text })}
        </Button>
    )
}

/** What blocks the last attempt, as buttons to each field. */
const Summary = () => {
    const { state } = useEventFormContext()
    const failed = failedAttempt(state)
    if (failed === undefined) {
        return null
    }
    return (
        <ErrorAlert
            title={
                state.attempt === 'complete'
                    ? i18n.t('Fix these before completing')
                    : i18n.t('Fix these before saving')
            }
        >
            {failed.invalid.map(({ fieldId, text }) => (
                <ToField key={fieldId} fieldId={fieldId} text={text} />
            ))}
            {failed.formErrors.map((text) => (
                <p key={text}>{text}</p>
            ))}
        </ErrorAlert>
    )
}

/** The save's failure: DHIS2's reason, the errors that name no field, and buttons to the fields still in error. */
const SaveError = () => {
    const { state } = useEventFormContext()
    const { saveError, serverErrors } = state
    if (saveError === undefined) {
        return null
    }
    const lines = [saveError.reason, ...saveError.errors].filter(
        (line) => line !== undefined
    )
    const items = [
        ...lines.map((line) => <p key={line}>{line}</p>),
        ...[...serverErrors].flatMap(([fieldId, texts]) =>
            texts.map((text) => (
                <ToField key={fieldId + text} fieldId={fieldId} text={text} />
            ))
        ),
    ]
    return (
        <ErrorAlert
            title={
                saveError.reopen
                    ? i18n.t("Didn't reopen")
                    : i18n.t("Didn't save")
            }
        >
            {items.length === 0 ? undefined : items}
        </ErrorAlert>
    )
}

/**
 * The error summary, the save's failure, Save and Complete, Reopen for a completed event the user may reopen, what a
 * save in flight or done says beside them, and the question before completing with warnings.
 */
export const EventFormActions = () => {
    const {
        state,
        readOnly,
        formId,
        confirmSaved,
        stillSaving,
        stopWaiting,
        submit,
        canReopen,
        reopen,
        confirmComplete,
        cancelComplete,
    } = useEventFormContext()
    const { saving, confirming } = state
    const disabled = saving !== undefined || readOnly !== undefined
    const saved = state.saved && confirmSaved === 'status'
    useEffect(() => {
        if (saved) {
            announce(i18n.t('Saved'))
        }
    }, [saved])
    useEffect(() => {
        if (stillSaving) {
            announce(i18n.t('Still saving…'))
        }
    }, [stillSaving])
    return (
        <>
            <Summary />
            <SaveError />
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    id={`${formId}-save`}
                    type="submit"
                    disabled={disabled}
                    focusableWhenDisabled
                    onMouseDown={keepFocus}
                    onClick={commitField}
                >
                    {saving === 'save' ? i18n.t('Saving…') : i18n.t('Save')}
                </Button>
                {state.status === 'COMPLETED' ? null : (
                    <Button
                        id={`${formId}-complete`}
                        type="button"
                        variant="secondary"
                        disabled={disabled}
                        focusableWhenDisabled
                        onMouseDown={keepFocus}
                        onClick={(event) => {
                            commitField(event)
                            submit('complete')
                        }}
                    >
                        {saving === 'complete'
                            ? i18n.t('Completing…')
                            : i18n.t('Complete')}
                    </Button>
                )}
                {canReopen ? (
                    <Button
                        id={`${formId}-reopen`}
                        type="button"
                        variant="secondary"
                        disabled={saving !== undefined}
                        focusableWhenDisabled
                        onClick={reopen}
                    >
                        {saving === 'reopen'
                            ? i18n.t('Reopening…')
                            : i18n.t('Reopen')}
                    </Button>
                ) : null}
                {saved ? (
                    <span className="text-sm text-dhis2-muted-foreground">
                        {i18n.t('Saved')}
                    </span>
                ) : null}
                {stillSaving && saving !== undefined ? (
                    <>
                        <span className="text-sm text-dhis2-muted-foreground">
                            {i18n.t('Still saving…')}
                        </span>
                        <Button
                            type="button"
                            variant="link"
                            onClick={() => {
                                stopWaiting()
                                // This button leaves; the button it re-enables, Reopen or Save, takes focus.
                                document
                                    .getElementById(
                                        `${formId}-${saving === 'reopen' ? 'reopen' : 'save'}`
                                    )
                                    ?.focus()
                            }}
                        >
                            {i18n.t('Stop waiting')}
                        </Button>
                    </>
                ) : null}
            </div>
            <AlertDialog
                open={confirming !== undefined}
                onOpenChange={(open) => {
                    if (!open) {
                        cancelComplete()
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {i18n.t('Complete anyway?')}
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription render={<div />}>
                        <ul className="m-0 flex list-disc flex-col gap-1 ps-5">
                            {(confirming ?? []).map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {i18n.t('Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={confirmComplete}>
                            {i18n.t('Complete anyway')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
