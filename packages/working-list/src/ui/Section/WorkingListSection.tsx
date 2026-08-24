import React, { useId, type ReactNode } from 'react'
import styles from './WorkingListSection.module.css'

interface WorkingListSectionBaseProps {
    children: ReactNode
}

type WorkingListSectionTitleProps = {
    title: ReactNode
    ariaLabel?: never
}

type WorkingListSectionAriaLabelProps = {
    title?: never
    ariaLabel: string
}

export type WorkingListSectionProps = WorkingListSectionBaseProps &
    (WorkingListSectionTitleProps | WorkingListSectionAriaLabelProps)

export const WorkingListSection = (props: WorkingListSectionProps) => {
    const headingId = useId()

    if ('title' in props) {
        return (
            <section
                aria-labelledby={headingId}
                data-testid="working-list-section"
            >
                <h2 id={headingId} className={styles.heading}>
                    {props.title}
                </h2>
                {props.children}
            </section>
        )
    }

    return (
        <section
            aria-label={props.ariaLabel}
            data-testid="working-list-section"
        >
            {props.children}
        </section>
    )
}
