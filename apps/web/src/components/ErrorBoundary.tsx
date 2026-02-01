import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; message?: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Intentionally minimal; could be hooked to logging service
    console.error('ErrorBoundary caught an error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container-responsive py-8">
          <div className="card">
            <h2 className="text-xl font-semibold mb-2">Something went wrong.</h2>
            <p className="text-sm text-gray-600">{this.state.message || 'An unexpected error occurred.'}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}


