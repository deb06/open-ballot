'use strict';

/* ==========================================================================
   Open Ballot — Animation library (vanilla JS, no build step)
   Inspired by: Animaster Lib (scroll/page/mouse/hero/WebGL animations),
                Skiper UI (shadcn-style hover + motion components),
                Vengeance UI (liquid buttons, stats counters, staggered text)
   All effects implemented in vanilla CSS + JS — zero dependencies.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Configuration
   -------------------------------------------------------------------------- */

const ANIM = {
  duration: 0.65,
  ease: [0.23, 1, 0.32, 1],   // smooth ease-out
  easeBack: [0.34, 1.56, 0.64, 1],
  stagger: 0.08,
};

/* --------------------------------------------------------------------------
   Scroll reveal (Intersection Observer) — Animaster "Scroll Animations"
   -------------------------------------------------------------------------- */

const revealed = new WeakSet();

function observeReveals() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !revealed.has(entry.target)) {
        revealed.add(entry.target);
        const delay = parseFloat(entry.target.dataset.animDelay || '0');
        const kind = entry.target.dataset.animKind || 'fade-up';
        setTimeout(() => {
          entry.target.classList.add('anim-in');
          entry.target.classList.add(`anim-${kind}`);
        }, delay * 1000);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('[data-anim]').forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Magnetic buttons — Vengeance/Skiper style hover pull
   -------------------------------------------------------------------------- */

function initMagnetic() {
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    let raf = null;
    const update = (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.35}px, ${y * 0.35}px)`;
    };
    btn.addEventListener('mousemove', (e) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => update(e));
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}

/* --------------------------------------------------------------------------
   Stats counter — Vengeance "Animated Number" / "Stats Counter"
   -------------------------------------------------------------------------- */

function initCounters() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.dataset.counted === '1') return;
      const target = parseInt(el.dataset.countTo || el.textContent, 10) || 0;
      const duration = parseFloat(el.dataset.countDuration || '1.2');
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / (duration * 1000), 1);
        const eased = p < 0.5 ? 4 * p * p * p : (p - 1) * (2 * p - 2) * (2 * p - 2) + 1;
        const value = Math.floor(eased * target);
        el.textContent = value.toLocaleString();
        if (p >= 1) {
          el.textContent = target.toLocaleString();
          el.dataset.counted = '1';
          io.unobserve(el);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      el.dataset.counted = '1';
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count-to]').forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Staggered children reveal — Motion Primitives pattern
   -------------------------------------------------------------------------- */

function initStaggerChildren() {
  document.querySelectorAll('[data-stagger-children]').forEach((parent) => {
    const children = Array.from(parent.children).filter((c) => c.style.display !== 'none');
    children.forEach((child, i) => {
      child.style.opacity = '0';
      child.style.transform = 'translateY(12px)';
      child.style.transition = `all 0.5s cubic-bezier(${ANIM.ease.join(',')}) ${i * ANIM.stagger}s`;
    });

    if (!('IntersectionObserver' in window)) {
      children.forEach((c) => {
        c.style.opacity = '1';
        c.style.transform = 'translateY(0)';
      });
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          children.forEach((c) => {
            c.style.opacity = '1';
            c.style.transform = 'translateY(0)';
          });
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    io.observe(parent);
  });
}

function initStaggerText() {
  document.querySelectorAll('[data-stagger]').forEach((el) => {
    const text = el.textContent.trim();
    el.textContent = '';
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.style.display = 'inline-block';
      span.style.opacity = '0';
      span.style.transform = 'translateY(20px)';
      span.style.transition = `all 0.5s cubic-bezier(${ANIM.ease.join(',')}) ${i * ANIM.stagger}s`;
      el.appendChild(span);
    });

    if (!('IntersectionObserver' in window)) {
      [...el.children].forEach((c, i) => {
        c.style.opacity = '1';
        c.style.transform = 'translateY(0)';
      });
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          [...el.children].forEach((c) => {
            c.style.opacity = '1';
            c.style.transform = 'translateY(0)';
          });
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    io.observe(el);
  });
}

/* --------------------------------------------------------------------------
   Card hover lift + glow — Skiper/Vengeance card style
   -------------------------------------------------------------------------- */

function initCardHover() {
  document.querySelectorAll('[data-card-hover]').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

/* --------------------------------------------------------------------------
   Page transitions — Animaster "Page Transitions"
   -------------------------------------------------------------------------- */

let pageOverlay = null;

function ensurePageOverlay() {
  if (pageOverlay) return pageOverlay;
  pageOverlay = document.createElement('div');
  pageOverlay.className = 'page-overlay';
  pageOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: none;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    border: 1px solid var(--line);
  `;
  pageOverlay.innerHTML = `
    <div class="page-spinner" style="
      width: 40px; height: 40px;
      border: 3px solid var(--line);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: pageSpin 0.8s linear infinite;
    "></div>
  `;
  document.body.appendChild(pageOverlay);
  return pageOverlay;
}

function startPageTransition() {
  const ov = ensurePageOverlay();
  ov.style.display = 'flex';
  ov.style.opacity = '0';
  ov.style.transition = 'opacity 0.25s ease';
  requestAnimationFrame(() => { ov.style.opacity = '1'; });
}

function endPageTransition() {
  const ov = pageOverlay;
  if (!ov) return;
  ov.style.opacity = '0';
  setTimeout(() => { ov.style.display = 'none'; }, 250);
}

/* --------------------------------------------------------------------------
   Cursor follower — Animaster "Mouse Effects"
   -------------------------------------------------------------------------- */

function initCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const cursor = document.createElement('div');
  cursor.className = 'ob-cursor';
  cursor.style.cssText = `
    position: fixed;
    width: 20px; height: 20px;
    border: 1.5px solid var(--accent);
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
    display: none;
    transform: translate(-50%, -50%);
    transition: width 0.2s ease, height 0.2s ease, background 0.2s ease;
    mix-blend-mode: difference;
  `;
  document.body.appendChild(cursor);

  let mouseX = 0, mouseY = 0;
  let curX = 0, curY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.display = 'block';
  });

  const animate = () => {
    curX += (mouseX - curX) * 0.15;
    curY += (mouseY - curY) * 0.15;
    cursor.style.left = curX + 'px';
    cursor.style.top = curY + 'px';
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  // Grow on interactive elements
  document.addEventListener('mouseover', (e) => {
    if (e.target.matches('a, button, [role="button"], input, select, textarea, [data-cursor]')) {
      cursor.style.width = '44px';
      cursor.style.height = '44px';
      cursor.style.background = 'rgba(217, 164, 65, 0.15)';
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.matches('a, button, [role="button"], input, select, textarea, [data-cursor]')) {
      cursor.style.width = '20px';
      cursor.style.height = '20px';
      cursor.style.background = 'transparent';
    }
  });
}

/* --------------------------------------------------------------------------
   Parallax background — Animaster "Background Animations"
   -------------------------------------------------------------------------- */

function initParallax() {
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const speed = parseFloat(el.dataset.parallaxSpeed || '0.15');
    window.addEventListener('scroll', () => {
      const offset = window.pageYOffset * speed;
      el.style.transform = `translateY(${offset}px)`;
    });
  });
}

/* --------------------------------------------------------------------------
   Liquid button hover — Vengeance "Liquid Button"
   -------------------------------------------------------------------------- */

function initLiquidButtons() {
  document.querySelectorAll('[data-liquid]').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      btn.classList.add('liquid-active');
    });
    btn.addEventListener('mouseleave', () => {
      btn.classList.remove('liquid-active');
    });
  });
}

/* --------------------------------------------------------------------------
   Glassmorphism cards — Skiper UI "Glass Dock" style
   -------------------------------------------------------------------------- */

function initGlassCards() {
  document.querySelectorAll('[data-glass]').forEach((card) => {
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 20px 40px -10px rgba(0, 0, 0, 0.4)';
      card.style.borderColor = 'rgba(217, 164, 65, 0.4)';
      card.style.transform = 'translateY(-4px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '';
      card.style.borderColor = '';
      card.style.transform = '';
    });
  });
}

/* --------------------------------------------------------------------------
   Hover reveal overlay — Vengeance UI "Image Reveal" style
   -------------------------------------------------------------------------- */

function initHoverReveal() {
  document.querySelectorAll('[data-hover-reveal]').forEach((el) => {
    const overlay = el.querySelector('[data-hover-reveal-overlay]');
    if (!overlay) return;
    el.addEventListener('mouseenter', () => {
      overlay.style.opacity = '1';
      overlay.style.transform = 'translateY(0)';
    });
    el.addEventListener('mouseleave', () => {
      overlay.style.opacity = '0';
      overlay.style.transform = 'translateY(100%)';
    });
  });
}

/* --------------------------------------------------------------------------
   Flip card — Skiper UI card stack style
   -------------------------------------------------------------------------- */

function initFlipCards() {
  document.querySelectorAll('[data-flip-card]').forEach((card) => {
    const front = card.querySelector('[data-flip-front]');
    const back = card.querySelector('[data-flip-back]');
    if (!front || !back) return;
    card.addEventListener('click', () => {
      const flipped = card.classList.toggle('flipped');
      front.style.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0)';
      back.style.transform = flipped ? 'rotateY(0)' : 'rotateY(-180deg)';
    });
  });
}

/* --------------------------------------------------------------------------
   Elastic text marquee — Vengeance UI "Magnetic Spotlight Marquee"
   -------------------------------------------------------------------------- */

function initElasticMarquee() {
  document.querySelectorAll('[data-marquee]').forEach((el) => {
    const content = el.innerHTML;
    el.innerHTML = '';
    const track = document.createElement('div');
    track.style.cssText = 'display: flex; gap: 40px; will-change: transform; animation: marquee 20s linear infinite;';
    track.innerHTML = content + content;
    el.appendChild(track);
  });
}

/* --------------------------------------------------------------------------
   Glow border — Vengeance UI "Glow Border Card"
   -------------------------------------------------------------------------- */

function initGlowBorders() {
  document.querySelectorAll('[data-glow-border]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      el.style.boxShadow = '0 0 24px rgba(217, 164, 65, 0.35)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.boxShadow = '';
    });
  });
}

/* --------------------------------------------------------------------------
   Cursor spotlight — Vengeance UI "Spotlight Navbar"
   -------------------------------------------------------------------------- */

function initCursorSpotlight() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const spotlight = document.createElement('div');
  spotlight.className = 'ob-spotlight';
  spotlight.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9998;
    pointer-events: none;
    display: none;
    mix-blend-mode: overlay;
    background: radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(217, 164, 65, 0.15), transparent 60%);
    transition: transform 0.1s ease;
  `;
  document.body.appendChild(spotlight);
  let mx = 0, my = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    spotlight.style.display = 'block';
  });
  const animate = () => {
    cx += (mx - cx) * 0.15;
    cy += (my - cy) * 0.15;
    spotlight.style.setProperty('--mx', cx + 'px');
    spotlight.style.setProperty('--my', cy + 'px');
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

/* --------------------------------------------------------------------------
   Smooth reveal on scroll — additional scroll reveal variants
   -------------------------------------------------------------------------- */

function observeAdditionalReveals() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !revealed.has(entry.target)) {
        revealed.add(entry.target);
        const delay = parseFloat(entry.target.dataset.animDelay || '0');
        const kind = entry.target.dataset.animKind || 'fade-up';
        setTimeout(() => {
          entry.target.classList.add('anim-in');
          entry.target.classList.add(`anim-${kind}`);
        }, delay * 1000);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });
  document.querySelectorAll('[data-anim]').forEach((el) => io.observe(el));
}

/* --------------------------------------------------------------------------
   Initialize all animations (extended)
   -------------------------------------------------------------------------- */

function initAnimations() {
  observeReveals();
  observeAdditionalReveals();
  initMagnetic();
  initCounters();
  initStaggerText();
  initStaggerChildren();
  initCardHover();
  initGlassCards();
  initHoverReveal();
  initFlipCards();
  initElasticMarquee();
  initGlowBorders();
  initCursor();
  initCursorSpotlight();
  initParallax();
  initLiquidButtons();
}

// Re-run reveals after route change
function refreshReveals() {
  revealed.clear();
  observeReveals();
  observeAdditionalReveals();
  initCounters();
  initStaggerText();
  initStaggerChildren();
}

window.OpenBallotAnim = {
  init: initAnimations,
  refresh: refreshReveals,
  startPageTransition,
  endPageTransition,
};
