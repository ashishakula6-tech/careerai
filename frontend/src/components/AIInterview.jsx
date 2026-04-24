import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import AIInterviewer from './AIInterviewer';

export default function AIInterview({ interviewData, email, onComplete, onBack }) {
  const [phase, setPhase] = useState('joining');
  const [currentQ, setCurrentQ] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [callEndReason, setCallEndReason] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // Use refs for mutable state accessed in async flows
  const answersRef = useRef({});
  const transcriptRef = useRef('');
  const currentQRef = useRef(0);
  const phaseRef = useRef('joining');
  const abortedRef = useRef(false);

  const questions = interviewData?.questions || [];
  const totalQ = questions.length;

  // Keep refs synced
  useEffect(() => { transcriptRef.current = currentTranscript; }, [currentTranscript]);
  useEffect(() => { currentQRef.current = currentQ; }, [currentQ]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ==================== MEDIA ====================
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
        } catch {}
      }
    })();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ==================== SPEECH HELPERS ====================
  function speak(text) {
    return new Promise(resolve => {
      if (abortedRef.current) { resolve(); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92; u.pitch = 0.95; u.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find(v => /Google|Samantha|Daniel|Karen|Moira/i.test(v.name));
      if (pref) u.voice = pref;
      setAiSpeaking(true);
      u.onend = () => { setAiSpeaking(false); resolve(); };
      u.onerror = () => { setAiSpeaking(false); resolve(); };
      window.speechSynthesis.speak(u);
    });
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    let finalText = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { finalText += e.results[i][0].transcript + ' '; setCurrentTranscript(finalText.trim()); }
        else interim += e.results[i][0].transcript;
      }
      setInterimTranscript(interim);
    };
    r.onend = () => { if (recognitionRef.current === r && !abortedRef.current) try { r.start(); } catch {} };
    r.onerror = () => {};
    recognitionRef.current = r;
    try { r.start(); } catch {}
    setCurrentTranscript(''); setInterimTranscript('');
    setPhase('listening');
  }

  function stopListening() {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    try { r?.stop(); } catch {}
    setInterimTranscript('');
  }

  // ==================== INTERVIEW FLOW (no useCallback — plain async functions) ====================
  async function joinCall() {
    abortedRef.current = false;
    setPhase('connected');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);

    await new Promise(r => setTimeout(r, 1500));

    if (abortedRef.current) return;

    await speak(
      `Hi there, thanks for joining. I'm Sarah, your interviewer for the ${interviewData.job_title} role. ` +
      `We have ${totalQ} questions today. Take your time to answer each one. Let's begin.`
    );

    if (abortedRef.current) return;
    await askQuestion(0);
  }

  async function askQuestion(idx) {
    if (abortedRef.current) return;
    if (idx >= totalQ) {
      await finishCall();
      return;
    }
    setCurrentQ(idx);
    currentQRef.current = idx;
    setPhase('speaking');

    const q = questions[idx];
    await speak(`Question ${idx + 1}. ${q.question}`);

    if (abortedRef.current) return;
    startListening();
  }

  async function handleNext() {
    if (abortedRef.current) return;
    stopListening();

    const idx = currentQRef.current;
    const q = questions[idx];
    const txt = transcriptRef.current.trim();
    answersRef.current[q.id] = txt || '(no answer)';

    setPhase('speaking');
    const acks = ['Okay, thank you.', 'Got it.', 'Thank you for that.', 'Alright, noted.', 'Good, moving on.'];
    await speak(acks[idx % acks.length]);

    if (abortedRef.current) return;
    await askQuestion(idx + 1);
  }

  async function finishCall() {
    if (abortedRef.current) return;
    stopListening();
    if (timerRef.current) clearInterval(timerRef.current);

    // Save last answer
    const lastIdx = currentQRef.current;
    if (transcriptRef.current.trim() && questions[lastIdx]) {
      answersRef.current[questions[lastIdx].id] = transcriptRef.current.trim();
    }

    setPhase('evaluating');
    await speak('That was the last question. Let me review your responses.');

    if (abortedRef.current) return;

    try {
      const answersList = questions.map(q => ({ question_id: q.id, answer: answersRef.current[q.id] || '' }));
      const fd = new FormData();
      fd.append('email', email);
      fd.append('answers', JSON.stringify(answersList));
      const res = await api.post(`/portal/interview/${interviewData.interview_id}/submit`, fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: undefined },
      });

      const ev = res.data.evaluation;
      setResult(ev);

      if (ev.passed) {
        await speak(`Congratulations! You passed with ${ev.overall_score} out of 5. Our team will contact you for next steps. Have a great day.`);
        setCallEndReason('passed');
      } else {
        await speak(`Your score was ${ev.overall_score} out of 5, below the threshold of ${ev.pass_threshold}. Thank you for your time.`);
        setCallEndReason('failed');
      }

      // Stop camera
      streamRef.current?.getTracks().forEach(t => t.stop());
      setPhase('ended');

      // Auto-redirect after 5 seconds
      setTimeout(() => { onComplete(ev); }, 5000);
    } catch {
      setCallEndReason('error');
      streamRef.current?.getTracks().forEach(t => t.stop());
      setPhase('ended');
      setTimeout(() => { onComplete(null); }, 3000);
    }
  }

  async function hangUp() {
    abortedRef.current = true;
    stopListening();
    window.speechSynthesis.cancel();
    setAiSpeaking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());

    // Backend: reject the candidate
    try {
      const fd = new FormData();
      fd.append('email', email);
      fd.append('reason', 'Candidate disconnected during interview');
      await api.post(`/portal/interview/${interviewData.interview_id}/abandon`, fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: undefined },
      });
    } catch {}

    setCallEndReason('hung_up');
    setPhase('ended');

    // Auto-redirect after 4 seconds
    setTimeout(() => { onComplete(null); }, 4000);
  }

  function toggleMute() {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); }
  }
  function toggleCam() {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setIsCamOff(!t.enabled); }
  }

  const fmtTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ==================== CALL ENDED SCREEN ====================
  if (phase === 'ended') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="text-center">
          {callEndReason === 'passed' ? (
            <>
              <div className="w-24 h-24 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Interview Passed!</h1>
              <p className="text-green-400 text-lg mb-1">Score: {result?.overall_score} / {result?.max_score}</p>
              <p className="text-gray-400 mb-6">You'll hear from our team soon.</p>
              <p className="text-gray-600 text-sm">Redirecting to portal...</p>
            </>
          ) : callEndReason === 'failed' ? (
            <>
              <div className="w-24 h-24 bg-red-600 rounded-full mx-auto flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Call Ended</h1>
              <p className="text-red-400 text-lg mb-1">Score: {result?.overall_score} / {result?.max_score}</p>
              <p className="text-gray-400 mb-6">Didn't meet the threshold of {result?.pass_threshold}.</p>
              <p className="text-gray-600 text-sm">Redirecting to portal...</p>
            </>
          ) : (
            <>
              <div className="w-24 h-24 bg-red-700 rounded-full mx-auto flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Interview Rejected</h1>
              <p className="text-red-400 mb-2">You disconnected during the interview.</p>
              <p className="text-gray-500 mb-6">Leaving mid-interview results in automatic rejection. No retake allowed.</p>
              <p className="text-gray-600 text-sm">Redirecting to portal...</p>
            </>
          )}
          <button onClick={() => onComplete(result)} className="mt-4 px-8 py-3 bg-white text-gray-900 rounded-full font-medium hover:bg-gray-200 transition">
            Back to Portal Now
          </button>
        </div>
      </div>
    );
  }

  // ==================== JOINING SCREEN ====================
  if (phase === 'joining') {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center">
        <div className="max-w-lg w-full mx-4 text-center">
          <div className="w-80 h-60 mx-auto rounded-2xl overflow-hidden bg-gray-800 mb-6 relative">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1">
              <span className="text-white text-sm">You</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Ready to join?</h2>
          <p className="text-gray-400 mb-2">{interviewData.job_title} — AI Interview</p>
          <p className="text-gray-500 text-sm mb-2">{totalQ} questions | ~15 minutes | Voice & Video</p>
          <p className="text-red-400 text-xs mb-6">Warning: Leaving the call mid-interview will result in automatic rejection.</p>
          <div className="flex justify-center gap-4 mb-6">
            <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isMuted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button onClick={toggleCam} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isCamOff ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
          <button onClick={joinCall} className="px-10 py-3.5 bg-green-600 text-white rounded-full font-semibold text-lg hover:bg-green-500 transition shadow-lg shadow-green-600/30">
            Join Now
          </button>
          <button onClick={onBack} className="block mx-auto mt-4 text-gray-500 text-sm hover:text-gray-300 transition">Leave</button>
        </div>
      </div>
    );
  }

  // ==================== LIVE CALL ====================
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* AI Interviewer canvas */}
        <div className="absolute inset-0 z-0">
          <AIInterviewer speaking={aiSpeaking} width={1280} height={720} />
        </div>

        {/* Name tag */}
        <div className="absolute bottom-52 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
          <p className="text-white font-medium text-sm">Sarah Mitchell</p>
          <p className="text-gray-400 text-xs">Senior Interviewer</p>
        </div>

        {/* Candidate PIP */}
        <div className="absolute bottom-4 right-4 w-52 h-40 rounded-xl overflow-hidden border-2 border-gray-600 shadow-2xl bg-gray-900 z-20">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          {isCamOff && <div className="absolute inset-0 bg-gray-800 flex items-center justify-center"><span className="text-gray-500 text-sm">Camera off</span></div>}
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur rounded px-2 py-0.5"><span className="text-white text-xs">You</span></div>
          {phase === 'listening' && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur rounded px-2 py-0.5">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-white text-xs">Speaking</span>
            </div>
          )}
        </div>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${phase === 'evaluating' ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
            <span className="text-white/80 text-sm font-medium">{interviewData.job_title}</span>
            <span className="text-gray-500 text-sm">|</span>
            <span className="text-white/60 text-sm font-mono">{fmtTime(elapsed)}</span>
          </div>
          <span className="text-gray-400 text-xs bg-gray-800/80 rounded-full px-3 py-1">Q{currentQ + 1}/{totalQ}</span>
        </div>

        {/* Captions */}
        {showCaptions && (
          <div className="absolute bottom-20 left-4 right-72 z-20">
            {(phase === 'speaking' || phase === 'listening') && questions[currentQ] && (
              <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-3 mb-2">
                <p className="text-white text-sm">{questions[currentQ].question}</p>
              </div>
            )}
            {phase === 'listening' && (currentTranscript || interimTranscript) && (
              <div className="bg-blue-900/60 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-blue-200 text-sm">
                  {currentTranscript}
                  {interimTranscript && <span className="text-blue-400 italic"> {interimTranscript}</span>}
                  <span className="animate-pulse text-blue-300">|</span>
                </p>
              </div>
            )}
            {phase === 'evaluating' && (
              <div className="bg-yellow-900/60 backdrop-blur-sm rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.2}s`}} />)}</div>
                  <p className="text-yellow-200 text-sm">Evaluating your responses...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="bg-gray-900/95 backdrop-blur border-t border-gray-800 px-6 py-4 z-20">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={toggleMute} className={`w-11 h-11 rounded-full flex items-center justify-center transition ${isMuted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button onClick={toggleCam} className={`w-11 h-11 rounded-full flex items-center justify-center transition ${isCamOff ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button onClick={() => setShowCaptions(!showCaptions)} className={`w-11 h-11 rounded-full flex items-center justify-center transition ${showCaptions ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <span className="text-white text-xs font-bold">CC</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {phase === 'listening' && (
              <button onClick={currentQ < totalQ - 1 ? handleNext : finishCall}
                className={`px-6 py-2.5 rounded-full font-medium text-sm transition ${
                  currentQ < totalQ - 1 ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-green-600 text-white hover:bg-green-500'
                }`}>
                {currentQ < totalQ - 1 ? 'Next Question' : 'Finish Interview'}
              </button>
            )}
            {phase === 'speaking' && <span className="text-gray-500 text-sm">Interviewer is speaking...</span>}
            {phase === 'connected' && <span className="text-gray-500 text-sm">Connecting...</span>}
            {phase === 'evaluating' && <span className="text-yellow-400 text-sm animate-pulse">Evaluating...</span>}
          </div>

          <button onClick={hangUp} className="w-14 h-11 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition" title="Leave call">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
