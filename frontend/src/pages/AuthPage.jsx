import { useState } from "react";
 
export default function AuthPage({
  pending = false,
  error = null,
  loginForm = { username: "", password: "" },
  onLoginChange = () => {},
  onLoginSubmit = (e) => e.preventDefault(),
}) {
  const [focusedField, setFocusedField] = useState(null);
 
  return (
    <main style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(120deg, #f0057a 0%, #c0157a 22%, #7b2fbe 52%, #1ab8c4 100%)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes fadein { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .nk-card { animation: fadein 0.45s cubic-bezier(.22,1,.36,1); }
        .nk-btn:hover { filter: brightness(1.07); transform: translateY(-1px); }
        .nk-btn:active { transform: translateY(0); filter: brightness(0.97); }
        .nk-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none !important; filter: none !important; }
      `}</style>
 
      {/* ── BACKGROUND SCENE ── */}
      <svg
        viewBox="0 0 1024 576"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="softblur"><feGaussianBlur stdDeviation="2.5" /></filter>
        </defs>
 
        {/* Ambient glow blobs */}
        <ellipse cx="210" cy="310" rx="260" ry="230" fill="rgba(255,80,180,0.22)" />
        <ellipse cx="870" cy="290" rx="200" ry="200" fill="rgba(0,220,230,0.18)" />
 
        {/* Wireframe globe */}
        <g transform="translate(30, 36)" opacity="0.5">
          <circle cx="200" cy="210" r="190" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" />
          <ellipse cx="200" cy="210" rx="95" ry="190" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" />
          <ellipse cx="200" cy="210" rx="38" ry="190" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
          <ellipse cx="200" cy="210" rx="190" ry="58" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" />
          <ellipse cx="200" cy="210" rx="190" ry="115" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2" />
          <ellipse cx="200" cy="210" rx="190" ry="22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="10" y1="210" x2="390" y2="210" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
          <line x1="200" y1="20" x2="200" y2="400" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
        </g>
 
        {/* Isometric platforms */}
        <g style={{ animation: "floatA 5s ease-in-out infinite" }}>
          <g transform="translate(55, 360)">
            <polygon points="0,32 78,0 156,32 78,64" fill="rgba(255,255,255,0.17)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
            <polygon points="0,32 0,54 78,86 78,64" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            <polygon points="156,32 156,54 78,86 78,64" fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            <circle cx="78" cy="32" r="6" fill="#00e5ff" opacity="0.7" filter="url(#softblur)" />
            <circle cx="78" cy="32" r="3" fill="white" />
          </g>
        </g>
        <g style={{ animation: "floatB 6.5s ease-in-out infinite 1.2s" }}>
          <g transform="translate(15, 220)">
            <polygon points="0,22 56,0 112,22 56,44" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.48)" strokeWidth="1" />
            <polygon points="0,22 0,38 56,60 56,44" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.9" />
            <polygon points="112,22 112,38 56,60 56,44" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.9" />
            <circle cx="56" cy="22" r="4.5" fill="#00e5ff" opacity="0.65" filter="url(#softblur)" />
            <circle cx="56" cy="22" r="2.2" fill="white" />
          </g>
        </g>
        <g style={{ animation: "floatA 4.8s ease-in-out infinite 0.6s" }}>
          <g transform="translate(148, 270)">
            <polygon points="0,16 44,0 88,16 44,32" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.42)" strokeWidth="0.9" />
            <polygon points="0,16 0,28 44,44 44,32" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.27)" strokeWidth="0.8" />
            <polygon points="88,16 88,28 44,44 44,32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.27)" strokeWidth="0.8" />
          </g>
        </g>
        <g style={{ animation: "floatB 5.2s ease-in-out infinite 2s" }}>
          <g transform="translate(210, 415)">
            <polygon points="0,18 50,0 100,18 50,36" fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9" />
            <polygon points="0,18 0,32 50,50 50,36" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
            <polygon points="100,18 100,32 50,50 50,36" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
            <circle cx="50" cy="18" r="4" fill="#00e5ff" opacity="0.6" filter="url(#softblur)" />
            <circle cx="50" cy="18" r="2" fill="white" />
          </g>
        </g>
 
        {/* Floating chip cards */}
        <g transform="translate(28, 158)" opacity="0.72" style={{ animation: "floatA 4.2s ease-in-out infinite 0.4s" }}>
          <rect width="88" height="44" rx="9" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
          <rect x="9" y="9" width="30" height="5" rx="2.5" fill="rgba(255,255,255,0.55)" />
          <rect x="9" y="19" width="22" height="4" rx="2" fill="rgba(255,255,255,0.33)" />
          <rect x="9" y="29" width="14" height="4" rx="2" fill="rgba(255,255,255,0.22)" />
          <circle cx="72" cy="22" r="9" fill="rgba(0,229,255,0.2)" stroke="rgba(0,229,255,0.6)" strokeWidth="1" />
          <circle cx="72" cy="22" r="3.5" fill="#00e5ff" />
        </g>
        <g transform="translate(178, 138)" opacity="0.6" style={{ animation: "floatB 6s ease-in-out infinite 2.1s" }}>
          <rect width="70" height="36" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.38)" strokeWidth="0.9" />
          <rect x="8" y="8" width="24" height="4.5" rx="2.2" fill="rgba(255,255,255,0.48)" />
          <rect x="8" y="17" width="18" height="3.5" rx="1.75" fill="rgba(255,255,255,0.3)" />
          <rect x="8" y="25" width="12" height="3.5" rx="1.75" fill="rgba(255,255,255,0.22)" />
        </g>
 
        {/* Connection lines */}
        <line x1="149" y1="278" x2="71" y2="242" stroke="rgba(0,229,255,0.35)" strokeWidth="1" strokeDasharray="5 5" />
        <line x1="260" y1="433" x2="196" y2="286" stroke="rgba(0,229,255,0.28)" strokeWidth="1" strokeDasharray="5 5" />
        <line x1="133" y1="382" x2="71" y2="242" stroke="rgba(0,229,255,0.22)" strokeWidth="0.9" strokeDasharray="4 6" />
        <circle cx="71" cy="242" r="3.5" fill="rgba(0,229,255,0.85)" />
        <circle cx="149" cy="278" r="3" fill="rgba(0,229,255,0.7)" />
        <circle cx="260" cy="433" r="3" fill="rgba(0,229,255,0.7)" />
 
        {/* Sparkle stars */}
        <g transform="translate(950, 490)">
          <path d="M10,0 L12.2,7.8 L20,10 L12.2,12.2 L10,20 L7.8,12.2 L0,10 L7.8,7.8 Z" fill="rgba(255,255,255,0.75)" />
        </g>
        <g transform="translate(968, 118) scale(0.55)">
          <path d="M10,0 L12.2,7.8 L20,10 L12.2,12.2 L10,20 L7.8,12.2 L0,10 L7.8,7.8 Z" fill="rgba(255,255,255,0.5)" />
        </g>
      </svg>
 
      {/* ── LOGIN CARD ── */}
      <section
        className="nk-card"
        style={{
          position: "relative",
          zIndex: 10,
          background: "rgba(255,255,255,0.70)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1.5px solid rgba(255,255,255,0.65)",
          borderRadius: "24px",
          padding: "42px 40px 34px",
          width: "100%",
          maxWidth: "428px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)",
        }}
      >
        {/* Header: Robot + Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 26 }}>
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
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
            <p style={{ fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: "-0.4px", lineHeight: 1.2, margin: 0 }}>
              Lexora
            </p>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", margin: "2px 0 0" }}>
              Legal intelligence workspace
            </p>
          </div>
        </div>
 
        {/* Copy block */}
        <div style={{ marginBottom: 22 }}>
          <p style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#06b6d4",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}>
            Secure Workspace
          </p>
          <p style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#111827",
            letterSpacing: "-0.25px",
            lineHeight: 1.35,
            margin: "0 0 6px",
          }}>
            Sign in to your review desk.
          </p>
         
        </div>
 
        {/* Error message */}
        {error && (
          <p role="alert" style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "#dc2626",
            marginBottom: 14,
          }}>
            {error}
          </p>
        )}
 
        {/* Form */}
        <form
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
          onSubmit={onLoginSubmit}
        >
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", flexDirection: "column", gap: 6 }}>
            Username
            <input
              type="text"
              value={loginForm.username}
              onChange={(e) => onLoginChange("username", e.target.value)}
              autoComplete="username"
              required
              onFocus={() => setFocusedField("username")}
              onBlur={() => setFocusedField(null)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                fontSize: 14,
                color: "#111827",
                background: "white",
                border: `2px solid ${focusedField === "username" ? "#06b6d4" : "#bbf7f0"}`,
                borderRadius: 12,
                outline: "none",
                fontFamily: "inherit",
                boxShadow: focusedField === "username" ? "0 0 0 3px rgba(6,182,212,0.14)" : "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            />
          </label>
 
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", flexDirection: "column", gap: 6 }}>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => onLoginChange("password", e.target.value)}
              autoComplete="current-password"
              required
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                fontSize: 14,
                color: "#111827",
                background: "white",
                border: `2px solid ${focusedField === "password" ? "#06b6d4" : "#bbf7f0"}`,
                borderRadius: 12,
                outline: "none",
                fontFamily: "inherit",
                boxShadow: focusedField === "password" ? "0 0 0 3px rgba(6,182,212,0.14)" : "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            />
          </label>
 
          <button
            type="submit"
            className="nk-btn"
            disabled={pending}
            style={{
              marginTop: 4,
              width: "100%",
              padding: "14px",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              color: "white",
              background: "linear-gradient(90deg, #10d9a8 0%, #06b6d4 100%)",
              border: "none",
              borderRadius: 12,
              cursor: pending ? "not-allowed" : "pointer",
              letterSpacing: "0.15px",
              boxShadow: "0 4px 18px rgba(6,182,212,0.38)",
              transition: "filter 0.2s, transform 0.15s",
              opacity: pending ? 0.65 : 1,
            }}
          >
            {pending ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}