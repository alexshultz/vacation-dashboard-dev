/* PullToRefresh.jsx — iOS-style pull-to-refresh for the SPA.
   Activates only when scrollY === 0. Minimal, non-blocking UX. */

const { useState: usePtrState, useEffect: usePtrEffect, useRef: usePtrRef } = React;

function PullToRefresh() {
  const [pullState, setPullState] = usePtrState({ pulling: false, y: 0, triggered: false });
  const touchRef = usePtrRef({ startY: 0, startScrollY: 0, tracking: false });
  const refreshingRef = usePtrRef(false);

  const TRIGGER_THRESHOLD = 80; // pixels
  const MAX_PULL = 120;

  usePtrEffect(() => {
    function onTouchStart(e) {
      if (refreshingRef.current) return;
      const scrollY = window.scrollY || window.pageYOffset;
      if (scrollY !== 0) return; // Only activate at top

      touchRef.current = {
        startY: e.touches[0].clientY,
        startScrollY: scrollY,
        tracking: true
      };
    }

    function onTouchMove(e) {
      const ref = touchRef.current;
      if (!ref.tracking || refreshingRef.current) return;

      const scrollY = window.scrollY || window.pageYOffset;
      const deltaY = e.touches[0].clientY - ref.startY;

      // If user scrolled down from top or is pulling down
      if (scrollY === 0 && deltaY > 0) {
        e.preventDefault(); // Prevent browser overscroll
        const pull = Math.min(deltaY * 0.5, MAX_PULL);
        setPullState({ pulling: true, y: pull, triggered: pull >= TRIGGER_THRESHOLD });
      }
    }

    async function onTouchEnd(e) {
      const ref = touchRef.current;
      if (!ref.tracking || refreshingRef.current) return;
      ref.tracking = false;

      if (pullState.triggered) {
        refreshingRef.current = true;
        setPullState({ pulling: true, y: TRIGGER_THRESHOLD, triggered: true });

        // Execute refresh
        const result = await window.BD_REFRESH_DATA();

        if (result.success) {
          // Fire custom event so Shell can update
          const event = new CustomEvent('bd:datarefreshed', { detail: { changed: result.changed } });
          window.dispatchEvent(event);
        }

        // Animate spinner away
        setTimeout(() => {
          setPullState({ pulling: false, y: 0, triggered: false });
          refreshingRef.current = false;
        }, 400);
      } else {
        // Snap back
        setPullState({ pulling: false, y: 0, triggered: false });
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullState]);

  if (!pullState.pulling && pullState.y === 0) return null;

  const spinnerY = pullState.y;
  const opacity = Math.min(1, pullState.y / TRIGGER_THRESHOLD);

  return (
    <div
      data-testid="ptr-spinner"
      style={{
        position: 'fixed',
        top: '64px',
        left: '50%',
        transform: `translate(-50%, ${spinnerY}px)`,
        opacity: opacity,
        transition: pullState.triggered && refreshingRef.current ? 'transform 0.2s ease-out' : 'none',
        pointerEvents: 'none',
        zIndex: 9999
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(0,0,0,0.1)',
          borderTopColor: '#333',
          borderRadius: '50%',
          animation: pullState.triggered ? 'ptr-spin 0.8s linear infinite' : 'none'
        }}
      />
    </div>
  );
}

// Inject keyframes for spinner animation
if (!document.getElementById('ptr-styles')) {
  const style = document.createElement('style');
  style.id = 'ptr-styles';
  style.textContent = `
    @keyframes ptr-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

Object.assign(window, { PullToRefresh });
