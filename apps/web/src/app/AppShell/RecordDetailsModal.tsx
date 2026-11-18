import { Button } from '@/components/dhis2/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dhis2/ui/dialog'
import React from 'react'
import i18n from '../../i18n'

export const RecordDetailsModal = ({
    trackedEntityId,
    onClose,
}: {
    trackedEntityId: string
    onClose: () => void
}) => (
    <Dialog
        open
        onOpenChange={(open) => {
            if (!open) {
                onClose()
            }
        }}
    >
        <DialogContent size="sm" position="middle" closeLabel={i18n.t('Close')}>
            <DialogHeader>
                <DialogTitle>{i18n.t('Tracked entity selected')}</DialogTitle>
            </DialogHeader>
            <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 [&_dd]:m-0 [&_dd]:[overflow-wrap:anywhere] [&_dt]:font-medium [&_dt]:text-dhis2-muted-foreground">
                <dt>{i18n.t('Tracked entity ID')}</dt>
                <dd>{trackedEntityId}</dd>
            </dl>
            <DialogFooter>
                <Button onClick={onClose}>{i18n.t('Close')}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
)
