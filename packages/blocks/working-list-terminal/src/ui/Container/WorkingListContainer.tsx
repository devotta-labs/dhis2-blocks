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
        <div
            className="w-full min-w-0 font-mono"
            data-testid="working-list-main"
        >
            {!online && (
                <div
                    className="mb-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
                    data-testid="offline-notice"
                    role="status"
                >
                    {'>'}{' '}
                    {translate(
                        'You are offline. Cached results remain available; server actions are disabled.'
                    )}
                </div>
            )}
            {lifecycle.status === 'pending' && (
                <div className="border border-emerald-500/40 bg-black py-10 text-emerald-400">
                    <WorkingListLoading
                        label={translate('Loading the working list…')}
                        testId="working-list-initializing"
                    />
                </div>
            )}
            {lifecycle.status === 'error' && (
                <div
                    className="border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300"
                    data-testid="working-list-lifecycle-error"
                    role="alert"
                >
                    <strong className="mb-1 block">
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
                className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-md border border-emerald-500/40 bg-black shadow-[0_0_0_1px_rgb(16_185_129_/_10%),0_0_40px_-12px_rgb(16_185_129_/_45%)] after:pointer-events-none after:absolute after:inset-0 after:bg-[repeating-linear-gradient(180deg,rgb(16_185_129_/_5%)_0px,rgb(16_185_129_/_5%)_1px,transparent_1px,transparent_3px)] after:content-['']${blocked ? ' hidden' : ''}${className ? ` ${className}` : ''}`}
                data-testid="working-list"
                hidden={blocked}
            >
                <div className="flex items-center gap-2 border-b border-emerald-500/30 bg-emerald-500/5 px-3 py-2 font-mono text-[11px] tracking-widest text-emerald-500">
                    <span aria-hidden="true" className="flex gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                    </span>
                    <span>dhis2@tracker:~$ working-list --watch</span>
                </div>
                {children}
            </article>
        </div>
    )
}
