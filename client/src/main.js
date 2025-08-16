import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
function App() {
    const [prompt, setPrompt] = React.useState('How many contacts do I have in my database?');
    const [resp, setResp] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    async function onSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResp(null);
        try {
            const r = await fetch(import.meta.env.VITE_API_URL || 'http://localhost:3001/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            const json = await r.json();
            if (!r.ok)
                throw new Error(json.error || 'Request failed');
            setResp(json);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("div", { className: "app", children: [_jsx("h1", { children: "Natural Language \u2192 SQL" }), _jsxs("form", { onSubmit: onSubmit, children: [_jsx("textarea", { className: "prompt", rows: 5, value: prompt, onChange: (e) => setPrompt(e.target.value) }), _jsx("div", { className: "actions", children: _jsx("button", { className: "btn", type: "submit", disabled: loading, children: loading ? 'Running…' : 'Submit' }) })] }), error && _jsx("pre", { className: "code error", children: error }), resp && (_jsxs("div", { className: "results", children: [_jsx("h3", { className: "section-title", children: "SQL" }), _jsx("pre", { className: "code", children: resp.sql }), _jsx("h3", { className: "section-title", children: "Summary" }), _jsx("pre", { className: "code", children: resp.summary ?? '(none)' }), _jsx("h3", { className: "section-title", children: "Rows" }), _jsx("pre", { className: "code", children: JSON.stringify(resp.rows, null, 2) })] }))] }));
}
createRoot(document.getElementById('root')).render(_jsx(App, {}));
