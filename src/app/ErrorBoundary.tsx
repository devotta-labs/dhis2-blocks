import { Button, NoticeBox } from '@dhis2/ui'
import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '@/locales'

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
            <main className="app-shell app-shell--error">
                <NoticeBox
                    error
                    title={i18n.t('The working list could not be loaded')}
                >
                    <p>
                        {i18n.t(
                            'Application data did not match the expected contract.'
                        )}
                    </p>
                    <details className="diagnostic-details">
                        <summary>{i18n.t('Technical details')}</summary>
                        <pre>{error.message}</pre>
                    </details>
                    <Button
                        className="error-reload-button"
                        onClick={() => window.location.reload()}
                    >
                        {i18n.t('Reload application')}
                    </Button>
                </NoticeBox>
            </main>
        )
    }
}
