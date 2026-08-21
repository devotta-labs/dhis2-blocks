import {
    Button,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    OrganisationUnitTree,
} from '@dhis2/ui'
import React, { useMemo } from 'react'
import i18n from '../../i18n'

export interface OrganisationUnitReference {
    id: string
    displayName: string
    path: string
}

interface OrganisationUnitPickerProps {
    open: boolean
    roots: OrganisationUnitReference[]
    allowedPaths?: string[]
    selected?: OrganisationUnitReference
    onChange: (organisationUnit: OrganisationUnitReference) => void
    onClose: () => void
}

export const OrganisationUnitPicker = ({
    open,
    roots,
    allowedPaths,
    selected,
    onChange,
    onClose,
}: OrganisationUnitPickerProps) => {
    const selectedPaths = useMemo(
        () => (selected ? [selected.path] : []),
        [selected]
    )

    if (!open) {
        return null
    }

    return (
        <Modal large position="top" onClose={onClose}>
            <ModalTitle>{i18n.t('Choose an organisation unit')}</ModalTitle>
            <ModalContent>
                <p className="modal-introduction">
                    {i18n.t('Select one organisation unit for this list.')}
                </p>
                <div
                    className="organisation-unit-tree"
                    data-test="org-unit-tree"
                    data-testid="org-unit-tree"
                >
                    <OrganisationUnitTree
                        roots={roots.map((root) => root.id)}
                        filter={allowedPaths}
                        selected={selectedPaths}
                        singleSelection
                        initiallyExpanded={roots.map((root) => root.path)}
                        onChange={(payload) => {
                            if (!payload.checked) {
                                return
                            }
                            onChange({
                                id: payload.id,
                                displayName: payload.displayName,
                                path: payload.path,
                            })
                            onClose()
                        }}
                    />
                </div>
            </ModalContent>
            <ModalActions>
                <Button
                    primary
                    dataTest="org-unit-picker-close"
                    onClick={onClose}
                >
                    {i18n.t('Close')}
                </Button>
            </ModalActions>
        </Modal>
    )
}
