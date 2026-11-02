import React from 'react';

// keeps a crash in one view from blanking the whole window
export default class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('view crashed', err, info?.componentStack); }
  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    const { t, onReset } = this.props;
    return (
      <div className="page"><div className="card col" style={{ maxWidth: 680, margin: '40px auto', gap: 10 }}>
        <h2 className="serif" style={{ margin: 0 }}>{t.crashTitle}</h2>
        <span className="small">{t.crashText}</span>
        <pre className="small muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{String(err?.message || err)}</pre>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" onClick={() => { onReset?.(); this.setState({ err: null }); }}>{t.crashBack}</button>
        </div>
      </div></div>
    );
  }
}
