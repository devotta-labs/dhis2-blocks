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
                    className="mb-4 border-y border-[#8a3324]/30 bg-[#f6e7dd] px-6 py-3 font-serif text-sm italic text-[#5d1f14]"
                    data-testid="offline-notice"
                    role="status"
                >
                    {translate(
                        'You are offline. Cached results remain available; server actions are disabled.'
                    )}
                </div>
            )}
            {lifecycle.status === 'pending' && (
                <div className="border border-[#e0d6c2] bg-[#fbf7ee] py-12 font-serif text-[#6b5f52]">
                    <WorkingListLoading
                        label={translate('Loading the working list…')}
                        testId="working-list-initializing"
                    />
                </div>
            )}
            {lifecycle.status === 'error' && (
                <div
                    className="border border-[#8a3324]/40 bg-[#f6e7dd] p-6 font-serif text-[#5d1f14]"
                    data-testid="working-list-lifecycle-error"
                    role="alert"
                >
                    <strong className="mb-1 block text-xl font-normal italic">
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
                className={`w-full min-w-0 max-w-full overflow-hidden border border-[#dcd2be] bg-[#fbf7ee] shadow-[0_1px_0_#fff_inset,0_18px_40px_-32px_rgb(47_42_36_/_45%)]${blocked ? ' hidden' : ''}${className ? ` ${className}` : ''}`}
                data-testid="working-list"
                hidden={blocked}
            >
                <div className="border-b border-[#e0d6c2] bg-[linear-gradient(180deg,#f7f0e2,#fbf7ee)] px-8 pt-6 pb-4">
                    <p className="m-0 font-serif text-[11px] uppercase tracking-[0.4em] text-[#8a3324]">
                        {translate('Tracker dispatch')}
                    </p>
                    <h2 className="m-0 mt-1 font-serif text-3xl font-normal tracking-tight text-[#1c1814]">
                        {translate('The Working List')}
                    </h2>
                    <p className="m-0 mt-1 font-serif text-sm italic text-[#6b5f52]">
                        {translate('Records, filed by hand and set in type.')}
                    </p>
                </div>
                {children}
            </article>
        </div>
    )
}
