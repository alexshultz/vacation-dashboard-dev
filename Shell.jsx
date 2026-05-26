/* Shell.jsx — app shell with sticky header + page routing.
   Uses a useReducer-ish pattern; mutates the activity data in place for prototype simplicity. */

const { useState: useStateShell, useReducer, useEffect } = React;

// Inject toast animation styles
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes toast-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

const NAV = [
  { id: 'home',       label: 'Home' },
  { id: 'activities', label: 'Activities' },
  { id: 'interests',  label: 'Interests' },
  { id: 'timeline',   label: 'Timeline' },
  { id: 'profile',    label: 'Profile' },
];

/* Icons used in the bottom tab bar (narrow widths only). Simple line glyphs;
   stroke color follows the active/inactive `.tab-bar__tab` rule. */
const NAV_ICONS = {
  home:       <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5"/></svg>,
  activities: <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  interests:  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/></svg>,
  timeline:   <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>,
  profile:    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'openDetail':
      return { ...state, detailId: action.id, detailList: action.list || [], detailLastId: action.id };
    case 'closeDetail':
      return { ...state, detailId: null, detailList: [] };
    case 'setDetailLastId':
      return { ...state, detailLastId: action.id };
    case 'goto':
      return { ...state, page: action.page, detailId: null };
    case 'setUser': {
      const user = window.BD_PEOPLE.find(p => p.id === action.id);
      return { ...state, userId: action.id, user };
    }
    case 'toggleWish': {
      const a = window.BD_ACTIVITIES.find(x => x.id === action.id);
      if (!a) return state;
      const addingWish = !a.wish.includes(state.userId);
      if (addingWish) {
        a.wish = [...a.wish, state.userId];
      } else {
        a.wish = a.wish.filter(u => u !== state.userId);
      }
      if (window.BD_SUPABASE && state.userId) {
        const uid = state.userId.charAt(0).toUpperCase() + state.userId.slice(1);
        if (addingWish) {
          const newState = a.commit.includes(state.userId) ? 'both' : 'wishlist';
          window.BD_SUPABASE.from('picks').upsert({ user_id: uid, slug: a.id, state: newState }, { onConflict: 'user_id,slug' })
            .then(function(r){ if(r.error) console.error('picks upsert error:', r.error, {user_id: uid, slug: a.id}); });
        } else {
          if (a.commit.includes(state.userId)) {
            // Item is committed -- preserve commit state in Supabase, just remove from wish UI
            window.BD_SUPABASE.from('picks').upsert({ user_id: uid, slug: a.id, state: 'committing' }, { onConflict: 'user_id,slug' })
              .then(function(r){ if(r.error) console.error('picks upsert error:', r.error, {user_id: uid, slug: a.id}); });
          } else {
            // Item is wishlist-only -- safe to delete row entirely
            window.BD_SUPABASE.from('picks').delete().eq('user_id', uid).eq('slug', a.id)
              .then(function(r){ if(r.error) console.error('picks delete error:', r.error, {user_id: uid, slug: a.id}); });
          }
        }
      }
      return { ...state, _tick: (state._tick || 0) + 1 };
    }
    case 'toggleCommit': {
      const a = window.BD_ACTIVITIES.find(x => x.id === action.id);
      if (!a || a.locked) return state;
      const addingCommit = !a.commit.includes(state.userId);
      if (addingCommit) {
        a.commit = [...a.commit, state.userId];
      } else {
        a.commit = a.commit.filter(u => u !== state.userId);
      }
      if (window.BD_SUPABASE && state.userId) {
        const uid = state.userId.charAt(0).toUpperCase() + state.userId.slice(1);
        if (addingCommit) {
          const newState = a.wish.includes(state.userId) ? 'both' : 'committing';
          window.BD_SUPABASE.from('picks').upsert({ user_id: uid, slug: a.id, state: newState }, { onConflict: 'user_id,slug' })
            .then(function(r){ if(r.error) console.error('picks upsert error:', r.error, {user_id: uid, slug: a.id}); });
        } else {
          if (a.wish.includes(state.userId)) {
            window.BD_SUPABASE.from('picks').upsert({ user_id: uid, slug: a.id, state: 'wishlist' }, { onConflict: 'user_id,slug' })
              .then(function(r){ if(r.error) console.error('picks upsert error:', r.error, {user_id: uid, slug: a.id}); });
          } else {
            window.BD_SUPABASE.from('picks').delete().eq('user_id', uid).eq('slug', a.id)
              .then(function(r){ if(r.error) console.error('picks delete error:', r.error, {user_id: uid, slug: a.id}); });
          }
        }
      }
      return { ...state, _tick: (state._tick || 0) + 1 };
    }
    case 'commit': {
      const a = window.BD_ACTIVITIES.find(x => x.id === action.id);
      if (!a || a.locked) return state;
      if (!a.commit.includes(state.userId)) {
        a.commit = [...a.commit, state.userId];
      }
      if (window.BD_SUPABASE && state.userId) {
        const uid = state.userId.charAt(0).toUpperCase() + state.userId.slice(1);
        const newState = a.wish.includes(state.userId) ? 'both' : 'committing';
        window.BD_SUPABASE.from('picks').upsert(
          { user_id: uid, slug: a.id, state: newState },
          { onConflict: 'user_id,slug' }
        ).then(function(r){ if(r.error) console.error('picks upsert error:', r.error, {user_id: uid, slug: a.id}); });
      }
      return { ...state, _tick: (state._tick || 0) + 1 };
    }
    default:
      return state;
  }
}

function Shell() {
  const initialUser = localStorage.getItem('bd-user') || window.BD_INITIAL_USER;
  const [state, dispatch] = useReducer(appReducer, null, () => ({
    page: 'home',
    userId: initialUser,
    user: window.BD_PEOPLE.find(p => p.id === initialUser),
    detailId: null,
    detailList: [],
    detailLastId: null,
  }));

  const [showToast, setShowToast] = useStateShell(false);

  useEffect(() => {
    try {
      localStorage.setItem('bd-user', state.userId);
      if (state.user) localStorage.setItem('vacdash:v1:user', state.user.name);
    } catch (e) {}
  }, [state.userId]);

  // Listen for data refresh events (from pull-to-refresh)
  useEffect(() => {
    function onDataRefreshed(e) {
      // Increment _tick to trigger re-renders in components that depend on BD_* globals
      dispatch({ type: 'commit', id: '_refresh_tick_' + Date.now() });
    }
    window.addEventListener('bd:datarefreshed', onDataRefreshed);
    return () => window.removeEventListener('bd:datarefreshed', onDataRefreshed);
  }, []);

  // Background auto-refresh every 10 minutes
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

    const intervalId = setInterval(async () => {
      const result = await window.BD_REFRESH_DATA();
      if (result.success && result.changed) {
        // Update state to trigger re-renders
        dispatch({ type: 'commit', id: '_refresh_tick_' + Date.now() });
        // Show toast
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  const effectivePage = state.userId ? state.page : 'profile';
  let PageComp;
  switch (effectivePage) {
    case 'activities': PageComp = window.ActivitiesPage; break;
    case 'interests':  PageComp = window.InterestsPage;  break;
    case 'timeline':   PageComp = window.TimelinePage;   break;
    case 'profile':    PageComp = window.ProfilePage;    break;
    default:           PageComp = window.HomePage;       break;
  }

  return (
    <>
      {window.PullToRefresh && <window.PullToRefresh />}

      {showToast && (
        <div
          data-testid="update-toast"
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#333',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 10000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'toast-fade-in 0.2s ease-out'
          }}
        >
          Updated
        </div>
      )}

      <header className="site-header">
        <div className="site-header__inner">
          <a className="logo" href="#" onClick={(e) => { e.preventDefault(); dispatch({ type: 'goto', page: 'home' }); }}>
            Branson<span className="yr">'26</span>
          </a>
          <nav className="nav" aria-label="Primary">
            {NAV.filter(n => n.id !== 'profile').map(n => (
              <button
                key={n.id}
                aria-current={state.page === n.id ? 'page' : undefined}
                onClick={() => dispatch({ type: 'goto', page: n.id })}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <button
            className="profile-btn"
            title={`Profile — ${state.user ? state.user.name : 'pick your name'}`}
            onClick={() => dispatch({ type: 'goto', page: 'profile' })}
            aria-current={state.page === 'profile' ? 'page' : undefined}
          >
            {state.user ? state.user.name.slice(0, 2).toUpperCase() : '?'}
          </button>
        </div>
      </header>

      <PageComp state={state} dispatch={dispatch} />

      {/* Bottom tab bar — only renders visually at narrow widths (CSS).
          Always in the DOM so it's accessible to anyone using viewport
          resizing or split-screen. */}
      <nav className="tab-bar" aria-label="Primary (compact)">
        {NAV.map(n => (
          <button
            key={n.id}
            className="tab-bar__tab"
            aria-current={state.page === n.id ? 'page' : undefined}
            onClick={() => dispatch({ type: 'goto', page: n.id })}
          >
            {NAV_ICONS[n.id]}
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {state.detailId && window.ActivityDetailModal && (
        <window.ActivityDetailModal
          activityId={state.detailId}
          navigationIds={state.detailList || []}
          userId={state.userId}
          onClose={() => dispatch({ type: 'closeDetail' })}
          onNavigated={(id) => dispatch({ type: 'setDetailLastId', id })}
          onToggleWish={(id) => dispatch({ type: 'toggleWish', id })}
          onToggleCommit={(id) => dispatch({ type: 'toggleCommit', id })}
        />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Shell />);
