import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Components' }

export default function ComponentsPage() {
    return (
        <main className="mx-auto w-full max-w-3xl px-6 py-16">
            <h1 className="text-3xl font-semibold tracking-tight">
                Components
            </h1>
            <p className="mt-3 text-muted-foreground">
                Component documentation will be added in a future release.
            </p>
        </main>
    )
}
