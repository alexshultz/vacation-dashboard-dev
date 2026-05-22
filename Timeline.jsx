/* Timeline.jsx — day-view calendar with a sticky date-tab strip and the now-line.
 *
 * Architectural rule (do not change without coordination):
 *   `.day-tabs` MUST stay `position: fixed`. The fixed positioning is owned by the
 *   stylesheet — never set it inline. The strip is a translucent continuation of
 *   the site header chrome.
 *
 * Layout overview:
 *   .day-tabs                      ← fixed strip: date title + day-tab pills
 *     .day-tabs__title               long-form date (stays visible while scrolling)
 *     .day-tabs__rail                horizontally-scrollable pill row
 *       .day-tab                       weekday + day-number pill
 *     .day-tabs__more                  scroll-right affordance (chevron + fade)
 *   <main.page-main.tl-page>       ← padded-top by the strip height
 *     section.tl-grid                hour-rail + stage
 *       .tl-hours · .tl-stage          absolute-positioned events + now-line
 *     ul.tl-legend                   chip-style colour key
 *
 * Conflicts are still detected internally: overlapping commits get split into
 * side-by-side lanes and carry a brick ring, so the visual cue stays even
 * though the alert banner has been removed.
 */
const { useState: useStateTl, useMemo: useMemoTl, useEffect: useEffectTl, useRef: useRefTl } = React;

const t2 = s => { const [h, m] = s.split(':').map(Number); return h + m / 60; };

function getTodayIndex(schedule) {
  const today = new Date().toISOString().slice(0, 10);
  const idx = schedule.findIndex(d => d.date === today);
  if (idx !== -1) return idx;
  if (today < schedule[0].date) return 0;
  return schedule.length - 1;
}

const DAY_START = 8;   // 8 AM
const DAY_END   = 23;  // 11 PM
const HOUR_PX   = 80;

function TimelinePage({ state, dispatch }) {
  const days = window.BD_SCHEDULE;
  const [dayIdx, setDayIdx] = useStateTl(() => getTodayIndex(days));

  // Live "now" clock — only used when the user is viewing today.
  const [now, setNow] = useStateTl(() => new Date());
  useEffectTl(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const day = days[dayIdx];

  // Commit/commit overlaps still drive (a) the lane-splitting layout so
  // overlapping events render side-by-side and (b) the brick ring on each
  // overlapping card — the alert banner is gone but the visual cue stays.
  const conflicts = useMemoTl(() => {
    const cs = [];
    const commits = day.events.filter(e => e.type === 'commit' || e.type === 'committed-lock');
    for (let i = 0; i < commits.length; i++) {
      for (let j = i + 1; j < commits.length; j++) {
        const a = commits[i], b = commits[j];
        if (t2(a.start) < t2(b.end) && t2(b.start) < t2(a.end)) cs.push([a, b]);
      }
    }
    return cs;
  }, [day]);

  // Lane assignment for conflicting events so they render side-by-side instead of
  // stacking on top of each other. Each event picks the lowest available lane (column)
  // whose previous occupant ends before this event starts. Non-conflicting events stay
  // in lane 0 / full-width.
  const eventLanes = useMemoTl(() => {
    const inConflict = new Set();
    conflicts.forEach(([a, b]) => { inConflict.add(a.id); inConflict.add(b.id); });

    const sorted = day.events
      .filter(e => inConflict.has(e.id))
      .slice()
      .sort((x, y) => t2(x.start) - t2(y.start));

    const laneEnds = [];                    // laneIdx → last assigned event's end-hour
    const lanes = new Map();                // eventId → { lane, total }
    sorted.forEach(ev => {
      const s = t2(ev.start), e = t2(ev.end);
      let lane = laneEnds.findIndex(end => end <= s);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(e); }
      else laneEnds[lane] = e;
      lanes.set(ev.id, { lane });
    });
    // Resolve total cluster width: find connected components in the overlap graph.
    // Simpler heuristic: total = max lanes used among any conflict pair containing this event.
    const total = Math.max(1, laneEnds.length);
    return { lanes, total };
  }, [day, conflicts]);

  function isMine(ev) {
    if (!ev.activityId) return false;
    const a = window.BD_ACTIVITIES.find(x => x.id === ev.activityId);
    if (!a) return false;
    return a.commit.includes(state.userId) || a.wish.includes(state.userId);
  }

  const visible = day.events;

  // now-line: only render when viewing today AND the time is inside the rendered window.
  const todayISO = now.toISOString().slice(0, 10);
  const viewingToday = day.date === todayISO;
  const nowFloat = now.getHours() + now.getMinutes() / 60;
  const nowInWindow = viewingToday && nowFloat >= DAY_START && nowFloat <= DAY_END;
  const nowTop = nowInWindow ? (nowFloat - DAY_START) * HOUR_PX + 10 : null;

  const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => i + DAY_START);

  // Day-tab rail overflow detection — drives the right-side fade + chevron so
  // the user knows there are days off-screen to the right (or left).
  const railRef = useRefTl(null);
  const [overflow, setOverflow] = useStateTl({ left: false, right: false });
  useEffectTl(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => {
      const canScroll = rail.scrollWidth > rail.clientWidth + 1;
      const atEnd     = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
      const atStart   = rail.scrollLeft <= 1;
      setOverflow({
        left:  canScroll && !atStart,
        right: canScroll && !atEnd,
      });
    };
    update();
    rail.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(rail);
    return () => { rail.removeEventListener('scroll', update); ro.disconnect(); };
  }, [dayIdx, days.length]);

  // When the selected day changes, scroll its tab into view so the user always
  // sees their active day even after they scroll the rail by hand.
  useEffectTl(() => {
    const rail = railRef.current;
    if (!rail) return;
    const el = rail.querySelector('[aria-current="page"]');
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [dayIdx]);

  function scrollRailBy(direction) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.7, behavior: 'smooth' });
  }

  return (
    <>
      {/* Fixed day-tab strip. position:fixed is enforced in CSS (architectural rule). */}
      <nav
        className={[
          'day-tabs',
          overflow.left  && 'day-tabs--overflow-left',
          overflow.right && 'day-tabs--overflow-right',
        ].filter(Boolean).join(' ')}
        aria-label="Trip days"
      >
        <div className="day-tabs__inner">
          <p className="day-tabs__title" aria-live="polite">
            <span className="day-tabs__eyebrow">
              {viewingToday ? 'Today' : `Day ${dayIdx + 1} of ${days.length}`}
            </span>
            <span className="day-tabs__date">{fmtLongDate(day.date)}</span>
          </p>

          <div className="day-tabs__rail-wrap">
            <div className="day-tabs__rail" role="tablist" ref={railRef}>
              {days.map((d, i) => {
                const isToday = d.date === todayISO;
                return (
                  <button
                    key={d.date}
                    role="tab"
                    className={`day-tab ${isToday ? 'day-tab--today' : ''}`}
                    aria-current={i === dayIdx ? 'page' : undefined}
                    aria-selected={i === dayIdx}
                    onClick={() => setDayIdx(i)}
                  >
                    <span className="day-tab__dow">{d.day}</span>
                    <span className="day-tab__num">{d.dayNum}</span>
                    {isToday && <span className="day-tab__pip" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {/* Right-edge fade + chevron. Both auto-hide when there's nothing
                further to scroll into. */}
            <button
              type="button"
              className="day-tabs__more day-tabs__more--right"
              aria-label="Scroll to later days"
              onClick={() => scrollRailBy(1)}
              tabIndex={overflow.right ? 0 : -1}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
            <button
              type="button"
              className="day-tabs__more day-tabs__more--left"
              aria-label="Scroll to earlier days"
              onClick={() => scrollRailBy(-1)}
              tabIndex={overflow.left ? 0 : -1}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 6 9 12 15 18" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="page-main tl-page">
        <section
          className="tl-grid"
          style={{ '--tl-hour-px': HOUR_PX + 'px', '--tl-rows': hours.length }}
        >
          <div className="tl-hours" aria-hidden="true">
            {hours.map(h => (
              <div className="tl-hour" key={h}>
                <span className="tl-hour__label">{fmtHour(h)}</span>
              </div>
            ))}
          </div>

          <div className="tl-stage">
            {/* Hour gridlines drawn as a background pattern in CSS. */}

            {nowTop !== null && (
              <div className="tl-now" style={{ top: nowTop }} aria-hidden="true">
                <span className="tl-now__time">{fmtNow(now)}</span>
                <span className="tl-now__dot" />
                <span className="tl-now__line" />
              </div>
            )}

            {visible.map(ev => {
              const start = t2(ev.start), end = t2(ev.end);
              const top = (start - DAY_START) * HOUR_PX + 10;
              const height = Math.max(36, (end - start) * HOUR_PX - 4);
              const mine = isMine(ev);
              // Viewer's relationship with this activity drives the color.
              // - committed by viewer → dusk (matches Interests)
              // - scheduled (someone else committed) → moss
              // - meal → sand
              // The lock icon (rendered separately on the title row) tells you
              // tickets are paid, regardless of color.
              const viewerCommitted = !!(
                ev.activityId &&
                window.BD_ACTIVITIES.find(x => x.id === ev.activityId)?.commit.includes(state.userId)
              );
              const kindClass =
                ev.type === 'meal'   ? 'tl-event--meal' :
                viewerCommitted      ? 'tl-event--mine-commit' :
                                       'tl-event--scheduled';
              const conflictHere = false; // brick ring removed per request; conflicts still drive lane-split layout.
              const act = ev.activityId ? window.BD_ACTIVITIES.find(x => x.id === ev.activityId) : null;
              const committedPeople = act ? window.BD_PEOPLE.filter(p => act.commit.includes(p.id)) : [];
              const showRoster = committedPeople.length > 0 && height >= 80;
              const clickable = !!ev.activityId;

              // If this event is in a conflict cluster, place it in its lane.
              const laneInfo = eventLanes.lanes.get(ev.id);
              const totalLanes = eventLanes.total;
              const positional = laneInfo
                ? (() => {
                    const i = laneInfo.lane;
                    const n = totalLanes;
                    // Side-by-side columns inside the event's normal 8px gutter.
                    // Each lane gets equal width with a 4px gap between lanes.
                    const colW = `((100% - 16px - ${(n - 1) * 4}px) / ${n})`;
                    return {
                      left:  `calc(8px + ${i} * (${colW} + 4px))`,
                      width: `calc(${colW})`,
                      right: 'auto',
                    };
                  })()
                : {};

              return (
                <article
                  key={ev.id}
                  className={[
                    'tl-event',
                    kindClass,
                    mine && 'is-mine',
                    conflictHere && 'is-conflict',
                    clickable && 'is-clickable',
                  ].filter(Boolean).join(' ')}
                  style={{ top, height, ...positional }}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => dispatch({ type: 'openDetail', id: ev.activityId, list: [ev.activityId] }) : undefined}
                  onKeyDown={(e) => {
                    if (!clickable) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      dispatch({ type: 'openDetail', id: ev.activityId, list: [ev.activityId] });
                    }
                  }}
                >
                  <div className="tl-event__rail" aria-hidden="true" />
                  <div className="tl-event__body">
                    <p className="tl-event__time">
                      {fmtTime(ev.start)}<span aria-hidden="true"> – </span>{fmtTime(ev.end)}
                    </p>
                    <h3 className="tl-event__title">
                      {ev.type === 'committed-lock' && (
                        <span className="tl-event__lock" aria-label="Locked / paid">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="4" y="11" width="16" height="10" rx="2" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                          </svg>
                        </span>
                      )}
                      {ev.title}
                    </h3>
                    {ev.sub && <p className="tl-event__sub">{ev.sub}</p>}
                    {showRoster && (
                      <div className="tl-event__roster">
                        <span className="tl-event__count">✓ {committedPeople.length} going</span>
                        <span className="tl-event__names">
                          {committedPeople.map(p => p.id === state.userId ? 'You' : p.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <ul className="tl-legend" aria-label="Legend">
          <li><span className="tl-legend__sw tl-legend__sw--mine" />You're committed</li>
          <li><span className="tl-legend__sw tl-legend__sw--scheduled" />Scheduled</li>
          <li><span className="tl-legend__sw tl-legend__sw--meal" />Meal</li>
        </ul>
      </main>
    </>
  );
}

// ─── Formatters ──────────────────────────────────────────────────
function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${period}` : `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
function fmtHour(h) {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12} ${period}`;
}
function fmtNow(d) {
  const h = d.getHours(), m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
function fmtLongDate(iso) {
  // 'YYYY-MM-DD' → "Tuesday, May 19" — no Date() round-trip so TZ doesn't shift it.
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow  = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const mon  = date.toLocaleDateString('en-US', { month: 'long',   timeZone: 'UTC' });
  return `${dow}, ${mon} ${d}`;
}

Object.assign(window, { TimelinePage });
