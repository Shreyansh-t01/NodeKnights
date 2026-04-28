import { useEffect, useRef, useState } from 'react';
import StatusPill from './StatusPill';

function mapVoiceRecognitionError(code = '') {
  switch (code) {
    case 'audio-capture': return 'No microphone was detected.';
    case 'network': return 'Connection lost. Please try again.';
    case 'not-allowed':
    case 'service-not-allowed': return 'Microphone access blocked.';
    case 'no-speech': return 'No speech was detected.';
    case 'language-not-supported': return 'Language not supported.';
    default: return 'Voice search error.';
  }
}

function buildSpokenReply(result, scopeLabel = '', fallbackError = '') {
  if (fallbackError) return fallbackError;
  const answer = result?.reasoning?.answer || '';
  const recommendations = (result?.reasoning?.recommendations || []).slice(0, 3);
  const parts = [];
  if (scopeLabel) parts.push(`Reply for ${scopeLabel}.`);
  if (answer) parts.push(answer);
  if (recommendations.length) parts.push(`Suggested steps: ${recommendations.join('. ')}.`);
  return parts.join(' ').trim();
}

function SearchWorkbench({
  query,
  pending,
  result,
  error,
  disabled,
  scopeLabel,
  onQueryChange,
  onSubmit,
}) {
  const recognitionRef = useRef(null);
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [voiceError, setVoiceError] = useState('');
  const recommendations = result?.reasoning?.recommendations || [];
  const supportingMatches = result?.reasoning?.supportingMatches || [];

  const SpeechRecognitionApi = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null;
  const voiceInputSupported = Boolean(SpeechRecognitionApi);
  const voiceOutputSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isListening = voiceStatus === 'listening';
  const isSpeaking = voiceStatus === 'speaking';
  const canSpeakReply = Boolean(error || result?.reasoning?.answer || recommendations.length);

  useEffect(() => (() => {
    if (recognitionRef.current) {
      if (typeof recognitionRef.current.abort === 'function') recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    if (voiceOutputSupported) window.speechSynthesis.cancel();
  }), [voiceOutputSupported]);

  const stopVoiceReply = () => {
    if (!voiceOutputSupported) return;
    window.speechSynthesis.cancel();
    setVoiceStatus('idle');
  };

  const speakReply = () => {
    if (!voiceOutputSupported) return;
    const spokenText = buildSpokenReply(result, scopeLabel, error);
    if (!spokenText) {
      setVoiceError('No answer to read aloud.');
      return;
    }
    window.speechSynthesis.cancel();
    setVoiceError('');
    setVoiceStatus('speaking');
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.onend = () => setVoiceStatus('idle');
    utterance.onerror = () => setVoiceStatus('idle');
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    if (!voiceInputSupported) return;

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setVoiceStatus('listening');
      setVoiceError('');
    };

    recognition.onerror = (event) => {
      setVoiceError(mapVoiceRecognitionError(event.error));
      setVoiceStatus('idle');
    };

    recognition.onend = () => {
      setVoiceStatus('idle');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onQueryChange(transcript);
      // Trigger search automatically on voice success
      setTimeout(() => {
        const fakeEvent = { preventDefault: () => { } };
        onSubmit(fakeEvent);
      }, 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleFormSubmit = (e) => {
    stopVoiceReply();
    onSubmit(e);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* ── SEARCH INPUT CARD ── */}
      <section className="panel" style={{
        padding: '32px',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow */}
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40%', height: '80%', background: 'radial-gradient(circle, rgba(0, 229, 255, 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className="eyebrow" style={{ color: 'var(--lex-cyan-glow)' }}>Semantic Intelligence</p>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', margin: '8px 0 24px', fontWeight: '800' }}>Search Workbench</h2>

          <form
            onSubmit={handleFormSubmit}
            style={{
              display: 'flex',
              gap: '12px',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
          >
            <input
              type="text"
              className="lex-input-glow"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                padding: '12px 20px',
                fontSize: '16px',
                outline: 'none'
              }}
              placeholder="Ask anything about your contracts..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              disabled={disabled || pending}
            />
            {voiceInputSupported && (
              <button
                type="button"
                onClick={handleVoiceToggle}
                className="lex-btn-secondary"
                style={{
                  background: isListening ? 'var(--lex-magenta)' : 'rgba(255,255,255,0.05)',
                  borderRadius: '14px',
                  width: '46px',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isListening ? '#fff' : 'rgba(255,255,255,0.5)',
                  padding: 0,
                  backdropFilter: 'blur(8px)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>
            )}
            <button
              type="submit"
              className="lex-btn-primary"
              disabled={disabled || pending || !query.trim()}
              style={{ padding: '0 24px', borderRadius: '14px', fontWeight: '800' }}
            >
              {pending ? 'Processing...' : 'Audit'}
            </button>
          </form>
          {(error || voiceError) && (
            <p style={{ color: 'var(--lex-magenta)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>
              {error || voiceError}
            </p>
          )}
        </div>
      </section>

      {/* ── RESULTS GRID ── */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>

          {/* Main Answer Area */}
          <section className="panel" style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '32px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <p className="eyebrow" style={{ color: 'var(--lex-cyan-glow)' }}>AI Analysis Reply</p>
              {voiceOutputSupported && canSpeakReply && (
                <button
                  type="button"
                  className="lex-btn-secondary"
                  onClick={() => isSpeaking ? stopVoiceReply() : speakReply()}
                  style={{ padding: '6px 14px', fontSize: '11px', color: isSpeaking ? 'var(--lex-cyan-glow)' : 'rgba(255,255,255,0.6)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                  {isSpeaking ? 'Mute AI' : 'Play Reply'}
                </button>
              )}
            </div>

            <p style={{
              fontSize: '1.25rem',
              color: '#fff',
              lineHeight: '1.7',
              margin: '0 0 24px',
              maxWidth: '800px',
              fontWeight: '700'
            }}>
              {result.reasoning?.answer || "Analysis complete. View recommendations below."}
            </p>

            {/* Recommendations Sub-cards */}
            {recommendations.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px', marginTop: '24px' }}>
                <p className="eyebrow" style={{ marginBottom: '16px' }}>Suggested Next Steps</p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {recommendations.map((rec, i) => (
                    <div key={i} style={{
                      padding: '12px 18px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: '13.5px',
                      fontWeight: '800'
                    }}>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Reference Cards */}
          {supportingMatches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Supporting Evidence</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {supportingMatches.map((match, i) => (
                  <div key={i} className="panel" style={{
                    padding: '24px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <p className="eyebrow" style={{ fontSize: '9px' }}>Match Score: {(match.score * 100).toFixed(0)}%</p>
                      <StatusPill status={match.riskLabel}>{match.riskLabel}</StatusPill>
                    </div>
                    <p style={{ color: '#fff', fontSize: '13.5px', lineHeight: '1.6', margin: '8px 0', fontWeight: '500' }}>
                      "{match.text}"
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '800' }}>
                      Source: {match.docTitle}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchWorkbench;
