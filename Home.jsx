/* Home.jsx — schedule overview, day-grouped. */

const { useState: useStateHome } = React;

function HomePage({ state, dispatch }) {
  const userId = state.userId;
  const sched = window.BD_SCHEDULE;

  function youStatus(ev) {
    if (!ev.activityId) return null;
    const a = window.BD_ACTIVITIES.find(x => x.id === ev.activityId);
    if (!a) return null;
    if (a.commit.includes(userId)) return { kind: a.locked ? 'lock' : 'commit', text: a.locked ? "You're locked in" : "You're in" };
    if (a.wish.includes(userId)) return { kind: 'wish', text: 'On your wishlist' };
    if (a.locked) return { kind: 'locked-out', text: '🔒 Locked' };
    return { kind: 'none', text: 'Count me in', actionable: true, activityId: a.id };
  }

  return (
    <main className="page-main">
      <div className="page-hero">
        <span className="eyebrow">Watermill Cove · May 22–29</span>
        <h1>Hi {state.user.name}.</h1>
      </div>

      {sched.map((day) => (
        <section key={day.date} className="day-section">
          <h2>{day.day} · {monthLabel(day.date)}</h2>
          {day.events.map(ev => {
            const ys = youStatus(ev);
            // Viewer-relative row treatment. youStatus returns kind 'commit'
            // or 'lock' when the viewer is on the commit list — both are
            // "committed" for surface purposes (lock just adds the 🔒).
            const viewerCommitted = ys && (ys.kind === 'commit' || ys.kind === 'lock');
            const someoneCommitted = !!(
              ev.activityId && (
                (window.BD_SCHEDULED_IDS && window.BD_SCHEDULED_IDS.has(ev.activityId)) ||
                (window.BD_ACTIVITIES.find(x => x.id === ev.activityId)?.commit.length > 0)
              )
            );
            const surfaceMod = viewerCommitted     ? 'event-row--committed'
                             : someoneCommitted    ? 'event-row--scheduled'
                                                   : '';
            return (
              <div
                key={ev.id}
                className={`event-row ${surfaceMod}`}
                role={ev.activityId ? 'button' : undefined}
                tabIndex={ev.activityId ? 0 : undefined}
                onClick={() => ev.activityId && dispatch({ type: 'openDetail', id: ev.activityId, list: [ev.activityId] })}
                onKeyDown={(e) => {
                  if (!ev.activityId) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dispatch({ type: 'openDetail', id: ev.activityId, list: [ev.activityId] });
                  }
                }}
              >
                <div className="event-row__time">
                  {fmt(ev.start)}
                  <small>→ {fmt(ev.end)}</small>
                </div>
                <div>
                  <div className="event-row__title">{ev.title}</div>
                  {ev.sub && <div className="event-row__sub">{ev.sub}</div>}
                </div>
                <div className="event-row__chips">
                  {ys && (ys.actionable
                    ? <button
                        className="event-row__cta"
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'toggleCommit', id: ys.activityId }); }}
                      >+ {ys.text}</button>
                    : <span className={`card-badge ${
                        ys.kind === 'locked-out' ? 'card-badge--locked-out'
                        : ys.kind === 'wish' ? 'card-badge--wish'
                        : ys.kind === 'lock' ? 'card-badge--committed-lock'
                        : 'card-badge--commit'
                      }`}>{ys.text}</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </main>
  );
}

function fmt(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
function monthLabel(date) {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

Object.assign(window, { HomePage });
