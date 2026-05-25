/* Activities.jsx — Browse + QuickPick toggle. */

const { useState: useStateAct, useMemo: useMemoAct, useRef: useRefAct, useEffect: useEffectAct } = React;

function ActivitiesPage({ state, dispatch }) {
  const [mode, setMode] = useStateAct('browse');

  return (
    <main className="page-main">
      <div className="page-hero">
        <div className="page-hero__top">
          <h1>Activities</h1>
          <div className="seg2 three" role="tablist">
            <button role="tab" aria-pressed={mode === 'browse'} onClick={() => setMode('browse')}>
              📚 Browse
            </button>
            <button role="tab" aria-pressed={mode === 'quickpick'} onClick={() => setMode('quickpick')}>
              ⚡ QuickPick
            </button>
            <button role="tab" aria-pressed={mode === 'trending'} onClick={() => setMode('trending')}>
              🔥 Trending
            </button>
          </div>
        </div>
      </div>

      {mode === 'browse' && <BrowseView state={state} dispatch={dispatch} />}
      {mode === 'quickpick' && <QuickPickView state={state} dispatch={dispatch} />}
      {mode === 'trending' && <TrendingView state={state} dispatch={dispatch} />}
    </main>
  );
}

function BrowseView({ state, dispatch }) {
  const items = window.BD_ACTIVITIES;
  const [query, setQuery] = useStateAct('');
  const gridScrollRef = useRefAct(null);
  const prevDetailIdRef = useRefAct(null);

  const trimmed = query.trim();

  const filtered = useMemoAct(() => {
    if (!trimmed) return items;
    if (trimmed.toLowerCase().startsWith('tag:')) {
      const tag = trimmed.slice(4).trim().toLowerCase();
      return items.filter(a => (a.tags || []).some(t => t.toLowerCase() === tag));
    }
    const q = trimmed.toLowerCase();
    return items.filter(a => {
      const text = [a.name || '', a.hook || '', a.description || '', ...(a.tags || [])].join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [trimmed, items]);

  const totalCount = items.length;
  const matchCount = filtered.length;
  const showEmpty = trimmed.length > 0 && matchCount === 0;

  // Scroll-back effect: when modal closes, scroll to last-viewed card
  useEffectAct(() => {
    const prev = prevDetailIdRef.current;
    prevDetailIdRef.current = state.detailId;

    // When modal closes (detailId goes from truthy to null/falsy)
    if (prev && !state.detailId && state.detailLastId && gridScrollRef.current) {
      const target = gridScrollRef.current.querySelector(
        '[data-id="' + state.detailLastId + '"]'
      );
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [state.detailId, state.detailLastId]);

  function getSuggestionChips(query) {
    const tagSet = new Set();
    (window.BD_ACTIVITIES || []).forEach(a => (a.tags || []).forEach(t => tagSet.add(t.toLowerCase())));
    const allTags = [...tagSet];

    const q = query.trim().toLowerCase();
    let matching, nonMatching;

    if (q.startsWith('tag:')) {
      const prefix = q.slice(4);
      matching = allTags.filter(t => t.startsWith(prefix));
      nonMatching = allTags.filter(t => !t.startsWith(prefix));
    } else if (q) {
      matching = allTags.filter(t => t.includes(q));
      nonMatching = allTags.filter(t => !t.includes(q));
    } else {
      matching = [];
      nonMatching = allTags;
    }

    nonMatching.sort(() => Math.random() - 0.5);
    return [...matching, ...nonMatching].slice(0, 8);
  }

  return (
    <>
      <div className="search-bar">
        <div className="search-bar__inner">
          <label className="search-input">
            <svg className="search-input__icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="20" y1="20" x2="16.5" y2="16.5" />
            </svg>
            <input
              type="text"
              placeholder="Search activities"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query.length > 0 && (
              <button
                type="button"
                className="search-input__clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >×</button>
            )}
          </label>
        </div>
      </div>

      <div className="result-count">
        {!trimmed ? (
          <><b>{totalCount}</b> activities</>
        ) : matchCount > 0 ? (
          <><b>{matchCount}</b> of {totalCount} activities match <span className="q">{trimmed}</span></>
        ) : (
          <><b>0</b> activities match <span className="q">{trimmed}</span></>
        )}
      </div>

      {showEmpty ? (
        <div className="empty-wrap">
          <div className="empty">
            <div className="empty__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16.5" y2="16.5" />
                <line x1="7.5" y1="11" x2="14.5" y2="11" />
              </svg>
            </div>
            <h3>Nothing matches <span className="q">{trimmed}</span></h3>
            <p>Branson isn't a lake-sports town this trip — the family voted for shows and rides. Try a broader word, or pick a starter below.</p>
            <div className="empty__suggest">
              {getSuggestionChips(query).map(chip => (
                <button
                  key={chip}
                  className="chip"
                  type="button"
                  onClick={() => setQuery('tag:' + chip)}
                >{chip}</button>
              ))}
            </div>
            <button
              type="button"
              className="empty__clear"
              onClick={() => setQuery('')}
            >Clear search</button>
          </div>
        </div>
      ) : (
        <div className="catalog-grid" ref={gridScrollRef}>
          {filtered.map(a => (
            <CatalogCard
              key={a.id}
              activity={a}
              userId={state.userId}
              onToggleWish={(id) => dispatch({ type: 'toggleWish', id })}
              onToggleCommit={(id) => dispatch({ type: 'toggleCommit', id })}
              onOpen={(act) => dispatch({ type: 'openDetail', id: act.id, list: filtered.map(a => a.id) })}
            />
          ))}
        </div>
      )}
    </>
  );
}

function QuickPickView({ state, dispatch }) {
  // Show only activities the user hasn't wishlisted or skipped yet.
  const [idx, setIdx] = useStateAct(0);
  const [history, setHistory] = useStateAct([]);
  // flying: { activity, direction, startTransform } — the card that's animating off-screen.
  const [flying, setFlying] = useStateAct(null);
  const [drag, setDrag] = useStateAct({ dx: 0, dy: 0, dragging: false });
  const dragRef = React.useRef({ startX: 0, startY: 0, pointerId: null });

  const [deck, setDeck] = useStateAct([]);
  React.useEffect(() => {
    const unseen = window.BD_ACTIVITIES.filter(
      a => !a.wish.includes(state.userId) && !a.commit.includes(state.userId)
    );
    for (let i = unseen.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unseen[i], unseen[j]] = [unseen[j], unseen[i]];
    }
    setDeck(unseen);
  }, [state.userId]);

  function decide(direction, fromTransform) {
    if (flying || idx >= deck.length) return;
    const a = deck[idx];
    // Capture the swiped card, advance idx immediately so the next card renders in center.
    setFlying({ activity: a, direction, startTransform: fromTransform || null });
    if (direction === 'right') dispatch({ type: 'toggleWish', id: a.id });
    setHistory(h => [...h, { idx, direction }]);
    setIdx(i => i + 1);
    setDrag({ dx: 0, dy: 0, dragging: false });
    // Clear flying once its fly-off animation completes.
    window.setTimeout(() => setFlying(null), 380);
  }

  function undo() {
    if (history.length === 0 || flying) return;
    const last = history[history.length - 1];
    if (last.direction === 'right') dispatch({ type: 'toggleWish', id: deck[last.idx].id });
    setHistory(h => h.slice(0, -1));
    setIdx(last.idx);
  }

  // ─── Keyboard shortcuts (Tinder-style + extras) ──────────────────
  React.useEffect(() => {
    function onKey(e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (idx >= deck.length) return;
      if (e.key === 'ArrowLeft')      { e.preventDefault(); decide('left'); }
      else if (e.key === 'ArrowRight'){ e.preventDefault(); decide('right'); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); dispatch({ type: 'commit', id: deck[idx].id }); decide('right'); }
      else if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, deck, flying, history]);

  // ─── Pointer / touch drag handlers ──────────────────────────────
  function onPointerDown(e) {
    if (flying || idx >= deck.length) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
    setDrag({ dx: 0, dy: 0, dragging: true });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onPointerMove(e) {
    const r = dragRef.current;
    if (r.pointerId == null) return;
    setDrag({ dx: e.clientX - r.startX, dy: e.clientY - r.startY, dragging: true });
  }
  function onPointerUp(e) {
    const r = dragRef.current;
    if (r.pointerId == null) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    const THRESH = 110;
    dragRef.current = { startX: 0, startY: 0, pointerId: null };
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
    if (dx > THRESH) {
      const fromTransform = `translate(${dx}px, ${dy * 0.4}px) rotate(${dx * 0.06}deg)`;
      decide('right', fromTransform);
    } else if (dx < -THRESH) {
      const fromTransform = `translate(${dx}px, ${dy * 0.4}px) rotate(${dx * 0.06}deg)`;
      decide('left', fromTransform);
    } else {
      setDrag({ dx: 0, dy: 0, dragging: false });
    }
  }

  if (idx >= deck.length && !flying) {
    return (
      <div className="empty">
        <h3>You're caught up.</h3>
        <p>You've made a call on every activity in the deck. Head over to <b>Interests</b> to see your wishlist.</p>
      </div>
    );
  }

  const top = deck[idx]; // may be undefined if we're flying the last card
  const remaining = deck.length - idx;

  const dragStyle = drag.dragging
    ? { transform: `translate(${drag.dx}px, ${drag.dy * 0.4}px) rotate(${drag.dx * 0.06}deg)`, transition: 'none' }
    : null;
  const wishOpacity = Math.max(0, Math.min(1, drag.dx / 110));
  const skipOpacity = Math.max(0, Math.min(1, -drag.dx / 110));

  return (
    <div className="deck-wrap">
      <div className="deck-count">{remaining > 0 ? `${idx + 1} of ${deck.length}` : 'Last one done'}</div>
      <div className="deck-stage">
        {/* The new top card -- fresh mount on every idx change so it has no entry animation. */}
        {top && (
          <DeckCard
            key={`top-${top.id}-${idx}`}
            activity={top}
            className={`top ${drag.dragging ? 'dragging' : ''}`}
            style={dragStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            wishStampOpacity={wishOpacity}
            skipStampOpacity={skipOpacity}
            onCommit={() => { dispatch({ type: 'commit', id: top.id }); decide('right'); }}
            onSkip={() => decide('right')}
          />
        )}
        {/* The card that's been swiped — overlays the new top while it animates away. */}
        {flying && (
          <DeckCard
            key={`fly-${flying.activity.id}-${idx}`}
            activity={flying.activity}
            className={`flying flying--${flying.direction}`}
            style={flying.startTransform ? { transform: flying.startTransform } : null}
          />
        )}
      </div>
      <div className="deck-actions">
        <button className="deck-btn deck-btn--undo" onClick={undo} disabled={history.length === 0 || !!flying} aria-label="Undo">↶</button>
        <button className="deck-btn deck-btn--skip" onClick={() => decide('left')} aria-label="Skip">✗</button>
        <button className="deck-btn deck-btn--wish" onClick={() => decide('right')} aria-label="Add to wishlist">♥</button>
        <button className="deck-btn deck-btn--commit" onClick={() => { if (!top) return; dispatch({ type: 'commit', id: top.id }); decide('right'); }} disabled={!top} aria-label="Commit">✓</button>
      </div>
      <div className="deck-kbd">
        Swipe, tap, or use
        <span className="kbd">←</span> skip ·
        <span className="kbd">→</span> wishlist ·
        <span className="kbd">↑</span> commit ·
        <span className="kbd">Z</span> undo
      </div>
    </div>
  );
}

function DeckCard({ activity, className = '', style, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, wishStampOpacity = 0, skipStampOpacity = 0, onCommit, onSkip }) {
  return (
    <div
      className={`deck-card ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="deck-card__thumb">
        <img src={activity.thumb} alt="" draggable="false" />
        {wishStampOpacity > 0 && (
          <div className="deck-card__stamp deck-card__stamp--wish" style={{ opacity: wishStampOpacity }}>WISHLIST</div>
        )}
        {skipStampOpacity > 0 && (
          <div className="deck-card__stamp deck-card__stamp--skip" style={{ opacity: skipStampOpacity }}>SKIP</div>
        )}
      </div>
      <div className="deck-card__body">
        <h3>{activity.name}</h3>
        <p className="deck-card__desc">{activity.hook}</p>
        <div className="deck-card__meta">
          <span className="minichip price">{activity.price}</span>
          <span className="minichip rating">★ {activity.rating}</span>
          <span className="minichip">{activity.drive}</span>
          <span className="minichip">♥ {activity.wish.length}</span>
          <span className="minichip">✓ {activity.commit.length}</span>
        </div>
        {(onCommit || onSkip) && (
          <div className="deck-card__actions" onPointerDown={(e) => e.stopPropagation()}>
            {onCommit && (
              <button
                className="btn btn--primary btn--small"
                disabled={activity.locked}
                onClick={(e) => { e.stopPropagation(); onCommit(); }}
              >Count me in</button>
            )}
            {onSkip && (
              <button
                className="btn btn--secondary btn--small"
                onClick={(e) => { e.stopPropagation(); onSkip(); }}
              >+ Wishlist</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   TRENDING VIEW — the third tab on Activities.
   Sectioned layout: Heating up · On the bubble · Locked in.
   Everything is computed from BD_ACTIVITIES; no extra data needed
   beyond the existing wish[] and commit[] arrays.
   (Section 4 "New picks this week" is deferred — it needs a
   per-pick timestamp the picks table doesn't store yet.)
   ────────────────────────────────────────────────────────────── */

/* Activity score: commits weighted 2×, wishlist-only adds 1. Locked
   items don't get the bonus — they're already settled. */
function trendingScore(a) {
  const wishOnly = a.wish.filter(u => !a.commit.includes(u)).length;
  return a.commit.length * 2 + wishOnly;
}

/* "On the bubble" — high wish, zero or low commits, NOT locked.
   These are the ones begging for a decision. */
function isOnBubble(a) {
  if (a.locked) return false;
  return a.commit.length <= 1 && a.wish.length >= 4;
}

function TrendingView({ state, dispatch }) {
  const all = window.BD_ACTIVITIES;

  const ranked = useMemoAct(() => {
    return [...all]
      .map(a => ({ a, score: trendingScore(a) }))
      .filter(x => x.score > 0)
      .sort((x, y) => y.score - x.score);
  }, [state._tick]);

  const heating = ranked.filter(x => !x.a.locked).slice(0, 3);
  const onBubble = all.filter(isOnBubble);

  const totalInteresting = ranked.length;

  return (
    <div className="trending">
      <p className="trending__lede">
        What the family's into right now.
        {' '}<b>{totalInteresting} of {all.length} activities</b> have at least
        one wishlist or commit from someone in the group.
      </p>

      {/* ─── HEATING UP ──────────────────────── */}
      {heating.length > 0 && (
        <>
          <SectionHeader
            emoji="🔥"
            title="Heating up"
            count={`Top ${heating.length} by family interest`}
            why="most commits + wishlists combined"
          />
          <div className="hot-grid">
            {heating.map(({ a, score }, i) => (
              <HotCard
                key={a.id}
                rank={i + 1}
                activity={a}
                score={score}
                userId={state.userId}
                onOpen={() => dispatch({ type: 'openDetail', id: a.id, list: [a.id] })}
              />
            ))}
          </div>
        </>
      )}

      {/* ─── ON THE BUBBLE ───────────────────── */}
      {onBubble.length > 0 && (
        <>
          <SectionHeader
            title="On the bubble"
            count={`${onBubble.length} ${onBubble.length === 1 ? 'activity' : 'activities'}`}
            why="lots of interest, no one's committed yet"
          />
          <div className="trending__rows">
            {onBubble.map(a => (
              <BubbleRow
                key={a.id}
                activity={a}
                userId={state.userId}
                onOpen={() => dispatch({ type: 'openDetail', id: a.id, list: [a.id] })}
                onCommit={() => dispatch({ type: 'commit', id: a.id })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Section header ─── */
function SectionHeader({ emoji, title, count, why }) {
  return (
    <div className="trending__sec-h">
      <span className="trending__sec-h__title">
        {emoji && <span className="trending__sec-h__emoji">{emoji}</span>}
        {title}
      </span>
      {count && <span className="trending__sec-h__count">{count}</span>}
      {why && <span className="trending__sec-h__why">{why}</span>}
    </div>
  );
}

/* ─── Pile of avatars — small, overlapping ─── */
function Pile({ ids, max = 4 }) {
  const people = ids.map(id => window.BD_PEOPLE.find(p => p.id === id)).filter(Boolean);
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="pile" aria-label={`${people.length} people`}>
      {shown.map(p => (
        <window.Avatar key={p.id} name={p.name} status="wish" />
      ))}
      {extra > 0 && <span className="av av--more" aria-hidden="true">+{extra}</span>}
    </div>
  );
}

/* ─── Heating-up hero card ─── */
function HotCard({ rank, activity, score, userId, onOpen }) {
  const a = activity;
  const youIn = a.commit.includes(userId);
  const youWish = a.wish.includes(userId) && !youIn;
  // Unique people who care, regardless of state.
  const everyone = Array.from(new Set([...a.wish, ...a.commit]));

  return (
    <article className="hot-card" onClick={onOpen} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <div className="hot-card__thumb">
        <img src={a.thumb} alt="" draggable="false" />
        <span className="hot-card__rank">#{rank}</span>
        <span className="hot-card__heat">
          <span className="hot-card__heat-flame">🔥</span> {everyone.length} picks
        </span>
      </div>
      <div className="hot-card__body">
        <h3 className="hot-card__title">{a.name}</h3>
        <div className="hot-card__meta">{a.drive} · {a.price} · ★ {a.rating}</div>
        <div className="hot-card__pile-row">
          <Pile ids={everyone} max={4} />
        </div>
        <div className="hot-card__chips">
          <span className="trend-chip trend-chip--commit">✓ {a.commit.length} committed</span>
          <span className="trend-chip trend-chip--wish">♥ {a.wish.length} wishlisted</span>
          {youIn && <span className="trend-chip trend-chip--you">You're in</span>}
          {youWish && <span className="trend-chip trend-chip--you">You wishlisted</span>}
        </div>
      </div>
    </article>
  );
}

/* ─── On-the-bubble row ─── */
function BubbleRow({ activity, userId, onOpen, onCommit }) {
  const a = activity;
  const youIn = a.commit.includes(userId);
  const youWish = a.wish.includes(userId) && !youIn;
  return (
    <div className="trending-row">
      <img className="trending-row__thumb" src={a.thumb} alt="" />
      <div className="trending-row__body">
        <div className="trending-row__title">{a.name}</div>
        <div className="trending-row__sub">
          <Pile ids={a.wish} max={4} />
          <span className="trend-chip trend-chip--wish">♥ {a.wish.length} wishlisted</span>
          <span className="trend-chip trend-chip--zero">
            {a.commit.length === 0 ? '0 committed' : `${a.commit.length} committed`}
          </span>
          {youWish && <span className="trend-chip trend-chip--you">You wishlisted</span>}
          {youIn && <span className="trend-chip trend-chip--you">You're in</span>}
        </div>
      </div>
      <div className="trending-row__cta">
        <button className="btn btn--secondary btn--small" onClick={onOpen}>Open</button>
        {!youIn && (
          <button className="btn btn--primary btn--small" onClick={onCommit}>I'm in</button>
        )}
      </div>
    </div>
  );
}

/* ─── Locked-in row ─── */
function LockedRow({ activity, userId, onTimeline, onOpen }) {
  const a = activity;
  const youIn = a.commit.includes(userId);
  // Real data carries lockedStatus ("Show 7:30 PM") instead of the
  // prototype's scheduledFor; prefer an explicit scheduledFor if set.
  const when = a.scheduledFor || a.lockedStatus;
  return (
    <div className="trending-row trending-row--locked">
      <img className="trending-row__thumb" src={a.thumb} alt="" />
      <div className="trending-row__body">
        <div className="trending-row__title">{a.name}</div>
        <div className="trending-row__sub">
          {when && <span>{when}</span>}
          <span>{a.commit.length} going</span>
          <span className="trend-chip trend-chip--lock">🔒 Locked</span>
          {youIn && <span className="trend-chip trend-chip--you">You're in</span>}
        </div>
      </div>
      <div className="trending-row__cta">
        <button className="btn btn--secondary btn--small" onClick={onOpen}>Open</button>
        <button className="btn btn--ghost btn--small" onClick={onTimeline}>See on timeline</button>
      </div>
    </div>
  );
}

Object.assign(window, { ActivitiesPage, TrendingView });
