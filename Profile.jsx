/* Profile.jsx — name, dates, accessibility, admin login. */

const { useState: useStateProf } = React;

function ProfilePage({ state, dispatch }) {
  const me = state.user;
  const [adminOpen, setAdminOpen] = useStateProf(false);

  return (
    <div className="profile-page">
      <div className="page-hero">
        <span className="eyebrow">Profile</span>
        <h1>{me ? `You're set as ${me.name}.` : 'Pick your name to get started.'}</h1>
        <p>Your picks are saved automatically. No password needed (unless you're Alex).</p>
      </div>

      <section className="profile-section">
        <h2>Who are you?</h2>
        <p className="help">Pick your name from the family roster. You can change this any time.</p>
        <div className="name-grid">
          {window.BD_PEOPLE.map(p => (
            <button
              key={p.id}
              className="name-chip"
              aria-pressed={state.userId === p.id}
              onClick={() => dispatch({ type: 'setUser', id: p.id })}
            >
              {p.name}
              <small>{p.age}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="profile-section">
        <h2>Your trip dates</h2>
        <p className="help">When are you arriving and leaving? This drives your timeline and which meals you're counted for.</p>
        <label htmlFor="arrival">Arrival</label>
        <input type="date" id="arrival" defaultValue="2027-05-28" />
        <label htmlFor="departure">Departure</label>
        <input type="date" id="departure" defaultValue="2027-06-04" />
      </section>

      <section className="profile-section">
        <h2>Accessibility</h2>
        <p className="help">
          The dashboard already honors your system preferences — large text, reduced motion, dark mode, increased contrast. There are no theme switches here on purpose; one designed theme is the design.
        </p>
        <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: 14, lineHeight: 1.55, color: 'var(--color-ink-dim)' }}>
          <li>OS dark mode — automatic</li>
          <li>Reduce motion — automatic</li>
          <li>Larger system text — automatic</li>
          <li>Increased contrast — automatic</li>
        </ul>
      </section>

      {me && me.admin && (
        <section className="profile-section">
          <h2>Admin</h2>
          <p className="help">You're flagged as the trip admin. Sign in for elevated controls.</p>
          {!adminOpen ? (
            <button className="btn btn--ghost" onClick={() => setAdminOpen(true)}>Sign in to admin</button>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label htmlFor="apw">Admin password</label>
                <input type="password" id="apw" placeholder="••••••••" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--primary">Sign in</button>
                <button className="btn btn--ghost" onClick={() => setAdminOpen(false)}>Cancel</button>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-ink-dim)' }}>
                Admin sign-in is gated by Supabase email/password. Other family members never see this section.
              </div>
            </div>
          )}
        </section>
      )}

      <section className="profile-section">
        <h2>Questions or problems?</h2>
        <p className="help">Ask Alex. He built this and is happy to help.</p>
      </section>
    </div>
  );
}

Object.assign(window, { ProfilePage });
