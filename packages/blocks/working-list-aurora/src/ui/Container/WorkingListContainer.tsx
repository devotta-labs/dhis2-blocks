import React, { type ComponentPropsWithoutRef } from 'react'
import { useWorkingListMeta } from '../../provider/WorkingListContext'
import { WorkingListLoading } from '../Loading'
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
                    className="mb-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 backdrop-blur"
                    data-testid="offline-notice"
                    role="status"
                >
                    {translate(
                        'You are offline. Cached results remain available; server actions are disabled.'
                    )}
                </div>
            )}
            {lifecycle.status === 'pending' && (
                <div className="rounded-3xl border border-white/10 bg-white/5 py-10 backdrop-blur">
                    <WorkingListLoading
                        label={translate('Loading the working list…')}
                        testId="working-list-initializing"
                    />
                </div>
            )}
            {lifecycle.status === 'error' && (
                <div
                    className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100 backdrop-blur"
                    data-testid="working-list-lifecycle-error"
                    role="alert"
                >
                    <strong className="mb-1 block text-base">
                        {translate('Could not load the working list')}
                    </strong>
                    <span>
                        {translate(
                            'The working list could not be initialized for this program.'
                        )}
                    </span>
                </div>
            )}
            <article
                {...props}
                className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(160deg,rgb(23_16_58_/_92%),rgb(9_10_28_/_96%))] shadow-[0_30px_70px_-30px_rgb(56_189_248_/_45%),0_0_0_1px_rgb(255_255_255_/_4%)_inset] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgb(103_232_249_/_80%),rgb(232_121_249_/_80%),transparent)] before:content-['']${blocked ? ' hidden' : ''}${className ? ` ${className}` : ''}`}
                data-testid="working-list"
                hidden={blocked}
            >
                {children}
            </article>
        </div>
    )
}
