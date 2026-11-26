import { Component, ErrorInfo, ReactNode } from "react";
import { withTranslation, WithTranslation } from "react-i18next";
import HopGame from "./hopGame";

interface Props extends WithTranslation {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

// Needs to be a class component - componentDidCatch/getDerivedStateFromError
// have no hook equivalent. Wraps <App/> in index.tsx, so a render crash
// anywhere in the tree lands here instead of a blank white page; i18n
// itself is a plain module-level singleton (not a React provider further
// down the tree), so useTranslation/withTranslation still works in this
// fallback even though everything it would normally wrap just unmounted.
class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // eslint-disable-next-line no-console
        console.error("ErrorBoundary caught:", error, info.componentStack);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        const { t } = this.props;
        return (
            <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-4 bg-bg p-4 text-center">
                <h2 className="m-0">{t('errorBoundary:heading')}</h2>
                <p className="m-0 max-w-[26em] text-text-dim">{t('errorBoundary:body')}</p>
                <button className="btn-primary" onClick={() => window.location.reload()}>
                    {t('errorBoundary:reload')}
                </button>
                <HopGame />
            </div>
        );
    }
}

export default withTranslation()(ErrorBoundary);
