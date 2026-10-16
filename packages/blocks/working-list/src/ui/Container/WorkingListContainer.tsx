import { Alert, AlertDescription, AlertTitle } from '../primitives/alert'
import { Spinner } from '../primitives/spinner'
import { IconErrorFilled24 } from '@dhis2/ui-icons'
import React, { type ComponentPropsWithoutRef } from 'react'
import { useWorkingListMeta } from '../../provider/WorkingListContext'
import { useWorkingListText } from '../WorkingListText'

export interface WorkingListContainerProps extends ComponentPropsWithoutRef<'article'> {}

export const WorkingListContainer = ({
    children,
    className,
    ...props
}: WorkingListContainerProps) => {
    const translate = useWorkingListText()
    const lifecycle = useWorkingListMeta((meta) => meta.lifecycle)
    const online = useWorkingListMeta((meta) => meta.online)
    const blocked = lifecycle.status !== 'ready'

    return (
        <div className="w-full min-w-0" data-testid="working-list-main">
            {!online && (
                <div
                    className="border border-[var(--colors-yellow300)] bg-[var(--colors-yellow100)] px-3 py-2 text-[var(--colors-yellow900)] [border-radius:4px_4px_0_0]"
                    data-testid="offline-notice"
                    role="status"
                >
                    {translate(
                        'You are offline. Cached results remain available; server actions are disabled.'
                    )}
                </div>
            )}
            {lifecycle.status === 'pending' && (
                <div
                    className="flex min-h-48 items-center justify-center gap-3 text-[var(--colors-grey700)]"
                    data-testid="working-list-initializing"
                    aria-live="polite"
                >
                    <Spinner className="size-6 border-4" />
                    <p>{translate('Loading the working list…')}</p>
                </div>
            )}
            {lifecycle.status === 'error' && (
                <div className="p-4" data-testid="working-list-lifecycle-error">
                    <Alert variant="destructive">
                        <IconErrorFilled24 />
                        <AlertTitle>
                            {translate('Could not load the working list')}
                        </AlertTitle>
                        <AlertDescription>
                            {translate(
                                'The working list could not be initialized for this program.'
                            )}
                        </AlertDescription>
                    </Alert>
                </div>
            )}
            <article
                {...props}
                className={`w-full min-w-0 max-w-full overflow-visible rounded-[4px] border border-[#d5dde5] bg-white shadow-[0_1px_2px_rgb(33_41_52_/_8%)]${blocked ? ' hidden' : ''}${className ? ` ${className}` : ''}`}
                data-testid="working-list"
                hidden={blocked}
            >
                {children}
            </article>
        </div>
    )
}
