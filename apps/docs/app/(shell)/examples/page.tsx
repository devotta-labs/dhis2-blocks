import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Examples' }

export default function ExamplesPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
            <h1 className="text-3xl font-semibold tracking-tight">Examples</h1>
            <p className="mt-3 text-muted-foreground">
                Application examples will be added in a future release.
            </p>
        </main>
    )
}
