import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const previewShellClassName =
    'preview-shell mx-auto min-h-[730px] w-full max-w-[1440px] p-6 [font-family:Roboto,Helvetica,Arial,sans-serif] max-[900px]:p-3'

export function PreviewShell({ className, ...props }: ComponentProps<'main'>) {
    return <main className={cn(previewShellClassName, className)} {...props} />
}

export function PreviewLoading() {
    return (
        <PreviewShell
            className="flex items-center justify-center"
            aria-busy="true"
            aria-live="polite"
        >
            <span
                className="size-5 animate-spin rounded-full border-2 border-[#d5dde5] border-t-[#2c6693] motion-reduce:animate-none"
                aria-hidden="true"
            />
            <span className="sr-only">Loading preview…</span>
        </PreviewShell>
    )
}
