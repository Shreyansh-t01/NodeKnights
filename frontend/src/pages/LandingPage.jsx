import { useState, useEffect } from "react";

export default function LandingPage({ onGetStarted = () => { } }) {
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

  const isNarrow = isMobile || isTablet;

  const bottomFeatures = [
    {
      color: "#f97316",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="white" fillOpacity="0.9" />
          <path d="M9 12l2 2 4-4" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "Risk Detection",
      desc: "ML model analyze risk and classify clause",
    },
    {
      color: "#10b981",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" strokeOpacity="0.9" />
          <path d="M16.5 16.5L21 21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9" />
          <path d="M8 11h6M11 8v6" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
      title: "Smart Search",
      desc: "Semantic Search helps you to find anything",
    },
    {
      color: "#3b82f6",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3" width="16" height="18" rx="2" fill="white" fillOpacity="0.9" />
          <path d="M8 8h8M8 12h8M8 16h5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="17" cy="17" r="4" fill="#3b82f6" />
          <path d="M15.5 17l1 1 2-2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "Clause Detection",
      desc: "AI identifies Clause, parties and key entities",
    },
    {
      color: "#8b5cf6",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="white" fillOpacity="0.9" />
          <path d="M7 9h10M7 13h7" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="14" y="11" width="6" height="5" rx="1" fill="#8b5cf6" opacity="0.3" />
        </svg>
      ),
      title: "OCR Extraction",
      desc: "Extracts text from PDF, images and documents",
    },
  ];

  return (
    <main style={{
      minHeight: "100vh",
      width: "100%",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: "relative",
      overflowX: "hidden",
      overflowY: "auto",
      boxSizing: "border-box",
    }}>

      {/* ══════════════════════════════════
          PAGE CONTENT
      ══════════════════════════════════ */}
      <div style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        padding: isMobile ? "32px 16px 48px" : "48px 24px 64px",
      }}>

        {/* ── HERO SECTION ── */}
        <section
          className="lp-hero"
          style={{
            textAlign: "center",
            maxWidth: isMobile ? "100%" : "720px",
            width: "100%",
            padding: isMobile ? "0 0 40px" : "0 0 56px",
          }}
        >
          {/* Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.45)",
            borderRadius: 999,
            padding: "5px 16px",
            marginBottom: isMobile ? 20 : 28,
          }}>
            <span style={{
              fontSize: isMobile ? 11 : 12,
              fontWeight: 600,
              color: "white",
              letterSpacing: "0.04em",
            }}>
              AI-Powered Legal Intelligence
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: isMobile ? "26px" : isTablet ? "36px" : "52px",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.12,
            margin: "0 0 20px",
            letterSpacing: "-1px",
          }}>
            Transform Fragmented Contracts into Actionable Legal Intelligence
          </h1>

          {/* Sub-copy */}
          <p style={{
            fontSize: isMobile ? 14 : 16,
            fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.7,
            margin: "0 auto 32px",
            maxWidth: "520px",
          }}>
            Legal data is scattered across emails, PDFs, and drives —
            causing slow reviews, missed clauses, and hidden risks
          </p>

          {/* CTA Button */}
          <button
            className="lp-cta"
            onClick={onGetStarted}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.95)",
              border: "none",
              borderRadius: 999,
              padding: isMobile ? "13px 28px" : "15px 36px",
              fontSize: isMobile ? 15 : 16,
              fontWeight: 700,
              fontFamily: "inherit",
              color: "#7b2fbe",
              cursor: "pointer",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              letterSpacing: "-0.1px",
            }}
          >
            Get Started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </section>

        {/* ── TWO CARDS SECTION ── */}
        <section
          className="lp-cards"
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: isMobile ? 16 : 20,
            width: "100%",
            maxWidth: "900px",
            marginBottom: isMobile ? 16 : 20,
          }}
        >
          {/* ── Card 1: The Problem ── */}
          <div style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: isMobile ? "24px 20px" : "28px 28px 24px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{
              fontSize: isMobile ? 17 : 19,
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              margin: "0 0 12px",
            }}>
              The Problem
            </h2>
            <p style={{
              fontSize: 13.5,
              color: "rgba(255,255,255,0.75)",
              textAlign: "center",
              lineHeight: 1.65,
              margin: "0 0 24px",
            }}>
              Legal contracts are scattered across multiple platforms and formats, making review slow, expensive and error-prone
            </p>

            {/* Platform icons */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobile ? 10 : 16,
              marginBottom: 24,
              flexWrap: "wrap",
            }}>
              {/* Gmail */}
              <div style={{
                width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 14,
                background: "rgba(255,255,255,0.12)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="28" height="22" viewBox="0 0 256 193" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z" />
                  <path fill="#34A853" d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837-27.026 25.798z" />
                  <path fill="#EA4335" d="M58.182 93.14l-4.174-38.647 4.174-36.989L128 69.868l69.818-52.364 4.669 34.992-4.669 40.644L128 145.504z" />
                  <path fill="#FBBC04" d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945z" />
                  <path fill="#C5221F" d="M0 49.504l26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23z" />
                </svg>
              </div>

              {/* Google Drive */}
              <div style={{
                width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 14,
                background: "rgba(255,255,255,0.12)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="26" height="24" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#0066da" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H.97c0 1.55.4 3.1 1.2 4.5z" />
                  <path fill="#00ac47" d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.17 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.45z" />
                  <path fill="#ea4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85l5.87 11.2z" />
                  <path fill="#00832d" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" />
                  <path fill="#2684fc" d="M59.85 53H27.45L13.7 76.8c1.35.8 2.9 1.2 4.5 1.2h50.5c1.6 0 3.15-.45 4.5-1.2z" />
                  <path fill="#ffba00" d="M73.4 26.5L60.7 4.5C59.9 3.1 58.75 2 57.4 1.2L43.65 25l16.2 28H86.3c0-1.55-.4-3.1-1.2-4.5z" />
                </svg>
              </div>

              {/* PDF */}
              <div style={{
                width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 14,
                background: "rgba(239,68,68,0.15)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="26" height="30" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Page body */}
                  <rect x="1" y="1" width="16" height="22" rx="2.5" fill="#ef4444" />
                  {/* Folded corner */}
                  <path d="M12 1 L17 6 L12 6 Z" fill="#fca5a5" />
                  <path d="M12 1 L17 6" stroke="#ef4444" strokeWidth="0.5" />
                  {/* White lines */}
                  <path d="M4 10h10M4 13h10M4 16h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  {/* PDF badge */}
                  <rect x="0" y="19" width="18" height="8" rx="2" fill="#c82020" />
                  <text x="2" y="26" fontSize="5.5" fill="white" fontWeight="800" fontFamily="Arial, sans-serif" letterSpacing="0.3">PDF</text>
                </svg>
              </div>

              {/* Image / Gallery */}
              <div style={{
                width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 14,
                background: "rgba(22,163,74,0.15)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Frame */}
                  <rect x="2" y="3" width="20" height="18" rx="3" fill="#16a34a" />
                  {/* Sky area */}
                  <rect x="2" y="3" width="20" height="11" rx="3" fill="#22c55e" />
                  {/* Sun */}
                  <circle cx="17" cy="8" r="2.5" fill="#fde047" />
                  {/* Mountain / landscape */}
                  <path d="M2 17 L7 11 L11 15 L15 10 L22 17 L22 21 Q22 21 19 21 L5 21 Q2 21 2 21 Z" fill="#15803d" />
                  {/* Horizon overlap fix */}
                  <path d="M2 17 L7 11 L11 15 L15 10 L22 17" fill="none" stroke="#16a34a" strokeWidth="0.5" />
                </svg>
              </div>
            </div>

            {/* Result label */}
            <p style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#ef4444",
              margin: "0 0 10px",
            }}>
              Result
            </p>

            {/* Result chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Fragmented Data", "Slow review", "Risk"].map((tag) => (
                <span key={tag} style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  background: "rgba(255,255,255,0.08)",
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  whiteSpace: "nowrap",
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ── Card 2: Contract Insight Panel ── */}
          <div style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: isMobile ? "20px" : "24px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflow: "hidden",
          }}>
            {/* Contract header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingBottom: 14,
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(239,68,68,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="2" width="14" height="18" rx="2" fill="#ef4444" />
                  <path d="M6 10h8M6 13h8M6 16h5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#ffffff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Contract_1233.pdf</p>
                <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", margin: "2px 0 0" }}>Uploaded on 20 May 2025</p>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 0 }}>
              {[
                { label: "Clauses", value: "5", color: "#ffffff" },
                { label: "Parties", value: "8", color: "#ffffff" },
                { label: "Risk Score", value: "High", color: "#ef4444" },
              ].map((stat, i) => (
                <div key={i} style={{
                  flex: 1,
                  textAlign: i === 0 ? "left" : i === 2 ? "right" : "center",
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {stat.label}
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: stat.color, margin: 0 }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* AI Insights + Donut chart — FIXED: legend is now inside the card, no overflow */}
            <div style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "14px 16px",
            }}>
              {/* Top row: label + read more */}
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", margin: "0 0 3px" }}>AI insights</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: "0 0 6px", lineHeight: 1.5 }}>
                  Penalty clause is missing penalty safeguard
                </p>
                <button style={{
                  fontSize: 12, fontWeight: 700, color: "#3b82f6",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}>
                  Read More
                </button>
              </div>

              {/* Chart + legend row — fully self-contained, no negative positioning */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}>
                {/* Donut */}
                <div style={{ flexShrink: 0, width: 72, height: 72, position: "relative" }}>
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="26" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                    {/* High risk — 64% ≈ 103 of 163 */}
                    <circle cx="36" cy="36" r="26" fill="none" stroke="#ef4444" strokeWidth="10"
                      strokeDasharray="103 163" strokeDashoffset="0"
                      transform="rotate(-90 36 36)" />
                    {/* Medium risk — 20% ≈ 33 */}
                    <circle cx="36" cy="36" r="26" fill="none" stroke="#fbbf24" strokeWidth="10"
                      strokeDasharray="33 163" strokeDashoffset="-103"
                      transform="rotate(-90 36 36)" />
                    {/* Low risk — 16% ≈ 27 */}
                    <circle cx="36" cy="36" r="26" fill="none" stroke="#10b981" strokeWidth="10"
                      strokeDasharray="27 163" strokeDashoffset="-136"
                      transform="rotate(-90 36 36)" />
                  </svg>
                </div>

                {/* Legend — stacked vertically beside chart, no overflow */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  minWidth: 0,
                }}>
                  {[
                    { color: "#ef4444", label: "High risk", pct: "64%" },
                    { color: "#fbbf24", label: "Medium risk", pct: "20%" },
                    { color: "#10b981", label: "Low risk", pct: "16%" },
                  ].map((l) => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {l.label}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 400, marginLeft: "auto", paddingLeft: 6 }}>
                        {l.pct}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── BOTTOM FEATURE STRIP ── */}
        <section
          className="lp-bottom"
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: isMobile ? 10 : 14,
            width: "100%",
            maxWidth: "900px",
          }}
        >
          {bottomFeatures.map((f, i) => (
            <div
              key={i}
              className="lp-feat"
              style={{
                background: "rgba(255,255,255,0.22)",
                border: "1px solid rgba(255,255,255,0.38)",
                borderRadius: 16,
                padding: isMobile ? "14px 12px" : "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                minWidth: 0,
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${f.color}22`,
                border: `1.5px solid ${f.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 700,
                  color: "white",
                  margin: "0 0 4px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textShadow: "0 1px 3px rgba(0,0,0,0.25)",
                }}>
                  {f.title}
                </p>
                <p style={{
                  fontSize: isMobile ? 11.5 : 12.5,
                  color: "rgba(255,255,255,0.95)",
                  margin: 0,
                  lineHeight: 1.55,
                  wordBreak: "break-word",
                  textShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}