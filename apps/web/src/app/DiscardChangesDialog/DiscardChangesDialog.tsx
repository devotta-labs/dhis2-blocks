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
import React from 'react'
import i18n from '../../i18n'

type DiscardChangesDialogProps = {
    open: boolean
    onCancel: () => void
    onDiscard: () => void
}

export const DiscardChangesDialog = ({
    open,
    onCancel,
    onDiscard,
}: DiscardChangesDialogProps) => {
    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onCancel()
                }
            }}
        >
            <AlertDialogContent position="top">
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {i18n.t('Discard unsaved changes?')}
                    </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="my-[5px]">
                    {i18n.t(
                        'This event has unsaved changes. Leaving this page without saving will lose these changes. Are you sure you want to discard unsaved changes?'
                    )}
                </AlertDialogDescription>
                <AlertDialogFooter>
                    <AlertDialogCancel variant="secondary">
                        {i18n.t('No, cancel')}
                    </AlertDialogCancel>
                    <Button variant="destructive" onClick={onDiscard}>
                        {i18n.t('Yes, discard changes')}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
