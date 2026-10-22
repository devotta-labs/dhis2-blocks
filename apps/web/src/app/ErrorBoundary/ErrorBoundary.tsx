import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '../../i18n'

interface ErrorBoundaryProps {
    children: ReactNode
}

interface ErrorBoundaryState {
    error?: Error
}

export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = {}

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Contract failures are intentionally visible during development. Avoid
        // logging response payloads: the error and component stack are enough.
        console.error(error, errorInfo.componentStack)
    }

    render() {
        const { error } = this.state
        if (!error) {
            return this.props.children
        }

        return (
            <main className="grid min-h-[min(100vh,640px)] w-full min-w-0 max-w-full place-items-center p-6">
                <ErrorAlert
                    title={i18n.t('The working list could not be loaded')}
                >
                    <p>
                        {i18n.t(
                            'Application data did not match the expected contract.'
                        )}
                    </p>
                    <details className="max-h-60 max-w-[min(680px,calc(100vw-80px))] overflow-auto whitespace-pre-wrap rounded-[3px] border border-[#ffcdd2] bg-[#fff5f5] p-3 text-[#5d1f1f] [font:12px/1.5_ui-monospace,SFMono-Regular,Menlo,monospace]">
                        <summary>{i18n.t('Technical details')}</summary>
                        <pre>{error.message}</pre>
                    </details>
                    <Button
                        variant="outline"
                        className="justify-self-center"
                        onClick={() => window.location.reload()}
                    >
                        {i18n.t('Reload application')}
                    </Button>
                </ErrorAlert>
            </main>
        )
    }
}
