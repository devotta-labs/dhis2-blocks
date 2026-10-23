import i18n from '@dhis2/d2-i18n'
import type { ReactNode } from 'react'
import React from 'react'
import { ZodError } from 'zod'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/dhis2/ui/alert-dialog'
import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { TrackerImportError } from '../errors'
import type { ControlledDialogProps, ProfileMutationError } from '../types'

const describeMutationError = (
    error: ProfileMutationError
): readonly string[] => {
    if (error instanceof TrackerImportError) {
        return error.errorReports
            .map((report) => report.message)
            .filter((message) => message.length > 0)
    }
    const { cause } = error
    return cause instanceof Error &&
        !(cause instanceof ZodError) &&
        cause.message.length > 0
        ? [cause.message]
        : []
}

interface ConfirmActionDialogProps extends ControlledDialogProps {
    slot: string
    size: 'default' | 'sm'
    title: ReactNode
    description: ReactNode
    confirmLabel: ReactNode
    confirmVariant: 'default' | 'destructive'
    errorTitle: ReactNode
    error: ProfileMutationError | null
    isPending: boolean
    onConfirm: () => void
}

export function ConfirmActionDialog({
    open,
    onOpenChange,
    slot,
    size,
    title,
    description,
    confirmLabel,
    confirmVariant,
    errorTitle,
    error,
    isPending,
    onConfirm,
}: ConfirmActionDialogProps) {
    const errorMessages = error ? describeMutationError(error) : []

    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && isPending) return
                onOpenChange(nextOpen)
            }}
        >
            <AlertDialogContent
                size={size}
                data-slot={slot}
                aria-busy={isPending || undefined}
            >
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription>{description}</AlertDialogDescription>
                {error && (
                    <ErrorAlert
                        className="mt-4"
                        title={errorTitle}
                        data-slot="profile-widget-action-error"
                    >
                        {errorMessages.length > 0 ? (
                            <ul className="m-0 list-disc ps-5">
                                {errorMessages.map((message, index) => (
                                    <li key={`${index}:${message}`}>
                                        {message}
                                    </li>
                                ))}
                            </ul>
                        ) : undefined}
                    </ErrorAlert>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel variant="secondary" disabled={isPending}>
                        {i18n.t('No, cancel')}
                    </AlertDialogCancel>
                    <Button
                        variant={confirmVariant}
                        disabled={isPending}
                        aria-busy={isPending || undefined}
                        onClick={() => {
                            if (!isPending) onConfirm()
                        }}
                    >
                        {isPending && (
                            <Spinner
                                aria-hidden
                                className="size-3.5 border-2 border-white/30 border-b-white"
                            />
                        )}
                        {confirmLabel}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
