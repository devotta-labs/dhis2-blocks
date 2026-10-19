import React from 'react'
import { Alert, AlertDescription, ErrorAlert } from '@/registry/dhis2/ui/alert'
import { Button } from '@/registry/dhis2/ui/button'
import { cn } from '@/registry/dhis2/ui/cn'
import type { SaveError } from '../save/writer'
import {
    useEventFormInternal,
    useEventFormPublic,
} from './EventForm/EventFormContext'
import { useEventFormText, type EventFormTranslate } from './EventFormText'

const SaveErrorAlert = ({
    error,
    translate,
}: {
    error: SaveError
    translate: EventFormTranslate
}) => {
    const lines =
        error.kind === 'validation'
            ? [
                  ...(Object.keys(error.fieldErrors).length > 0
                      ? [
                            translate(
                                'The server rejected some answers. They are marked on their questions.'
                            ),
                        ]
                      : []),
                  ...error.formErrors,
              ]
            : [error.message]
    const title =
        error.kind === 'network'
            ? translate(
                  'The event could not be saved. Check the connection and try again.'
              )
            : translate('The event could not be saved')
    return (
        <ErrorAlert title={title} data-testid="event-form-save-error">
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {lines.map((line, index) => (
                    <li key={index}>{line}</li>
                ))}
            </ul>
        </ErrorAlert>
    )
}

/**
 * Save, Complete and Cancel, with what stopped the last save. Save and Complete are only offered
 * while the event can be edited; Complete is not offered once the event is completed.
 */
export const EventFormActions = ({ className }: { className?: string }) => {
    const translate = useEventFormText()
    const { state } = useEventFormPublic('EventFormActions')
    const { actions } = useEventFormInternal('EventFormActions')
    const locked =
        state.readOnlyReason === 'skipped' ||
        state.readOnlyReason === 'completed'
    const busy = state.saving || state.readOnly
    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {state.saveError !== undefined && (
                <SaveErrorAlert error={state.saveError} translate={translate} />
            )}
            {state.attempt !== 'none' && !state.validation.isValid && (
                <Alert variant="warning" data-testid="event-form-invalid">
                    <AlertDescription>
                        {translate(
                            'Some answers need attention before the event can be saved.'
                        )}
                    </AlertDescription>
                </Alert>
            )}
            <div className="flex flex-wrap gap-2">
                {!locked && (
                    <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void actions.save()}
                    >
                        {translate('Save')}
                    </Button>
                )}
                {!locked && state.status !== 'COMPLETED' && (
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void actions.complete()}
                    >
                        {translate('Complete')}
                    </Button>
                )}
                <Button
                    type="button"
                    variant="outline"
                    onClick={actions.cancel}
                >
                    {translate('Cancel')}
                </Button>
            </div>
        </div>
    )
}
