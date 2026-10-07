import type { ComponentProps } from 'react'

export const previewShellClassName =
    'docs-preview-shell mx-auto min-h-[360px] w-full max-w-[1440px] p-6 [font-family:Roboto,Helvetica,Arial,sans-serif] max-[900px]:p-3'

export const PreviewShell = ({
    className,
    ...props
}: ComponentProps<'main'>) => (
    <main
        className={[previewShellClassName, className].filter(Boolean).join(' ')}
        {...props}
    />
)

export const PreviewSpinner = ({ className }: { className?: string }) => (
    <div
        className={['flex min-h-[240px] items-center justify-center', className]
            .filter(Boolean)
            .join(' ')}
        aria-busy="true"
        aria-live="polite"
    >
        <span
            className="size-5 animate-spin rounded-full border-2 border-[#d5dde5] border-t-[#2c6693] motion-reduce:animate-none"
            aria-hidden="true"
        />
        <span className="sr-only">Loading preview…</span>
    </div>
)

export const PreviewLoading = () => (
    <PreviewShell className="flex items-center justify-center">
        <span
            className="size-5 animate-spin rounded-full border-2 border-[#d5dde5] border-t-[#2c6693] motion-reduce:animate-none"
            aria-hidden="true"
        />
        <span className="sr-only">Loading preview…</span>
    </PreviewShell>
)
