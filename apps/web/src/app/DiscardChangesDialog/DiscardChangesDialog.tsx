import { Button } from '@dhis2-blocks/working-list/primitives'
import {
    ButtonStrip,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
} from '@dhis2/ui'
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
    if (!open) {
        return null
    }

    return (
        <Modal hide={!open} onClose={onCancel} small>
            <ModalTitle>{i18n.t('Discard unsaved changes?')}</ModalTitle>
            <ModalContent>
                <div style={{ margin: '5px 0' }}>
                    {i18n.t(
                        'This event has unsaved changes. Leaving this page without saving will lose these changes. Are you sure you want to discard unsaved changes?'
                    )}
                </div>
            </ModalContent>
            <ModalActions>
                <ButtonStrip end>
                    <Button variant="secondary" onClick={onCancel}>
                        {i18n.t('No, cancel')}
                    </Button>
                    <Button variant="destructive" onClick={onDiscard}>
                        {i18n.t('Yes, discard changes')}
                    </Button>
                </ButtonStrip>
            </ModalActions>
        </Modal>
    )
}
