import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthShellProps {
  mode: "login" | "signup" | "forgot" | "reset";
  formTitle: string;
  formSubtitle: string;
  visualTitle: string;
  visualSubtitle: string;
  children: ReactNode;
}

export function AuthShell({
  mode,
  formTitle,
  formSubtitle,
  visualTitle,
  visualSubtitle,
  children
}: AuthShellProps) {
  const showAuthTabs = mode === "login" || mode === "signup";
  const slides = useMemo(
    () => [
      {
        title: visualTitle,
        subtitle: visualSubtitle,
        toneClass: "slide-primary"
      },
      {
        title: "Forecast Your Next Move.",
        subtitle: "Watch upcoming expenses, expected balance trends, and safer monthly spending decisions in one view.",
        toneClass: "slide-forecast"
      },
      {
        title: "Turn Transactions Into Signals.",
        subtitle: "Use reports, rules, and health insights to understand patterns instead of just recording numbers.",
        toneClass: "slide-insights"
      }
    ],
    [visualSubtitle, visualTitle]
  );
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setActiveSlide(0);
  }, [mode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  const currentSlide = slides[activeSlide];

  return (
    <main className="auth-shell auth-shell-v2">
      <div className="auth-panel-v2">
        <section className="auth-form-panel">
          <div className="auth-brand-v2">
            <span className="auth-brand-icon-wrap" aria-hidden="true">
              <img src="/favicon.svg" alt="" className="auth-brand-icon" />
            </span>
            <span className="auth-brand-copy">
              <span className="auth-brand-title">Personal Finance</span>
              <span className="auth-brand-subtitle">Tracker V2</span>
            </span>
          </div>

          {showAuthTabs ? (
            <div className="auth-tabs-v2">
              <Link to="/login" className={mode === "login" ? "active" : ""}>Log In</Link>
              <Link to="/signup" className={mode === "signup" ? "active" : ""}>Sign Up</Link>
            </div>
          ) : (
            <div className="auth-tabs-v2 auth-tabs-static">
              <span className="active">{mode === "forgot" ? "Forgot Password" : "Reset Password"}</span>
            </div>
          )}

          <div className="auth-copy-v2">
            <h1>{formTitle}</h1>
            <p>{formSubtitle}</p>
          </div>

          <div className="auth-form-slot">{children}</div>
        </section>

        <section className={`auth-visual-panel ${currentSlide.toneClass}`}>
          <div className="auth-blob auth-blob-top" aria-hidden="true" />
          <div className="auth-blob auth-blob-bottom" aria-hidden="true" />
          <div className="auth-leaf auth-leaf-one" aria-hidden="true" />
          <div className="auth-leaf auth-leaf-two" aria-hidden="true" />
          <div className="auth-leaf auth-leaf-three" aria-hidden="true" />

          <div className={`auth-device-scene ${currentSlide.toneClass}`} aria-hidden="true">
            <div className="auth-screen-shadow" />
            <div className="auth-monitor">
              <div className="auth-monitor-frame">
                <div className="auth-monitor-bars">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="auth-monitor-chart">
                  <span />
                </div>
              </div>
              <div className="auth-monitor-stand" />
            </div>
            <div className="auth-person" />
          </div>

          <div className="auth-visual-copy">
            <h2>{currentSlide.title}</h2>
            <p>{currentSlide.subtitle}</p>
            <div className="auth-visual-dots">
              {slides.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  className={index === activeSlide ? "active" : ""}
                  aria-label={`Show slide ${index + 1}`}
                  onClick={() => setActiveSlide(index)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
