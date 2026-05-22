/* DetailModal.jsx — Swiper.js virtual carousel with renderExternal.

   Architecture (2026-05-21, replaces 3-pane reset pager):
   - Swiper virtual: full navigationIds array; renderExternal hands DOM to React.
   - React always renders exactly 3 .dm-pane slots (prev/current/next), absolutely
     positioned at idx * slideWidth pixels inside the Swiper wrapper.
   - Swiper owns all touch/gesture physics and the wrapper CSS transform.
   - slideChange drives currentIdx state — no slideTo(1) reset, no suppress flag.
   - Keyboard: custom handler (ArrowLeft=next, ArrowRight=prev, ArrowDown/Space=dismiss).
   - window.__dmNavigate('next'|'prev') exposed for Playwright (instant, 0ms).
*/

const {
  useEffect:       useEffectDM,
  useLayoutEffect: useLayoutEffectDM,
  useRef:          useRefDM,
  useState:        useStateDM,
  useCallback:     useCallbackDM,
} = React;

const DM_DISMISS_DURATION_MS = 280;

function ActivityDetailModal({
  activityId, navigationIds, userId,
  onClose, onNavigated, onToggleWish, onToggleCommit,
}) {
  const navIds     = navigationIds || [];
  const initialIdx = Math.max(0, navIds.indexOf(activityId));

  const navIdsRef = useRefDM(navIds);      navIdsRef.current = navIds;
  const onNavRef  = useRefDM(onNavigated); onNavRef.current  = onNavigated;

  const [currentIdx, setCurrentIdx] = useStateDM(initialIdx);
  const currentIdxRef = useRefDM(initialIdx);
  currentIdxRef.current = currentIdx;

  // slideWidth in pixels; read synchronously in layout effect so first paint
  // already has correct absolute positioning.
  const [slideWidth, setSlideWidth] = useStateDM(0);

  const sheetRef           = useRefDM(null);
  const backdropRef        = useRefDM(null);
  const swiperContainerRef = useRefDM(null);
  const swiperRef          = useRefDM(null);
  const animatingRef       = useRefDM(false);

  // ── Body scroll lock ─────────────────────────────────────────────
  useEffectDM(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Read slide width before first paint ──────────────────────────
  // useLayoutEffect runs synchronously after commit; setState here causes
  // a synchronous re-render before browser paint — no flash.
  useLayoutEffectDM(() => {
    const el = swiperContainerRef.current;
    if (el && el.offsetWidth > 0) setSlideWidth(el.offsetWidth);
  }, []);

  // ── Swiper initialization ────────────────────────────────────────
  useEffectDM(() => {
    if (!window.Swiper) {
      console.error('DetailModal: Swiper not loaded');
      return;
    }
    const el = swiperContainerRef.current;
    if (!el) return;

    const swiper = new window.Swiper(el, {
      slidesPerView: 1,
      loop: false,
      keyboard: { enabled: false },          // custom keyboard handler below
      virtual: {
        slides: navIdsRef.current,           // full array — Swiper manages virtual size
        renderExternal: () => {},            // React owns slide DOM; Swiper owns transform
      },
      initialSlide: initialIdx,
      on: {
        slideChange(sw) {
          const newIdx = sw.activeIndex;
          currentIdxRef.current = newIdx;
          setCurrentIdx(newIdx);
          if (onNavRef.current) onNavRef.current(navIdsRef.current[newIdx]);
        },
      },
    });

    swiperRef.current = swiper;
    // Reconcile slideWidth with Swiper's measured value (may differ by a sub-pixel).
    if (swiper.width > 0) setSlideWidth(swiper.width);

    return () => {
      if (swiperRef.current) {
        swiperRef.current.destroy(true, true);
        swiperRef.current = null;
      }
    };
  }, []);

  // ── Resize: keep slideWidth in sync ─────────────────────────────
  useEffectDM(() => {
    const el = swiperContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const sw = swiperRef.current;
      const w  = (sw && sw.width > 0) ? sw.width : el.offsetWidth;
      if (w > 0) setSlideWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Playwright test hook ─────────────────────────────────────────
  useEffectDM(() => {
    window.__dmNavigate = (dir) => {
      const sw = swiperRef.current;
      if (!sw) return;
      if (dir === 'next') sw.slideNext(0);   // 0 ms = instant
      else                sw.slidePrev(0);
    };
    return () => { delete window.__dmNavigate; };
  }, []);

  // ── Dismiss with slide-down animation ───────────────────────────
  const dismissWithAnimation = useCallbackDM((startDy = 0) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const sheet   = sheetRef.current;
    const backdrop = backdropRef.current;
    if (sheet) {
      sheet.style.transition = `transform ${DM_DISMISS_DURATION_MS}ms cubic-bezier(0.4, 0.0, 1, 1)`;
      sheet.style.transform  = `translateY(${Math.max(startDy, 0) + window.innerHeight}px)`;
    }
    if (backdrop) {
      backdrop.style.transition = `opacity ${DM_DISMISS_DURATION_MS}ms ease-out`;
      backdrop.style.opacity    = '0';
    }
    window.setTimeout(() => onClose(), DM_DISMISS_DURATION_MS);
  }, [onClose]);

  // ── Keyboard navigation ──────────────────────────────────────────
  useEffectDM(() => {
    function onKey(e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape')          { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); swiperRef.current && swiperRef.current.slideNext(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); swiperRef.current && swiperRef.current.slidePrev(); }
      else if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); dismissWithAnimation(0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dismissWithAnimation]);

  // ── Render — always exactly 3 panes ─────────────────────────────
  // Slots are keyed by panel role so React reuses the same DOM nodes on
  // navigation — content updates in-place with no remount flicker.
  // Position math: each pane is at `idx * slideWidth` px inside the Swiper
  // wrapper, which Swiper translates by `-activeIndex * slideWidth` to scroll.
  const activities = window.BD_ACTIVITIES || [];

  const slots = [
    { panel: 'prev',    idx: currentIdx - 1 },
    { panel: 'current', idx: currentIdx     },
    { panel: 'next',    idx: currentIdx + 1 },
  ];

  const currentId  = navIds[currentIdx] || null;
  const currentAct = currentId ? activities.find(a => a.id === currentId) : null;

  return (
    <div
      className="dm-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={currentAct ? `${currentAct.name} details` : 'Activity details'}
    >
      <div className="dm-sheet" ref={sheetRef}>
        <div className="dm-handle" aria-hidden="true"></div>
        <button className="dm-close-x" type="button" onClick={onClose} aria-label="Close">✕</button>

        <div className="dm-pager">
          <div className="swiper" ref={swiperContainerRef}>
            <div className="swiper-wrapper">
              {slots.map(({ panel, idx }) => {
                const id  = (idx >= 0 && idx < navIds.length) ? navIds[idx] : null;
                const act = id ? activities.find(a => a.id === id) : null;
                return (
                  <div
                    key={panel}
                    className="swiper-slide dm-pane"
                    data-panel={panel}
                    data-id={id || undefined}
                    aria-hidden={panel !== 'current'}
                    style={slideWidth > 0
                      ? { position: 'absolute', left: `${idx * slideWidth}px`, width: `${slideWidth}px`, height: '100%' }
                      : { position: 'absolute', left: `${idx * 100}%`, width: '100%', height: '100%' }
                    }
                  >
                    {act && (
                      <PaneContent
                        activity={act}
                        userId={userId}
                        onClose={onClose}
                        onToggleWish={onToggleWish}
                        onToggleCommit={onToggleCommit}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaneContent({ activity, userId, onClose, onToggleWish, onToggleCommit }) {
  const w = activity.wish.includes(userId);
  const c = activity.commit.includes(userId);
  const lk = activity.locked;
  return (
    <div className="dm-pane-inner">
      <div className="dm-hero">
        <img src={activity.thumb} alt="" draggable="false" loading="lazy" />
      </div>
      <div className="dm-body">
        <div className="card-dense__pills">
          <span className={`card-badge ${c ? 'card-badge--commit' : 'card-badge--not-going'}`}>
            {c ? "You're going" : 'Undecided'}
          </span>
          {lk && <span className="card-badge card-badge--lock">🔒 Locked by Alex</span>}
        </div>
        <h2 className="dm-title">{activity.name}</h2>
        <div className="dm-meta">{activity.drive} drive · {activity.price} · ★ {activity.rating}</div>
        <StatusLine activity={activity} committed={c} />
        <p className="dm-desc">{activity.hook}</p>
        {activity.tags && activity.tags.length > 0 && (
          <div className="dm-tags">
            {activity.tags.map(t => <span key={t} className="dm-tag">{t}</span>)}
          </div>
        )}
        <RosterRow kind="wish"   label="wishlisted" ids={activity.wish}   userId={userId} />
        <RosterRow kind="commit" label="committed"  ids={activity.commit} userId={userId} />
        <div className="dm-actions">
          {lk ? (
            <>
              <button className="btn btn--locked-in" disabled aria-disabled="true">
                🔒 {c ? 'Locked in — text Alex to change' : 'Locked — text Alex to join'}
              </button>
              <button className="btn btn--ghost">Add to calendar</button>
            </>
          ) : (
            <>
              {c ? (
                <button className="btn btn--out" onClick={() => onToggleCommit && onToggleCommit(activity.id)}>
                  Count me out
                </button>
              ) : (
                <button className="btn btn--primary" onClick={() => onToggleCommit && onToggleCommit(activity.id)}>
                  Count me in
                </button>
              )}
              <button
                className={`btn ${w ? 'btn--danger' : 'btn--secondary'}`}
                onClick={() => onToggleWish && onToggleWish(activity.id)}
              >
                {w ? 'Drop wishlist' : '+ Wishlist'}
              </button>
            </>
          )}
        </div>
        <button className="dm-close" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

Object.assign(window, { ActivityDetailModal });
