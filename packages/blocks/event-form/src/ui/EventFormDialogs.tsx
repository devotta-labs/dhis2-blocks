import React from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/registry/dhis2/ui/alert-dialog'
import { useEventFormPublic } from './EventForm/EventFormContext'
import type { PendingConfirmation } from './EventForm/useEventFormSave'
import { useEventFormText } from './EventFormText'

interface EventFormDialogsProps {
    pending: PendingConfirmation | undefined
    onConfirm(confirmation: PendingConfirmation): void
    onDismiss(): void
}

/** The questions the form asks before it acts: discard changes, complete despite warnings. */
export const EventFormDialogs = ({
    pending,
    onConfirm,
    onDismiss,
}: EventFormDialogsProps) => {
    const translate = useEventFormText()
    const { model } = useEventFormPublic('EventFormDialogs')
    const warnings =
        pending === 'complete'
            ? [...model.fields.values()].flatMap((field) =>
                  !field.hidden && field.messages.warningOnComplete
                      ? [
                            {
                                id: field.id,
                                label: field.label,
                                text: field.messages.warningOnComplete,
                            },
                        ]
                      : []
              )
            : []
    const onOpenChange = (open: boolean) => {
        if (!open) {
            onDismiss()
        }
    }
    return (
        <>
            <AlertDialog
                open={pending === 'discard'}
                onOpenChange={onOpenChange}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {translate('Discard changes?')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {translate(
                                'The changes you made to this event will be lost.'
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {translate('Keep editing')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => onConfirm('discard')}
                        >
                            {translate('Discard')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
                open={pending === 'complete'}
                onOpenChange={onOpenChange}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {translate('Complete anyway?')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {translate(
                                'Program rules have warnings for completing this event.'
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {warnings.length > 0 && (
                        <ul className="m-0 flex list-disc flex-col gap-1 ps-5 text-sm text-dhis2-grey-900">
                            {warnings.map((warning) => (
                                <li key={warning.id}>
                                    {warning.label}: {warning.text}
                                </li>
                            ))}
                        </ul>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {translate('Go back')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => onConfirm('complete')}
                        >
                            {translate('Complete anyway')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
