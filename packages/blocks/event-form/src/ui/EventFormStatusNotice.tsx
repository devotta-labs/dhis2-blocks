import React from 'react'
import { Alert, AlertDescription, ErrorAlert } from '@/registry/dhis2/ui/alert'
import {
    useEventFormPublic,
    useEventFormRulesContext,
} from './EventForm/EventFormContext'
import { useEventFormText } from './EventFormText'

/** Why the form cannot be edited, when it cannot. */
export const EventFormStatusNotice = () => {
    const translate = useEventFormText()
    const { state } = useEventFormPublic('EventFormStatusNotice')
    const { error } = useEventFormRulesContext('EventFormStatusNotice')
    switch (state.readOnlyReason) {
        case 'skipped':
            return (
                <Alert>
                    <AlertDescription>
                        {translate(
                            'This event was skipped, so it cannot be edited.'
                        )}
                    </AlertDescription>
                </Alert>
            )
        case 'completed':
            return (
                <Alert>
                    <AlertDescription>
                        {translate(
                            'This event is completed, and this stage does not allow editing completed events.'
                        )}
                    </AlertDescription>
                </Alert>
            )
        case 'rulesFailed':
            return (
                <ErrorAlert
                    title={translate(
                        'Program rules could not be loaded, so the form cannot be edited'
                    )}
                >
                    {error?.message}
                </ErrorAlert>
            )
        case 'rulesLoading':
            return (
                <p className="m-0 text-sm text-dhis2-grey-700" role="status">
                    {translate('Loading program rules')}
                </p>
            )
        case undefined:
            return null
    }
}
