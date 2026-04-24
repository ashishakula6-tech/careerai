import React, { useState, useRef, useEffect } from 'react';

/**
 * Video pitch recorder — records 30-60 seconds of webcam video.
 * Candidate explains why they're the right fit for the job.
 */
export default function VideoRecorder({ jobTitle, onSubmit, onCancel, maxSeconds = 60, minSeconds = 30 }) {
  const [state, setState] = useState('preview'); // preview | countdown | recording | review | uploading
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState('');

  const liveVideoRef = useRef(null);
  const playbackRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

  // Setup camera
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      } catch {
        setError('Camera and microphone access are required to record your video pitch.');
      }
    })();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, []);

  // Start countdown then record
  const startCountdown = () => {
    setState('countdown');
    setCountdown(3);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(iv);
        startRecording();
      }
    }, 1000);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    transcriptRef.current = '';
    setTranscript('');
    setLiveTranscript('');

    // Start speech recognition to capture what candidate says
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = 'en-US';
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            transcriptRef.current += e.results[i][0].transcript + ' ';
            setTranscript(transcriptRef.current.trim());
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        setLiveTranscript(interim);
      };
      r.onend = () => { if (recognitionRef.current === r) try { r.start(); } catch {} };
      r.onerror = () => {};
      recognitionRef.current = r;
      try { r.start(); } catch {}
    }

    // Start video recording
    // Pick the best supported mimeType for maximum browser compatibility
    const possibleTypes = [
      'video/webm;codecs=vp8,opus',      // Most compatible
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];
    let mimeType = '';
    for (const t of possibleTypes) {
      if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
    }
    const mrOptions = mimeType ? { mimeType, audioBitsPerSecond: 128000, videoBitsPerSecond: 1500000 } : {};
    const mr = new MediaRecorder(streamRef.current, mrOptions);
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setState('review');
    };
    recorderRef.current = mr;
    mr.start(100);
    setState('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (next >= maxSeconds) { stopRecording(); }
        return next;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    // Stop speech recognition
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.stop(); } catch {}
    }
    setLiveTranscript('');
    setTranscript(transcriptRef.current.trim());
    // Stop video
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const retake = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl('');
    setElapsed(0);
    setTranscript('');
    setLiveTranscript('');
    transcriptRef.current = '';
    setState('preview');
    // Re-attach stream to live video
    if (liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  };

  const handleSubmit = () => {
    if (!recordedBlob) return;
    if (elapsed < minSeconds) {
      setError(`Video must be at least ${minSeconds} seconds. Yours was ${elapsed} seconds.`);
      return;
    }
    setState('uploading');
    // Pass blob, duration, AND the speech transcript for AI evaluation
    onSubmit(recordedBlob, elapsed, transcriptRef.current.trim());
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const pctDone = Math.min(100, (elapsed / maxSeconds) * 100);
  const isMinMet = elapsed >= minSeconds;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-5">
          <h3 className="text-lg font-bold">Record Your Video Pitch</h3>
          <p className="text-purple-100 text-sm mt-1">
            Tell us in {minSeconds}-{maxSeconds} seconds why you're the best fit for <strong>{jobTitle}</strong>
          </p>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* Video area */}
        <div className="relative bg-black aspect-video">
          {/* Live preview / recording */}
          {(state === 'preview' || state === 'countdown' || state === 'recording') && (
            <video ref={liveVideoRef} autoPlay playsInline muted
              className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          )}

          {/* Playback review */}
          {state === 'review' && recordedUrl && (
            <video ref={playbackRef} src={recordedUrl} controls className="w-full h-full object-cover" />
          )}

          {/* Uploading state */}
          {state === 'uploading' && (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <div className="flex gap-1 justify-center mb-4">
                  {[0, 1, 2].map(i => <div key={i} className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
                <p className="text-lg font-medium">Uploading your video...</p>
              </div>
            </div>
          )}

          {/* Countdown overlay */}
          {state === 'countdown' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-8xl font-bold text-white animate-ping">{countdown}</div>
            </div>
          )}

          {/* Recording indicator + live transcript */}
          {state === 'recording' && (
            <>
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur rounded-lg px-3 py-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white text-sm font-mono">{fmtTime(elapsed)}</span>
                <span className="text-gray-400 text-xs">/ {fmtTime(maxSeconds)}</span>
              </div>
              {/* Live transcript of what candidate is saying */}
              {(transcript || liveTranscript) && (
                <div className="absolute bottom-10 left-4 right-4 bg-black/70 backdrop-blur rounded-lg px-4 py-2 max-h-20 overflow-y-auto">
                  <p className="text-white text-xs leading-relaxed">
                    {transcript}
                    {liveTranscript && <span className="text-gray-400 italic"> {liveTranscript}</span>}
                    <span className="animate-pulse text-green-400">|</span>
                  </p>
                </div>
              )}
              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0">
                <div className="h-1.5 bg-gray-800">
                  <div className={`h-full transition-all duration-1000 ${isMinMet ? 'bg-green-500' : 'bg-yellow-500'}`}
                    style={{ width: `${pctDone}%` }} />
                </div>
                {!isMinMet && !transcript && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur rounded-full px-3 py-1">
                    <p className="text-yellow-300 text-xs">Keep going — minimum {minSeconds - elapsed}s more</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Review overlay */}
          {state === 'review' && (
            <div className="absolute top-4 left-4 right-4">
              <div className="bg-black/60 backdrop-blur rounded-lg px-3 py-2 mb-2">
                <span className="text-white text-sm">Duration: {fmtTime(elapsed)}</span>
                {!isMinMet && <span className="text-red-400 text-xs ml-2">(Too short — min {minSeconds}s)</span>}
                <span className="text-green-400 text-xs ml-2">{transcript.split(/\s+/).filter(Boolean).length} words captured</span>
              </div>
              {transcript && (
                <div className="bg-black/60 backdrop-blur rounded-lg px-3 py-2 max-h-16 overflow-y-auto">
                  <p className="text-gray-300 text-xs">{transcript}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tips */}
        {state === 'preview' && (
          <div className="p-4 bg-blue-50 border-t border-blue-100">
            <p className="text-sm font-medium text-blue-800 mb-2">Tips for a great pitch:</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>- Introduce yourself briefly</li>
              <li>- Explain why this role excites you</li>
              <li>- Highlight your most relevant skills and experience</li>
              <li>- Share what unique value you'd bring to the team</li>
              <li>- Be natural, confident, and look at the camera</li>
            </ul>
          </div>
        )}

        {/* Controls */}
        <div className="p-5 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-center gap-3">
            {state === 'preview' && (
              <>
                <button onClick={startCountdown}
                  className="px-8 py-3 bg-red-600 text-white rounded-full font-semibold hover:bg-red-500 transition shadow-lg flex items-center gap-2">
                  <div className="w-4 h-4 bg-white rounded-full" />
                  Start Recording
                </button>
                <button onClick={onCancel} className="px-6 py-3 text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
              </>
            )}

            {state === 'recording' && (
              <button onClick={stopRecording} disabled={!isMinMet}
                className={`px-8 py-3 rounded-full font-semibold transition shadow-lg flex items-center gap-2 ${
                  isMinMet ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                {isMinMet ? 'Stop Recording' : `Wait ${minSeconds - elapsed}s...`}
              </button>
            )}

            {state === 'review' && (
              <>
                <button onClick={retake}
                  className="px-6 py-3 border border-gray-300 rounded-full font-medium hover:bg-white transition">
                  Retake
                </button>
                <button onClick={handleSubmit} disabled={!isMinMet}
                  className={`px-8 py-3 rounded-full font-semibold transition shadow-lg ${
                    isMinMet ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}>
                  {isMinMet ? 'Submit Video' : `Too short (min ${minSeconds}s)`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
