'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#fafafa' }}>
        <div style={{ maxWidth: 600, margin: '4rem auto', background: '#fff', borderRadius: 12, border: '1px solid #fca5a5', padding: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h2 style={{ color: '#b91c1c', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>Please share the error below so we can fix it:</p>
          <pre style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, fontSize: 12, color: '#991b1b', overflow: 'auto', maxHeight: 240, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {error?.message || 'Unknown error'}
            {'\n\n'}
            {error?.stack || ''}
          </pre>
          <button
            onClick={() => reset()}
            style={{ marginTop: 16, padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
