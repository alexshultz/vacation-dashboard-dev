/* loader.js — Branson '26 SPA data loader.
   Runs as a plain <script> (no module, no bundler). Populates all BD_* globals
   then boots React by fetching + Babel-compiling each JSX file in order. */

(function () {
  'use strict';

  const SUPABASE_URL     = 'https://quebfbvfuwbncpexlylu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_yLlf7qoMZMfiZhNsyudX7g_HnZ8clgt';

  // ── helpers ──────────────────────────────────────────────────────────────

  function priceTier(price) {
    if (price === null || price === undefined) return '$';
    if (price <= 15) return '$';
    if (price <= 30) return '$$';
    return '$$$';
  }

  function firstSentence(desc) {
    if (!desc) return '';
    const s = desc.split('. ');
    return s[0] + (s.length > 1 ? '.' : '');
  }

  function addHours(time, hours) {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + Math.round((hours || 1) * 60);
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const TRIP_START_MS = new Date('2026-05-22T12:00:00').getTime();

  // ── A. Attractions → window.BD_ACTIVITIES ────────────────────────────────

  function buildActivities(attractions) {
    return attractions
      .filter(function (a) { return a.visible === true; })
      .map(function (a) {
        return {
          id:      a.slug,
          name:    a.name,
          hook:    firstSentence(a.description),
          tags:    a.tags || [],
          drive:   a.drive || '15 min',
          price:   priceTier(a.price_adult),
          rating:  a.rating,
          thumb:   a.image || ('assets/thumbs/' + a.slug + '-thumb.jpg'),
          wish:    [],
          commit:  [],
          locked:  false
        };
      });
  }

  // ── B. Schedule → window.BD_SCHEDULE ─────────────────────────────────────

  function buildSchedule(events) {
    var byDate = {};
    events.forEach(function (ev) {
      if (!byDate[ev.date]) byDate[ev.date] = [];
      byDate[ev.date].push(ev);
    });

    return Object.keys(byDate).sort().map(function (date) {
      var d = new Date(date + 'T12:00:00');
      var diffDays = Math.round((d.getTime() - TRIP_START_MS) / 86400000);
      var dayEvents = byDate[date]
        .slice()
        .sort(function (a, b) {
          return (a.startTime || '').localeCompare(b.startTime || '');
        })
        .map(function (ev) {
          var start = ev.startTime || '09:00';
          return {
            id:         ev.id,
            start:      start,
            end:        addHours(start, ev.duration),
            title:      ev.title,
            type:       ev.event_type || 'open',
            sub:        ev.sub || null,
            activityId: ev.catalogRef || null
          };
        });

      return {
        date:   date,
        day:    DAY_NAMES[d.getDay()],
        dayNum: d.getDate(),
        events: dayEvents
      };
    });
  }

  // ── C. People → window.BD_PEOPLE ─────────────────────────────────────────

  function buildPeople(attendees) {
    return attendees.map(function (p) {
      return {
        id:    p.display_name.toLowerCase().trim(),
        name:  p.display_name,
        age:   p.age,
        admin: p.display_name === 'Alex'
      };
    });
  }

  // ── D. Supabase hydration ─────────────────────────────────────────────────

  function hydratePicks(picks) {
    (picks || []).forEach(function (pick) {
      var activity = window.BD_ACTIVITIES.find(function (a) {
        return a.id.toLowerCase() === (pick.slug || '').toLowerCase();
      });
      if (!activity) return;
      var userId = (pick.user_id || '').toLowerCase();
      if (pick.state === 'wishlist') {
        if (!activity.wish.includes(userId)) activity.wish.push(userId);
      } else if (pick.state === 'committing') {
        if (!activity.commit.includes(userId)) activity.commit.push(userId);
      } else if (pick.state === 'both') {
        if (!activity.wish.includes(userId)) activity.wish.push(userId);
        if (!activity.commit.includes(userId)) activity.commit.push(userId);
      }
    });
  }

  // ── BD_GET_USER_ACTIVITIES — used by Interests.jsx ────────────────────────

  window.BD_GET_USER_ACTIVITIES = function (userId) {
    var all = window.BD_ACTIVITIES || [];
    return {
      wishlisted: all.filter(function (a) { return a.wish.includes(userId); }),
      committed:  all.filter(function (a) { return a.commit.includes(userId); })
    };
  };

  // ── E. React boot ─────────────────────────────────────────────────────────

  var JSX_FILES = [
    'tweaks-panel.jsx',
    'Cards.jsx',
    'DetailModal.jsx',
    'Home.jsx',
    'Activities.jsx',
    'Interests.jsx',
    'Timeline.jsx',
    'Profile.jsx',
    'Shell.jsx',
    'Tweaks.jsx'
  ];

  function evalJSX(src) {
    var code = Babel.transform(src, { presets: ['react'] }).code;
    var script = document.createElement('script');
    script.text = code;
    document.body.appendChild(script);
  }

  async function loadJSXFiles() {
    for (var i = 0; i < JSX_FILES.length; i++) {
      try {
        var res = await fetch(JSX_FILES[i]);
        var src = await res.text();
        evalJSX(src);
      } catch (e) {
        console.error('Failed to load', JSX_FILES[i], e);
      }
    }
  }

  async function boot() {
    try {
      // Fetch all data sources concurrently
      var [actResp, schedResp, peopleResp] = await Promise.all([
        fetch('data.json'),
        fetch('schedule.json'),
        fetch('people.json')
      ]);

      var [actData, schedData, peopleData] = await Promise.all([
        actResp.json(),
        schedResp.json(),
        peopleResp.json()
      ]);

      // Populate globals before Supabase (pick hydration mutates BD_ACTIVITIES)
      window.BD_ACTIVITIES = buildActivities(actData.attractions);
      window.BD_SCHEDULE   = buildSchedule(schedData.events);
      window.BD_SCHEDULED_IDS = new Set(
        (window.BD_SCHEDULE || []).flatMap(function(day) { return day.events; })
          .filter(function(ev) { return ev.activityId && ev.type !== 'meal' && ev.type !== 'travel'; })
          .map(function(ev) { return ev.activityId; })
      );
      console.log('[loader] BD_SCHEDULED_IDS:', [...window.BD_SCHEDULED_IDS]);
      window.BD_PEOPLE     = buildPeople(peopleData.attendees);
      window.BD_INITIAL_USER = null;

      // Back-propagate locked state from committed-lock events to activities
      for (var i = 0; i < window.BD_SCHEDULE.length; i++) {
        var day = window.BD_SCHEDULE[i];
        for (var j = 0; j < day.events.length; j++) {
          var event = day.events[j];
          if (event.type === 'committed-lock' && event.activityId != null) {
            var activity = window.BD_ACTIVITIES.find(function(a) { return a.id === event.activityId; });
            if (activity) activity.locked = true;
          }
        }
      }

      // Supabase client
      var picks = [];
      try {
        window.BD_SUPABASE = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        var result = await window.BD_SUPABASE
          .from('picks')
          .select('user_id, slug, state');
        picks = result.data || [];
      } catch (e) {
        console.warn('Supabase unavailable, starting with empty picks:', e);
      }

      hydratePicks(picks);

      // Remove loading indicator
      var loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.remove();

      // Load and execute JSX files in order
      await loadJSXFiles();

    } catch (e) {
      console.error('Boot failed:', e);
      var loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.textContent = 'Error loading dashboard. Please refresh.';
    }
  }

  boot();
})();
