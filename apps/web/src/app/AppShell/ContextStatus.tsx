import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import React from 'react'
import i18n from '../../i18n'

const contextStateClassName =
    'mx-auto mt-4 flex min-h-[220px] w-full min-w-0 max-w-[1440px] flex-col items-center justify-center gap-3 px-6 text-center text-[#405261] [@media(max-width:900px)]:px-3 [&_h2]:text-[20px] [&_h2]:font-medium [&_h2]:text-[#17212b] [&_p]:m-0 [&_p]:max-w-[560px]'

interface ContextStatusProps {
    loading: boolean
    error: unknown
    hasProgram: boolean
    organisationUnitId?: string
    organisationUnitIsAllowed: boolean
    canChooseOrganisationUnit?: boolean
    onRetry: () => void
    onChooseOrganisationUnit: () => void
}

export const ContextStatus = ({
    loading,
    error,
    hasProgram,
    organisationUnitId,
    organisationUnitIsAllowed,
    canChooseOrganisationUnit = true,
    onRetry,
    onChooseOrganisationUnit,
}: ContextStatusProps) => {
    if (loading) {
        return (
            <main
                className={contextStateClassName}
                data-testid="app-context-loading"
                aria-live="polite"
            >
                <CircularLoader small />
                <p>{i18n.t('Loading tracker programs…')}</p>
            </main>
        )
    }

    if (error) {
        return (
            <main
                className={contextStateClassName}
                data-testid="app-context-error"
            >
                <NoticeBox error title={i18n.t('Could not load app context')}>
                    <p>
                        {error instanceof Error ? error.message : String(error)}
                    </p>
                    <Button onClick={onRetry}>{i18n.t('Try again')}</Button>
                </NoticeBox>
            </main>
        )
    }

    if (!hasProgram) {
        return (
            <main
                className={contextStateClassName}
                data-testid="program-empty-state"
            >
                <h2>{i18n.t('Choose a program to start')}</h2>
                <p>
                    {i18n.t(
                        'Working lists query tracked entities and program-stage events for the selected tracker program.'
                    )}
                </p>
            </main>
        )
    }

    if (!organisationUnitId) {
        return (
            <main
                className={contextStateClassName}
                data-testid="org-unit-empty-state"
            >
                <h2>{i18n.t('Choose an organisation unit')}</h2>
                <p>
                    {canChooseOrganisationUnit
                        ? i18n.t(
                              'Select an organisation unit assigned to both you and this program.'
                          )
                        : i18n.t(
                              'No organisation units are available for your user account.'
                          )}
                </p>
                {canChooseOrganisationUnit ? (
                    <Button
                        primary
                        dataTest="choose-org-unit"
                        onClick={onChooseOrganisationUnit}
                    >
                        {i18n.t('Choose organisation unit')}
                    </Button>
                ) : null}
            </main>
        )
    }

    if (!organisationUnitIsAllowed) {
        return (
            <main
                className={contextStateClassName}
                data-testid="invalid-program-context"
            >
                <NoticeBox
                    error
                    title={i18n.t(
                        'Selected program is invalid for selected organisation unit'
                    )}
                >
                    <p>
                        {i18n.t(
                            'Clear the selected program or choose another organisation unit.'
                        )}
                    </p>
                    {canChooseOrganisationUnit ? (
                        <Button
                            dataTest="replace-invalid-org-unit"
                            onClick={onChooseOrganisationUnit}
                        >
                            {i18n.t('Choose another organisation unit')}
                        </Button>
                    ) : null}
                </NoticeBox>
            </main>
        )
    }

    return null
}
