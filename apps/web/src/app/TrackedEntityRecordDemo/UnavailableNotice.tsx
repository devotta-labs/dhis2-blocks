import { Alert, AlertTitle } from '@/components/dhis2/ui/alert'
import React from 'react'
import i18n from '../../i18n'

type UnavailableNoticeProps = { message?: string }

/** Recipe: what a locked program (or person) looks like. It never says why. */
export const UnavailableNotice = ({
    message = i18n.t("You don't have access to this program's records"),
}: UnavailableNoticeProps) => (
    <Alert variant="warning" data-testid="unavailable-notice">
        <AlertTitle>{message}</AlertTitle>
    </Alert>
)
