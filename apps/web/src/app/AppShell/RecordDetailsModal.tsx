import {
    Button,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
} from '@dhis2/ui'
import type { WorkingListResultTarget } from '@dhis2-blocks/working-list'
import React from 'react'
import i18n from '../../i18n'

export const RecordDetailsModal = ({
    record,
    onClose,
}: {
    record: WorkingListResultTarget
    onClose: () => void
}) => (
    <Modal small position="middle" onClose={onClose}>
        <ModalTitle>
            {record.mode === 'event'
                ? i18n.t('Event selected')
                : i18n.t('Tracked entity selected')}
        </ModalTitle>
        <ModalContent>
            <dl className="record-details">
                {record.mode === 'event' && (
                    <>
                        <dt>{i18n.t('Event ID')}</dt>
                        <dd>{record.eventId}</dd>
                    </>
                )}
                <dt>{i18n.t('Tracked entity ID')}</dt>
                <dd>
                    {record.mode === 'trackedEntity'
                        ? record.trackedEntityId
                        : (record.trackedEntityId ?? '—')}
                </dd>
            </dl>
        </ModalContent>
        <ModalActions>
            <Button primary onClick={onClose}>
                {i18n.t('Close')}
            </Button>
        </ModalActions>
    </Modal>
)
