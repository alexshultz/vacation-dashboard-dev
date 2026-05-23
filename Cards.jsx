/* Cards.jsx — universal activity card + primitives.
   Exports to window so other scripts can use these components. */

const { useState, useMemo } = React;

/* Roster row — count + avatars + expand panel. Used inside cards.
   Avatar count is responsive to available width via ResizeObserver:
   if fewer than 3 avatars + overflow chip can fit, falls back to only
   the "See everyone" pill. */
function RosterRow({ kind, label, ids, userId, minVisible = 3 }) {
  const [open, setOpen] = useState(false);
  const [fitCount, setFitCount] = useState(8);
  const avatarsRef = React.useRef(null);

  // Each avatar takes 28px and overlaps the previous by 8px → 20px effective stride.
  // The +N chip behaves the same. So total width = 8 + (N * 20).
  React.useEffect(() => {
    const el = avatarsRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = el.clientWidth;
      const max = Math.max(0, Math.floor((w - 8) / 20));
      setFitCount(max);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const people = (window.BD_PEOPLE || []).filter(p => ids.includes(p.id));
  const sortedPeople = userId && ids.includes(userId)
    ? [people.find(p => p.id === userId), ...people.filter(p => p.id !== userId)].filter(Boolean)
    : people;
  const total = sortedPeople.length;
  const isCommit = kind === 'commit';
  const symbol = isCommit ? '✓' : '♥';

  // Decide what fits in the avatars cell.
  // Need room for at least `minVisible` people + a +N chip (= minVisible + 1 slots)
  // before we render any avatars at all — otherwise it's clipped chaos.
  let visible = [];
  let overflow = 0;
  if (total > 0 && fitCount >= minVisible + 1) {
    if (total <= fitCount) {
      visible = sortedPeople;
    } else {
      visible = sortedPeople.slice(0, fitCount - 1);
      overflow = total - visible.length;
    }
  } else if (total > 0 && fitCount >= total) {
    // Special case: very few people total; show them all even if < minVisible.
    visible = sortedPeople;
  }

  return (
    <div className={`roster ${isCommit ? 'roster--commit' : 'roster--wish'}`} data-open={open ? 'true' : 'false'}>
      <span className="roster__count">{symbol} <b>{total}</b> {label}</span>
      <div className="avatars" ref={avatarsRef}>
        {visible.map((p) => (
          <Avatar key={p.id} name={p.name} status={isCommit ? 'commit' : 'wish'} />
        ))}
        {overflow > 0 && (
          <button
            className="av av--more"
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label={`Expand ${overflow} more`}
          >+{overflow}</button>
        )}
      </div>
      {total > 0 && (
        <button
          className="reveal"
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <span>{open ? 'Hide' : 'See everyone'}</span>
          <span className="chev" aria-hidden="true">▾</span>
        </button>
      )}
      {open && (
        <div className="roster__expand">
          <div className="roster__expand__inner">
            <div className="roster__expand__head">Everyone {isCommit ? 'committed' : 'wishlisted'} · {total} {total === 1 ? 'person' : 'people'}</div>
            {sortedPeople.map((p, i) => (
              <React.Fragment key={p.id}>
                {i > 0 && ', '}
                {p.id === userId ? <b>You</b> : p.name}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Avatar — uses the colored fill / outlined / slashed treatment per status. */
function Avatar({ name, status = 'commit', size = 28 }) {
  const code = (name || '').toUpperCase().charCodeAt(0) || 65;
  const bucket = (code % 7) + 1;
  return (
    <span
      className={`av av--${status === 'wish' ? 'wish' : status === 'no' ? 'no' : 'commit'} h-c${bucket}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      title={name}
    >
      {(name || '?').slice(0, 2).toUpperCase()}
    </span>
  );
}

function AvatarStack({ ids, max = 5, status = 'commit' }) {
  const people = (window.BD_PEOPLE || []).filter(p => ids.includes(p.id));
  const visible = people.slice(0, max);
  const extra = people.length - visible.length;
  return (
    <div className="avatars" aria-label={`${people.length} people`}>
      {visible.map(p => <Avatar key={p.id} name={p.name} status={status} />)}
      {extra > 0 && <span className="avatar avatar--more">+{extra}</span>}
    </div>
  );
}

/* Heart toggle — wishlist primary affordance. */
function Heart({ on, onToggle, label = 'wishlist' }) {
  return (
    <button
      className="heart"
      aria-pressed={on}
      aria-label={on ? `Remove from ${label}` : `Add to ${label}`}
      onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
    >
      {on ? '♥' : '♡'}
    </button>
  );
}

/* Catalog card — used on the Activities page (Browse view). */
function CatalogCard({ activity, userId, onToggleWish, onToggleCommit, onOpen }) {
  const wished = activity.wish.includes(userId);
  const committed = activity.commit.includes(userId);
  // Viewer-relative surface treatment:
  //   committed  → dusk-tint surface (viewer is on this commit list)
  //   scheduled  → moss-tint surface (someone else is committed, viewer isn't)
  //   (neither)  → default cream surface
  const someoneCommitted = (window.BD_SCHEDULED_IDS && window.BD_SCHEDULED_IDS.has(activity.id)) || activity.commit.length > 0;
  const surfaceMod = committed       ? 'card-cat--committed'
                   : someoneCommitted ? 'card-cat--scheduled'
                   : '';
  return (
    <article
      className={`card-cat ${surfaceMod}`}
      data-id={activity.id}
      onClick={() => onOpen && onOpen(activity)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen && onOpen(activity); } }}
    >
      <div className="card-cat__thumb">
        <img src={activity.thumb} alt="" loading="lazy" />
        <Heart on={wished} onToggle={() => onToggleWish && onToggleWish(activity.id)} />
      </div>
      <div className="card-cat__body">
        <h3>{activity.name}</h3>
        <p className="card-cat__hook">{activity.hook}</p>
        <div className="card-cat__row">
          <span className="minichip price">{activity.price}</span>
          <span className="minichip rating">★ {activity.rating}</span>
          <span className="minichip">{activity.drive}</span>
          {activity.locked && <span className="minichip locked">🔒 Locked</span>}
        </div>
        <div className="card-cat__counts">
          <span>♥ <b>{activity.wish.length}</b> wishlisted</span>
          <span>✓ <b>{activity.commit.length}</b> committed</span>
        </div>
        <div className="card-cat__actions" onClick={(e) => e.stopPropagation()}>
          {committed ? (
            activity.locked ? (
              <button className="btn btn--locked-in btn--small" disabled aria-disabled="true">
                🔒 Locked in
              </button>
            ) : (
              <button
                className="btn btn--out btn--small"
                onClick={() => onToggleCommit && onToggleCommit(activity.id)}
              >
                Count me out
              </button>
            )
          ) : (
            <button
              className="btn btn--primary btn--small"
              disabled={activity.locked}
              aria-disabled={activity.locked}
              onClick={() => onToggleCommit && onToggleCommit(activity.id)}
            >
              Count me in
            </button>
          )}
          <button
            className={`btn btn--small ${wished ? 'btn--danger' : 'btn--secondary'}`}
            onClick={() => onToggleWish && onToggleWish(activity.id)}
          >
            {wished ? 'Drop wishlist' : '+ Wishlist'}
          </button>
        </div>
      </div>
    </article>
  );
}

/* Dense card — single-column. State drives the visual treatment.
   Mirrors the "Activity card · wishlist" preview as the gold standard. */
function DenseCard({ activity, state, userId, onToggleWish, onToggleCommit }) {
  const wished = activity.wish.includes(userId);
  const committed = activity.commit.includes(userId);
  const isCommitted = state === 'committed';
  const isLocked = activity.locked;   // lock applies regardless of view

  return (
    <article className={`card-dense ${committed ? 'card-dense--committed' : 'card-dense--wishlist'}`}>
      <div className="card-dense__thumb">
        <img src={activity.thumb} alt="" loading="lazy" />
      </div>
      <div className="card-dense__body">
        <div className="card-dense__pills">
          <span className={`card-badge ${committed ? 'card-badge--commit' : 'card-badge--not-going'}`}>
            {committed ? "You're going" : "Undecided"}
          </span>
          {isLocked && <span className="card-badge card-badge--lock">🔒 Locked by Alex</span>}
        </div>
        <h3>{activity.name}</h3>
        <div className="card-dense__meta">{
          committed && activity.scheduledFor
            ? `${activity.drive} drive · ${activity.scheduledFor}`
            : `${activity.drive} drive · ${activity.price} · ★ ${activity.rating}`
        }</div>
        <StatusLine activity={activity} committed={committed} />

        <RosterRow kind="wish" label="wishlisted" ids={activity.wish} userId={userId} />
        <RosterRow kind="commit" label="committed" ids={activity.commit} userId={userId} />

        <div className="card-dense__actions">
          {isLocked ? (
            <>
              {committed
                ? <button className="btn btn--locked-in btn--small" disabled aria-disabled="true">🔒 Locked in — text Alex to change</button>
                : <button className="btn btn--locked-in btn--small" disabled aria-disabled="true">🔒 Locked — text Alex to join</button>
              }
              <button className="btn btn--ghost btn--small">Add to calendar</button>
              {wished && (
                <button className="btn btn--danger btn--small" onClick={() => onToggleWish && onToggleWish(activity.id)}>Drop wishlist</button>
              )}
            </>
          ) : (
            <>
              {committed ? (
                <button className="btn btn--out" onClick={() => onToggleCommit && onToggleCommit(activity.id)}>
                  Count me out
                </button>
              ) : (
                <button className="btn btn--primary" onClick={() => onToggleCommit && onToggleCommit(activity.id)}>
                  Count me in
                </button>
              )}
              {wished && (
                <button className="btn btn--danger btn--small" onClick={() => onToggleWish && onToggleWish(activity.id)}>Drop wishlist</button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/* Status / scheduling info — same shape on every dense card. */
function StatusLine({ activity, committed }) {
  const hasSchedule = activity.lockedStatus && activity.departure;
  if (!hasSchedule) {
    return null;
  }
  const total = activity.commit.length;
  const who = committed
    ? `You + ${total - 1} others`
    : `${total} committed`;
  return (
    <div className="status-line">
      {activity.lockedStatus} — Leaving at {activity.departure} — {who}
    </div>
  );
}

/* Slot warning */
function SlotWarn({ count, max = 30 }) {
  if (count < max - 4) return null;
  return (
    <div className="slot-warn">
      <span style={{ fontSize: 18 }}>⚠️</span>
      <div>
        <b>Your wishlist is getting long</b> — {count} of {max} slots used. Commit or remove some activities to make room.
      </div>
    </div>
  );
}

Object.assign(window, { Avatar, AvatarStack, Heart, CatalogCard, DenseCard, RosterRow, SlotWarn });
