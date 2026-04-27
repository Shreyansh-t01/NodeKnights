import { useState, useEffect } from "react";

export default function AuthPage({
  pending = false,
  error = null,
  loginForm = { username: "", password: "" },
  onLoginChange = () => {},
  onLoginSubmit = (e) => e.preventDefault(),
}) {
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 640);
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 900);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const features = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="white" fillOpacity="0.9"/>
          <path d="M9 12l2 2 4-4" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      title: "Risk Detection",
      desc: "ML models classify clauses and surface hidden exposure",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3" width="16" height="18" rx="2" fill="white" fillOpacity="0.9"/>
          <path d="M8 8h8M8 12h8M8 16h5" stroke="#1e40af" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
      title: "Clause Detection",
      desc: "AI identifies parties, obligations, and key entities",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" strokeOpacity="0.9"/>
          <path d="M16.5 16.5L21 21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9"/>
          <path d="M8 11h6M11 8v6" stroke="#1e40af" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
      title: "Smart Search",
      desc: "Semantic search across every contract you own",
    },
  ];

  // On mobile: show features as a compact horizontal scrollable row
  // On tablet/desktop: full vertical feature cards
  const isNarrow = isMobile || isTablet;

  return (
    <main style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: "relative",
      overflowX: "hidden",
      overflowY: "auto",
      background: "linear-gradient(120deg, #f0057a 0%, #c0157a 22%, #7b2fbe 52%, #1ab8c4 100%)",
      padding: isMobile ? "16px 12px 32px" : isTablet ? "24px 16px" : "32px 20px",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes fadein { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .nk-wrap { animation: fadein 0.45s cubic-bezier(.22,1,.36,1); }
        .nk-btn { transition: filter 0.2s, transform 0.15s; }
        .nk-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .nk-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(0.97); }
        .nk-google:hover { background: #f1f5f9 !important; }
        .nk-feature { transition: transform 0.18s, box-shadow 0.18s; }
        .nk-feature:hover { transform: translateY(-2px); }
        .nk-chips { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .nk-chips::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── BACKGROUND SVG ── */}
      <svg
        viewBox="0 0 1024 576"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="softblur3"><feGaussianBlur stdDeviation="2.5" /></filter>
        </defs>
        <ellipse cx="210" cy="310" rx="260" ry="230" fill="rgba(255,80,180,0.22)" />
        <ellipse cx="870" cy="290" rx="200" ry="200" fill="rgba(0,220,230,0.18)" />
        <g transform="translate(30,36)" opacity="0.4">
          <circle cx="200" cy="210" r="190" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" />
          <ellipse cx="200" cy="210" rx="95" ry="190" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
          <ellipse cx="200" cy="210" rx="190" ry="58" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
          <ellipse cx="200" cy="210" rx="190" ry="115" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
          <line x1="10" y1="210" x2="390" y2="210" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          <line x1="200" y1="20" x2="200" y2="400" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        </g>
        <g style={{ animation: "floatA 5s ease-in-out infinite" }}>
          <g transform="translate(55,360)">
            <polygon points="0,32 78,0 156,32 78,64" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
            <polygon points="0,32 0,54 78,86 78,64" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
            <polygon points="156,32 156,54 78,86 78,64" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
            <circle cx="78" cy="32" r="5" fill="#00e5ff" opacity="0.7" filter="url(#softblur3)" />
            <circle cx="78" cy="32" r="2.5" fill="white" />
          </g>
        </g>
        <g style={{ animation: "floatB 6.5s ease-in-out infinite 1.2s" }}>
          <g transform="translate(15,220)">
            <polygon points="0,22 56,0 112,22 56,44" fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <polygon points="0,22 0,38 56,60 56,44" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.9" />
            <polygon points="112,22 112,38 56,60 56,44" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.9" />
            <circle cx="56" cy="22" r="4" fill="#00e5ff" opacity="0.65" filter="url(#softblur3)" />
            <circle cx="56" cy="22" r="2" fill="white" />
          </g>
        </g>
        <g transform="translate(950,490)">
          <path d="M10,0 L12.2,7.8 L20,10 L12.2,12.2 L10,20 L7.8,12.2 L0,10 L7.8,7.8 Z" fill="rgba(255,255,255,0.7)" />
        </g>
      </svg>

      {/* ══════════════════════════════════════
          LAYOUT WRAPPER
          • Mobile  (<640px)  → single column, form first, features below
          • Tablet  (640-900) → single column, wider card
          • Desktop (>900px)  → two-column side by side
      ══════════════════════════════════════ */}
      <div
        className="nk-wrap"
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: isNarrow ? "column" : "row",
          alignItems: "stretch",
          width: "100%",
          maxWidth: isMobile ? "100%" : isTablet ? "560px" : "960px",
          borderRadius: isMobile ? "20px" : "28px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
        }}
      >

        {/* ════ LEFT / TOP PANEL — Marketing ════ */}
        {/* On mobile: appears BELOW the form. We use order to reorder. */}
        <div style={{
          flex: isNarrow ? "none" : "1 1 0",
          order: isMobile ? 2 : 1,
          background: "transparent",
          borderTop: isMobile ? "1px solid rgba(255,255,255,0.2)" : "none",
          borderRight: isNarrow ? "none" : "1px solid rgba(255,255,255,0.25)",
          padding: isMobile ? "24px 20px" : isTablet ? "32px 28px" : "48px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 0,
          borderRadius: isNarrow ? "0 0 20px 20px" : "28px 0 0 28px",
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.22)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 999,
            padding: "4px 12px",
            marginBottom: isMobile ? 16 : 24,
            alignSelf: "flex-start",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "white", letterSpacing: "0.04em" }}>
              ✦ AI-Powered Legal Intelligence
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: isMobile ? "22px" : isTablet ? "26px" : "clamp(24px,2.8vw,34px)",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.2,
            margin: `0 0 ${isMobile ? "10px" : "14px"}`,
            letterSpacing: "-0.4px",
          }}>
            Welcome back to<br />Smarter Contracts
          </h1>

          {/* Sub-copy — hide on smallest screens to save space */}
          {!isMobile && (
            <p style={{
              fontSize: isTablet ? 16 : 15,
              fontWeight: 700,
              color: "rgba(255,255,255,0.82)",
              lineHeight: 1.65,
              margin: `0 0 ${isTablet ? "20px" : "28px"}`,
            }}>
              Sign in to review clauses, detect risks, and turn fragmented legal data into actionable intelligence — in seconds.
            </p>
          )}

          {/* Feature cards — horizontal chips on mobile, vertical cards on desktop */}
          {isMobile ? (
            <div className="nk-chips">
              {features.map((f, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.16)",
                  border: "1px solid rgba(255,255,255,0.28)",
                  borderRadius: 12,
                  padding: "8px 12px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {f.icon}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "white" }}>{f.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {features.map((f, i) => (
                <div key={i} className="nk-feature" style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 14,
                  padding: isTablet ? "12px 14px" : "14px 18px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                }}>
                  <div style={{
                    width: isTablet ? 36 : 42,
                    height: isTablet ? 36 : 42,
                    borderRadius: 10,
                    background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 3px 10px rgba(59,130,246,0.4)",
                  }}>
                    {f.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: isTablet ? 13 : 14, fontWeight: 700, color: "white", margin: "0 0 2px" }}>{f.title}</p>
                    <p style={{ fontSize: isTablet ? 11.5 : 12.5, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ════ RIGHT / TOP PANEL — Login form ════ */}
        <div style={{
          flex: isNarrow ? "none" : "0 0 420px",
          order: isMobile ? 1 : 2,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          padding: isMobile ? "28px 20px 24px" : isTablet ? "36px 32px 32px" : "48px 40px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          borderRadius: isNarrow
            ? (isMobile ? "20px 20px 0 0" : "20px 20px 0 0")
            : "0 28px 28px 0",
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isMobile ? 20 : 26 }}>
            <svg width={isMobile ? 38 : 44} height={isMobile ? 38 : 44} viewBox="0 0 54 54" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="27" cy="27" r="27" fill="#0d2440" />
              <rect x="25" y="9" width="4" height="7" rx="2" fill="rgba(255,255,255,0.65)" />
              <circle cx="27" cy="9" r="3.2" fill="rgba(255,255,255,0.85)" />
              <rect x="13" y="19" width="28" height="20" rx="7" fill="white" fillOpacity="0.94" />
              <circle cx="21" cy="28" r="3.8" fill="#0b7a9e" />
              <circle cx="21" cy="28" r="1.7" fill="white" />
              <circle cx="33" cy="28" r="3.8" fill="#0b7a9e" />
              <circle cx="33" cy="28" r="1.7" fill="white" />
              <path d="M22 34.5 Q27 37.5 32 34.5" stroke="#0b7a9e" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              <rect x="4" y="23" width="9" height="11" rx="4.5" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
              <rect x="41" y="23" width="9" height="11" rx="4.5" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
              <path d="M18 17 Q22 12.5 27 15 Q32 17.5 36 13" stroke="#00c8e0" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </svg>
            <div>
              <p style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: "#111827", letterSpacing: "-0.3px", margin: 0 }}>LEXORA</p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "1px 0 0" }}>Secure Access</p>
            </div>
          </div>

          <h2 style={{
            fontSize: isMobile ? 24 : 28,
            fontWeight: 800, color: "#111827",
            margin: "0 0 3px", letterSpacing: "-0.5px",
          }}>Sign in</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: `0 0 ${isMobile ? "20px" : "24px"}` }}>
            Access your legal intelligence dashboard
          </p>

          {/* Error */}
          {error && (
            <p role="alert" style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "9px 13px",
              fontSize: 13, color: "#dc2626",
              marginBottom: 16,
            }}>{error}</p>
          )}

          {/* Form */}
          <form style={{ display: "flex", flexDirection: "column", gap: 16 }} onSubmit={onLoginSubmit}>

            {/* Email */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Email</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="4" width="20" height="16" rx="3" stroke="#9ca3af" strokeWidth="1.8"/>
                    <path d="M2 8l10 6 10-6" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="abc123@gmail.com"
                  value={loginForm.username}
                  onChange={(e) => onLoginChange("username", e.target.value)}
                  autoComplete="username"
                  required
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: "100%",
                    padding: "12px 13px 12px 38px",
                    fontSize: isMobile ? 15 : 14,
                    color: "#111827",
                    background: focusedField === "username" ? "white" : "#f8fafc",
                    border: `2px solid ${focusedField === "username" ? "#06b6d4" : "#e2e8f0"}`,
                    borderRadius: 11, outline: "none", fontFamily: "inherit",
                    boxShadow: focusedField === "username" ? "0 0 0 3px rgba(6,182,212,0.12)" : "none",
                    transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Password</label>
                <button type="button" style={{ background: "none", border: "none", fontSize: 12.5, fontWeight: 600, color: "#06b6d4", cursor: "pointer", padding: 0 }}>
                  Forget?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="#9ca3af" strokeWidth="1.8"/>
                    <path d="M8 11V7a4 4 0 018 0v4" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => onLoginChange("password", e.target.value)}
                  autoComplete="current-password"
                  required
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: "100%",
                    padding: "12px 42px 12px 38px",
                    fontSize: isMobile ? 15 : 14,
                    color: "#111827",
                    background: focusedField === "password" ? "white" : "#f8fafc",
                    border: `2px solid ${focusedField === "password" ? "#06b6d4" : "#e2e8f0"}`,
                    borderRadius: 11, outline: "none", fontFamily: "inherit",
                    boxShadow: focusedField === "password" ? "0 0 0 3px rgba(6,182,212,0.12)" : "none",
                    transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    display: "flex", alignItems: "center", color: "#9ca3af",
                    minWidth: 24, minHeight: 24,
                  }}
                >
                  {showPassword ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="nk-btn"
              disabled={pending}
              style={{
                width: "100%",
                padding: isMobile ? "15px" : "13px",
                fontSize: isMobile ? 16 : 15,
                fontWeight: 700,
                fontFamily: "inherit",
                color: "white",
                background: "linear-gradient(90deg,#10d9a8 0%,#06b6d4 100%)",
                border: "none",
                borderRadius: 12,
                cursor: pending ? "not-allowed" : "pointer",
                letterSpacing: "0.2px",
                boxShadow: "0 4px 18px rgba(6,182,212,0.38)",
                opacity: pending ? 0.65 : 1,
                marginTop: 2,
              }}
            >
              {pending ? "Signing In..." : "Sign in "}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: `${isMobile ? "16px" : "18px"} 0` }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          {/* Google */}
          <button
            type="button"
            className="nk-btn nk-google"
            style={{
              width: "100%",
              padding: isMobile ? "14px" : "12px",
              fontSize: isMobile ? 15 : 14,
              fontWeight: 600,
              fontFamily: "inherit",
              color: "#111827",
              background: "white",
              border: "1.5px solid #e2e8f0",
              borderRadius: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <svg width="19" height="19" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </main>
  );
}