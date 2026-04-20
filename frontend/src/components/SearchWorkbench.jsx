import { useEffect, useRef, useState } from 'react';

function mapVoiceRecognitionError(code = '') {
  switch (code) {
    case 'audio-capture':
      return 'No microphone was detected. Connect a microphone and try again.';
    case 'network':
      return 'Voice capture lost its connection. Please try the microphone again.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow microphone permission to use voice search.';
    case 'no-speech':
      return 'No speech was detected. Please try again and speak clearly.';
    case 'language-not-supported':
      return 'This browser could not start speech recognition for the selected language.';
    default:
      return 'Voice search could not start in this browser right now.';
  }
}

function buildSpokenReply(result, scopeLabel = '', fallbackError = '') {
  if (fallbackError) {
    return fallbackError;
  }

  const answer = result?.reasoning?.answer || '';
  const recommendations = (result?.reasoning?.recommendations || []).slice(0, 3);
  const supportingMatches = (result?.reasoning?.supportingMatches || []).slice(0, 2);
  const parts = [];

  if (scopeLabel) {
    parts.push(`Semantic search reply for ${scopeLabel}.`);
  }

  if (answer) {
    parts.push(answer);
  }

  if (recommendations.length) {
    parts.push(`Recommended next steps: ${recommendations.join('. ')}.`);
  }

  if (supportingMatches.length) {
    parts.push(`Supporting matches include ${supportingMatches.map((match) => match.clauseType.replace(/_/g, ' ')).join(' and ')}.`);
  }

  return parts.join(' ').trim();
}

function SearchWorkbench({
  query,
  deferredQuery,
  pending,
  result,
  error,
  disabled,
  disabledMessage,
  scopeLabel,
  onQueryChange,
  onSubmit,
  onRunSearch,
  modeLabel,
}) {
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [voiceMessage, setVoiceMessage] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const recommendations = result?.reasoning?.recommendations || [];
  const supportingMatches = result?.reasoning?.supportingMatches || [];
  const SpeechRecognitionApi = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;
  const voiceInputSupported = Boolean(SpeechRecognitionApi);
  const voiceOutputSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isListening = voiceStatus === 'listening';
  const isVoiceProcessing = voiceStatus === 'processing';
  const isSpeaking = voiceStatus === 'speaking';
  const canSpeakReply = Boolean(error || result?.reasoning?.answer || recommendations.length);
  const voiceSupportMessage = !voiceInputSupported && !voiceOutputSupported
    ? 'Voice input and spoken replies need a browser with Web Speech API support.'
    : !voiceInputSupported
      ? 'Voice input is unavailable in this browser, but spoken reply can still read the written answer aloud.'
      : !voiceOutputSupported
        ? 'Voice input is available, but spoken reply is not supported in this browser.'
        : 'Ask with your voice and hear the grounded semantic search answer read back aloud.';

  useEffect(() => (
    () => {
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;

        if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort();
        } else if (typeof recognitionRef.current.stop === 'function') {
          recognitionRef.current.stop();
        }

        recognitionRef.current = null;
      }

      if (voiceOutputSupported) {
        window.speechSynthesis.cancel();
      }

      utteranceRef.current = null;
    }
  ), [voiceOutputSupported]);

  function stopVoiceReply() {
    if (!voiceOutputSupported) {
      return;
    }

    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setVoiceMessage('');
    setVoiceStatus((current) => (current === 'speaking' ? 'idle' : current));
  }

  function speakReply(nextResult = result, fallbackError = '') {
    if (!voiceOutputSupported) {
      return Promise.resolve(false);
    }

    const spokenText = buildSpokenReply(nextResult, scopeLabel, fallbackError);

    if (!spokenText) {
      setVoiceError('No written answer is available to read aloud yet.');
      return Promise.resolve(false);
    }

    window.speechSynthesis.cancel();
    setVoiceError('');
    setVoiceStatus('speaking');
    setVoiceMessage('Reading the semantic search reply aloud...');

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.98;
      utterance.pitch = 1;
      utteranceRef.current = utterance;

      utterance.onend = () => {
        utteranceRef.current = null;
        setVoiceMessage('');
        setVoiceStatus('idle');
        resolve(true);
      };

      utterance.onerror = (event) => {
        utteranceRef.current = null;
        setVoiceMessage('');
        setVoiceStatus('idle');

        if (event.error !== 'interrupted') {
          setVoiceError('The voice reply could not be played in this browser.');
        }

        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  function handleFormSubmit(event) {
    stopVoiceReply();
    void onSubmit(event);
  }

  async function handleReplayReply() {
    if (isSpeaking) {
      stopVoiceReply();
      return;
    }

    await speakReply(result, error);
  }

  function handleVoiceSearch() {
    if (disabled || pending) {
      return;
    }

    if (isListening && recognitionRef.current) {
      setVoiceMessage('Finishing your voice capture...');
      recognitionRef.current.stop();
      return;
    }

    if (!voiceInputSupported) {
      setVoiceError('Voice input is not supported in this browser.');
      return;
    }

    stopVoiceReply();
    setVoiceError('');
    setVoiceStatus('listening');
    setVoiceMessage('Listening for your contract question...');

    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalTranscript = '';
    let latestTranscript = '';
    let recognitionFailed = false;

    recognition.onstart = () => {
      setVoiceStatus('listening');
      setVoiceMessage('Listening for your contract question...');
      setVoiceError('');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';

        if (event.results[index].isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interimTranscript += transcript;
        }
      }

      latestTranscript = `${finalTranscript}${interimTranscript}`.trim();

      if (latestTranscript) {
        onQueryChange(latestTranscript);
        setVoiceMessage(interimTranscript ? 'Listening...' : 'Captured your question.');
      }
    };

    recognition.onerror = (event) => {
      recognitionFailed = true;
      recognitionRef.current = null;
      setVoiceStatus('idle');
      setVoiceMessage('');

      if (event.error !== 'aborted') {
        setVoiceError(mapVoiceRecognitionError(event.error));
      }
    };

    recognition.onend = async () => {
      recognitionRef.current = null;

      if (recognitionFailed) {
        return;
      }

      const spokenQuery = (finalTranscript || latestTranscript).trim();

      if (!spokenQuery) {
        setVoiceStatus('idle');
        setVoiceMessage('');
        setVoiceError('No speech was detected. Please try again.');
        return;
      }

      onQueryChange(spokenQuery);
      setVoiceStatus('processing');
      setVoiceMessage('Running semantic search for your spoken question...');

      try {
        const nextResult = await onRunSearch(spokenQuery);

        if (voiceOutputSupported) {
          await speakReply(nextResult);
        } else {
          setVoiceStatus('idle');
          setVoiceMessage('Voice search complete. The written answer is ready below.');
        }
      } catch (searchRunError) {
        setVoiceStatus('idle');
        setVoiceMessage('');
        setVoiceError(searchRunError.message || 'The spoken question was captured, but semantic search failed.');
      }
    };

    try {
      recognition.start();
    } catch (startError) {
      recognitionRef.current = null;
      setVoiceStatus('idle');
      setVoiceMessage('');
      setVoiceError('Microphone capture could not be started. Please try again.');
    }
  }

  return (
    <section className="panel search-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Reasoning Layer</p>
          <h3>Semantic search workbench</h3>
        </div>
        <span className="mode-label">{modeLabel}</span>
      </div>

      <form className="search-form" onSubmit={handleFormSubmit}>
        <label htmlFor="semantic-query" className="search-label">
          Ask about risk, precedent, or drafting changes
        </label>
        <div className="search-row">
          <input
            id="semantic-query"
            value={query}
            disabled={disabled}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Type or speak a contract question"
          />
          <button type="submit" disabled={pending || disabled}>
            {pending ? 'Searching...' : 'Run Search'}
          </button>
          <button
            type="button"
            className="search-secondary-button"
            disabled={disabled || pending || isVoiceProcessing}
            onClick={handleVoiceSearch}
          >
            {isListening ? 'Stop Listening' : isVoiceProcessing ? 'Voice Search...' : 'Voice Ask'}
          </button>
          <button
            type="button"
            className="search-secondary-button"
            disabled={(!canSpeakReply && !isSpeaking) || !voiceOutputSupported || pending || isVoiceProcessing}
            onClick={() => {
              void handleReplayReply();
            }}
          >
            {isSpeaking ? 'Stop Reply' : 'Speak Reply'}
          </button>
        </div>
        <p className="search-hint">
          {scopeLabel ? `Scoped contract: ${scopeLabel}` : 'Scoped contract: select a contract name first.'}
        </p>
        <p className="search-hint">Focused context preview: {deferredQuery || 'Start typing a contract question.'}</p>
        <p className="search-hint">{voiceSupportMessage}</p>
        {voiceMessage ? (
          <p className="search-hint search-voice-status" aria-live="polite">{voiceMessage}</p>
        ) : null}
        {voiceError ? (
          <p className="empty-state search-voice-error" aria-live="polite">{voiceError}</p>
        ) : null}
      </form>

      <div className="search-answer">
        <h4>Answer</h4>
        <p>
          {error || result?.reasoning?.answer || (
            disabled
              ? disabledMessage
              : 'Run a semantic search to see grounded reasoning and supporting matches.'
          )}
        </p>
      </div>

      <div className="search-grid">
        <div>
          <h4>Recommendations</h4>
          {recommendations.length ? (
            <ul>
              {recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Recommendations will appear after a successful search.</p>
          )}
        </div>
        <div>
          <h4>Supporting matches</h4>
          {supportingMatches.length ? (
            <ul>
              {supportingMatches.map((match) => (
                <li key={match.id}>
                  <strong>{match.clauseType.replace(/_/g, ' ')}</strong> - {match.riskLabel} risk
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Matching clauses will appear here once the search index has live data.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default SearchWorkbench;
