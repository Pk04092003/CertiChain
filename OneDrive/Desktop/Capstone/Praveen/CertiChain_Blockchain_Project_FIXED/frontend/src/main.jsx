import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
          <div style={{ maxWidth: 760, width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 10px 30px rgba(15,23,42,.08)" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>CertiChain could not load</h1>
            <p style={{ margin: "0 0 14px", color: "#475569" }}>The frontend started, but an application error occurred.</p>
            <pre style={{ margin: 0, padding: 16, overflowX: "auto", borderRadius: 12, background: "#f1f5f9", color: "#b91c1c", whiteSpace: "pre-wrap" }}>{String(this.state.error?.stack || this.state.error?.message || this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
