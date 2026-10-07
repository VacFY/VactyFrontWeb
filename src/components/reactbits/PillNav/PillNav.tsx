// React Bits — PillNav (https://reactbits.dev/components/pill-nav), adaptado para VacTy:
// etiquetas con contenido (contador de alertas), textos de accesibilidad en español,
// el menú móvil se cierra al elegir una opción y respeta "reducir movimiento".
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import './PillNav.css';

export type PillNavItem = {
  label: string;
  href: string;
  /** Contenido extra junto a la etiqueta (p. ej. un contador). */
  extra?: ReactNode;
  ariaLabel?: string;
};

export interface PillNavProps {
  logo: string;
  logoAlt?: string;
  logoText?: string;
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  initialLoadAnimation?: boolean;
}

const reducirMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const PillNav: React.FC<PillNavProps> = ({
  logo,
  logoAlt = '',
  logoText,
  items,
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#fff',
  pillColor = '#120F17',
  hoveredPillTextColor = '#120F17',
  pillTextColor,
  initialLoadAnimation = true,
}) => {
  const resolvedPillTextColor = pillTextColor ?? baseColor;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const circleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tlRefs = useRef<Array<gsap.core.Timeline | null>>([]);
  const activeTweenRefs = useRef<Array<gsap.core.Tween | null>>([]);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoTweenRef = useRef<gsap.core.Tween | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const navItemsRef = useRef<HTMLDivElement | null>(null);
  const logoRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle) => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement as HTMLElement;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        if (!w || !h) return;
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${originY}px` });

        const label = pill.querySelector<HTMLElement>('.pill-label');
        const white = pill.querySelector<HTMLElement>('.pill-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (white) gsap.set(white, { y: h + 12, opacity: 0 });

        const index = circleRefs.current.indexOf(circle);
        if (index === -1) return;

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);
        if (label) tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
        if (white) {
          gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
        }
        tlRefs.current[index] = tl;
      });
    };

    layout();
    window.addEventListener('resize', layout);
    document.fonts?.ready.then(layout).catch(() => {});

    const menu = mobileMenuRef.current;
    if (menu) gsap.set(menu, { visibility: 'hidden', opacity: 0, scaleY: 1 });

    if (initialLoadAnimation && !reducirMovimiento()) {
      const logoEl = logoRef.current;
      const navItems = navItemsRef.current;
      if (logoEl) {
        gsap.set(logoEl, { scale: 0 });
        gsap.to(logoEl, { scale: 1, duration: 0.6, ease });
      }
      if (navItems) {
        gsap.set(navItems, { width: 0, overflow: 'hidden' });
        gsap.to(navItems, { width: 'auto', duration: 0.6, ease, clearProps: 'overflow' });
      }
    }

    return () => window.removeEventListener('resize', layout);
  }, [items.length, ease, initialLoadAnimation]);

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: 'auto' });
  };

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, { duration: 0.2, ease, overwrite: 'auto' });
  };

  const handleLogoEnter = () => {
    const img = logoImgRef.current;
    if (!img || reducirMovimiento()) return;
    logoTweenRef.current?.kill();
    gsap.set(img, { rotate: 0 });
    logoTweenRef.current = gsap.to(img, { rotate: 360, duration: 0.2, ease, overwrite: 'auto' });
  };

  const setMobileMenu = (open: boolean) => {
    setIsMobileMenuOpen(open);
    const lines = hamburgerRef.current?.querySelectorAll('.hamburger-line');
    if (lines) {
      gsap.to(lines[0], { rotation: open ? 45 : 0, y: open ? 3 : 0, duration: 0.3, ease });
      gsap.to(lines[1], { rotation: open ? -45 : 0, y: open ? -3 : 0, duration: 0.3, ease });
    }
    const menu = mobileMenuRef.current;
    if (!menu) return;
    if (open) {
      gsap.set(menu, { visibility: 'visible' });
      gsap.fromTo(menu, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease, transformOrigin: 'top center' });
    } else {
      gsap.to(menu, {
        opacity: 0,
        y: 10,
        duration: 0.2,
        ease,
        onComplete: () => {
          gsap.set(menu, { visibility: 'hidden' });
        },
      });
    }
  };

  // Cerrar el menú móvil con Escape.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenu(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [isMobileMenuOpen]);

  const cssVars = {
    ['--base']: baseColor,
    ['--pill-bg']: pillColor,
    ['--hover-text']: hoveredPillTextColor,
    ['--pill-text']: resolvedPillTextColor,
  } as React.CSSProperties;

  return (
    <div className="pill-nav-container">
      <nav className={`pill-nav ${className}`} aria-label="Secciones" style={cssVars}>
        <Link className="pill-logo" to={items[0]?.href ?? '/'} aria-label={`${logoText ?? 'Inicio'}, inicio`} onMouseEnter={handleLogoEnter} ref={logoRef}>
          <img src={logo} alt={logoAlt} ref={logoImgRef} />
        </Link>
        {logoText && <span className="pill-logo-text">{logoText}</span>}

        <div className="pill-nav-items desktop-only" ref={navItemsRef}>
          <ul className="pill-list">
            {items.map((item, i) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`pill${activeHref === item.href ? ' is-active' : ''}`}
                  aria-label={item.ariaLabel}
                  aria-current={activeHref === item.href ? 'page' : undefined}
                  onMouseEnter={() => handleEnter(i)}
                  onMouseLeave={() => handleLeave(i)}
                  onFocus={() => handleEnter(i)}
                  onBlur={() => handleLeave(i)}
                >
                  <span className="hover-circle" aria-hidden="true" ref={(el) => void (circleRefs.current[i] = el)} />
                  <span className="label-stack">
                    <span className="pill-label">{item.label}</span>
                    <span className="pill-label-hover" aria-hidden="true">
                      {item.label}
                    </span>
                  </span>
                  {item.extra}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          className="mobile-menu-button mobile-only"
          onClick={() => setMobileMenu(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="menu-movil"
          ref={hamburgerRef}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </nav>

      <div id="menu-movil" className="mobile-menu-popover mobile-only" ref={mobileMenuRef} style={cssVars}>
        <ul className="mobile-menu-list">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={`mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`}
                aria-current={activeHref === item.href ? 'page' : undefined}
                tabIndex={isMobileMenuOpen ? undefined : -1}
                onClick={() => setMobileMenu(false)}
              >
                {item.label}
                {item.extra}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PillNav;
