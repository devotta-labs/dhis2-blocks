import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import './globals.css'

export const metadata: Metadata = {
    title: {
        default: 'DHIS2 Blocks',
        template: '%s · DHIS2 Blocks',
    },
    description: 'Reusable React blocks for DHIS2 applications.',
}

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn(
                'font-sans antialiased',
                GeistSans.variable,
                GeistMono.variable
            )}
        >
            <body className="flex min-h-screen flex-col">
                <RootProvider
                    search={{ enabled: true }}
                    theme={{
                        attribute: 'class',
                        defaultTheme: 'system',
                        enableSystem: true,
                        disableTransitionOnChange: true,
                    }}
                >
                    <TooltipProvider>{children}</TooltipProvider>
                </RootProvider>
            </body>
        </html>
    )
}
