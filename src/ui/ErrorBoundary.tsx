import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Logo } from './Logo'

interface State {
  error: Error | null
}

/** Last line of defence: a crash shows a calm screen with a way back instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Kalyxis crashed', error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="v-crash" role="alert">
        <Logo size={56} />
        <h1>Something went wrong</h1>
        <p>Your files are safe in this browser. Reload to continue.</p>
        <pre>{this.state.error.message}</pre>
        <button type="button" className="v-btn v-btn-primary" onClick={() => window.location.reload()}>
          Reload Kalyxis
        </button>
      </div>
    )
  }
}
