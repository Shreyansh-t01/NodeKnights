import React, { useState, useEffect } from 'react';

const LxBackground = () => {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const update = () => setIsMobile(window.innerWidth < 640);
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: -1,
            overflow: 'hidden',
            background: "linear-gradient(135deg, #0b0d1a 0%, #12102e 22%, #1a1045 42%, #2d1b69 58%, #1e2a5e 74%, #0f3443 88%, #0c4a6e 100%)",
        }}>
            <style>{`
                @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
                @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
            `}</style>

            <svg
                viewBox="0 0 1024 576"
                preserveAspectRatio="xMidYMid slice"
                style={{ width: "100%", height: "100%", opacity: 0.9 }}
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <filter id="lpblur"><feGaussianBlur stdDeviation="2.5" /></filter>
                </defs>

                {/* Gradients/Blobs */}
                <ellipse cx="210" cy="290" rx="270" ry="240" fill="rgba(90,50,180,0.22)" />
                <ellipse cx="870" cy="280" rx="210" ry="210" fill="rgba(0,220,230,0.18)" />

                {/* Globe */}
                <g transform="translate(30,36)" opacity="0.5">
                    <circle cx="200" cy="200" r="190" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" />
                    <ellipse cx="200" cy="200" rx="95" ry="190" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" />
                    <ellipse cx="200" cy="200" rx="38" ry="190" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
                    <ellipse cx="200" cy="200" rx="190" ry="58" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" />
                    <ellipse cx="200" cy="200" rx="190" ry="112" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1.2" />
                    <ellipse cx="200" cy="200" rx="190" ry="20" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                    <line x1="10" y1="200" x2="390" y2="200" stroke="rgba(255,255,255,0.26)" strokeWidth="1" />
                    <line x1="200" y1="10" x2="200" y2="390" stroke="rgba(255,255,255,0.26)" strokeWidth="1" />
                </g>

                {/* Floating platforms */}
                <g style={{ animation: "floatA 5s ease-in-out infinite" }}>
                    <g transform="translate(55,360)">
                        <polygon points="0,32 78,0 156,32 78,64" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
                        <polygon points="0,32 0,54 78,86 78,64" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
                        <polygon points="156,32 156,54 78,86 78,64" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
                        <circle cx="78" cy="32" r="5" fill="#00e5ff" opacity="0.7" filter="url(#lpblur)" />
                        <circle cx="78" cy="32" r="2.5" fill="white" />
                    </g>
                </g>
                <g style={{ animation: "floatB 6.5s ease-in-out infinite 1.2s" }}>
                    <g transform="translate(15,220)">
                        <polygon points="0,22 56,0 112,22 56,44" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.44)" strokeWidth="1" />
                        <polygon points="0,22 0,38 56,60 56,44" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.26)" strokeWidth="0.9" />
                        <polygon points="112,22 112,38 56,60 56,44" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.26)" strokeWidth="0.9" />
                        <circle cx="56" cy="22" r="4" fill="#00e5ff" opacity="0.65" filter="url(#lpblur)" />
                        <circle cx="56" cy="22" r="2" fill="white" />
                    </g>
                </g>
                <g style={{ animation: "floatA 4.8s ease-in-out infinite 0.6s" }}>
                    <g transform="translate(148,268)">
                        <polygon points="0,16 44,0 88,16 44,32" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9" />
                        <polygon points="0,16 0,28 44,44 44,32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.24)" strokeWidth="0.8" />
                        <polygon points="88,16 88,28 44,44 44,32" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.24)" strokeWidth="0.8" />
                    </g>
                </g>
                <g style={{ animation: "floatB 5.2s ease-in-out infinite 2s" }}>
                    <g transform="translate(210,415)">
                        <polygon points="0,18 50,0 100,18 50,36" fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.38)" strokeWidth="0.9" />
                        <polygon points="0,18 0,32 50,50 50,36" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" />
                        <polygon points="100,18 100,32 50,50 50,36" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" />
                        <circle cx="50" cy="18" r="4" fill="#00e5ff" opacity="0.6" filter="url(#lpblur)" />
                        <circle cx="50" cy="18" r="2" fill="white" />
                    </g>
                </g>

                {/* Chip cards */}
                <g transform="translate(28,155)" opacity="0.65" style={{ animation: "floatA 4.2s ease-in-out infinite 0.4s" }}>
                    <rect width="88" height="44" rx="9" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
                    <rect x="9" y="9" width="30" height="5" rx="2.5" fill="rgba(255,255,255,0.55)" />
                    <rect x="9" y="19" width="22" height="4" rx="2" fill="rgba(255,255,255,0.33)" />
                    <rect x="9" y="29" width="14" height="4" rx="2" fill="rgba(255,255,255,0.22)" />
                    <circle cx="72" cy="22" r="9" fill="rgba(0,229,255,0.2)" stroke="rgba(0,229,255,0.6)" strokeWidth="1" />
                    <circle cx="72" cy="22" r="3.5" fill="#00e5ff" />
                </g>

                {/* Connector lines */}
                <line x1="149" y1="276" x2="71" y2="240" stroke="rgba(0,229,255,0.32)" strokeWidth="1" strokeDasharray="5 5" />
                <line x1="260" y1="433" x2="196" y2="284" stroke="rgba(0,229,255,0.26)" strokeWidth="1" strokeDasharray="5 5" />

                {/* Sparkles */}
                <g transform="translate(950,490)">
                    <path d="M10,0 L12.2,7.8 L20,10 L12.2,12.2 L10,20 L7.8,12.2 L0,10 L7.8,7.8 Z" fill="rgba(255,255,255,0.75)" />
                </g>
            </svg>

            {/* Retro Grid Background */}
            {!isMobile && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(ellipse at 50% 50%, black, transparent 80%)',
                    opacity: 0.4
                }} />
            )}
        </div>
    );
};

export default LxBackground;
