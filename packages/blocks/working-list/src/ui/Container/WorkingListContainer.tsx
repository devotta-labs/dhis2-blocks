import { ErrorAlert } from '../primitives/alert'
import React, { type ComponentPropsWithoutRef } from 'react'
import { useWorkingListMeta } from '../../provider/WorkingListContext'
import { useWorkingListText } from '../WorkingListText'

export interface WorkingListContainerProps extends ComponentPropsWithoutRef<'article'> {}

const visuallyHiddenClassName =
    'absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!'

export const WorkingListContainer = ({
    children,
    className,
    ...props
}: WorkingListContainerProps) => {
    const translate = useWorkingListText()
    const lifecycle = useWorkingListMeta((meta) => meta.lifecycle)
    const online = useWorkingListMeta((meta) => meta.online)
    // While initializing, the composed parts stay visible and render their
    // own skeletons in place, so loading never swaps the layout out.
    const pending = lifecycle.status === 'pending'
    const failed = lifecycle.status === 'error'

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
            {pending && (
                <span
                    className={visuallyHiddenClassName}
                    data-testid="working-list-initializing"
                    role="status"
                    aria-live="polite"
                >
                    {translate('Loading the working list…')}
                </span>
            )}
            {failed && (
                <div className="p-4" data-testid="working-list-lifecycle-error">
                    <ErrorAlert
                        title={translate('Could not load the working list')}
                    >
                        {translate(
                            'The working list could not be initialized for this program.'
                        )}
                    </ErrorAlert>
                </div>
            )}
            <article
                {...props}
                className={`w-full min-w-0 max-w-full overflow-visible rounded-[4px] border border-[#d5dde5] bg-white shadow-[0_1px_2px_rgb(33_41_52_/_8%)]${failed ? ' hidden' : ''}${className ? ` ${className}` : ''}`}
                data-testid="working-list"
                aria-busy={pending || undefined}
                hidden={failed}
            >
                {children}
            </article>
        </div>
    )
}
