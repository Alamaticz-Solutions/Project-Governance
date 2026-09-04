import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FeedbackState, Button } from '@ui-kit';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Last-resort render guard. Product screens should handle their own async
 * errors via `AsyncSection`; this only catches render-time crashes. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[governance] render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 'var(--gov-space-6)', maxWidth: 640, margin: '0 auto' }}>
        <FeedbackState
          kind="error"
          title="The workspace hit an unexpected error"
          detail={this.state.error.message}
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        />
      </div>
    );
  }
}
