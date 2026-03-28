// src/app/page.tsx — Good Night Games landing page (placeholder)
// Design this properly before Phase 10 launch.

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: '#060914', color: '#EEF2FF', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '2rem' }}>
      <div style={{ fontFamily: "'Russo One', sans-serif", fontSize: 'clamp(32px,6vw,64px)', color: '#F0A500', textAlign: 'center', lineHeight: 1 }}>
        GOOD NIGHT<br />GAMES
      </div>
      <p style={{ color: '#A0B4CC', fontSize: 14, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
        Party games for game night. No host required.
      </p>
      <a href="/games/survey-showdown" style={{ padding: '14px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: "'Russo One', sans-serif", fontSize: 15, letterSpacing: '0.08em', textDecoration: 'none', boxShadow: '0 4px 18px rgba(240,165,0,0.35)' }}>
        PLAY SURVEY SHOWDOWN →
      </a>
    </main>
  )
}
