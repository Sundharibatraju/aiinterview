import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Mic, MicOff, Volume2, Clock, AlertTriangle, ShieldCheck, CheckCircle2, RefreshCw, HelpCircle, Hourglass, Send, Video, VideoOff, Maximize2, LogOut, ArrowRight, RotateCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InterviewRegistration, ProctoringEventType, QuestionDifficulty } from '../types/index';

interface InterviewRoomProps {
  registration: InterviewRegistration;
  onInterviewFinished: () => void;
  onTerminated: () => void;
}

type AIState = 'LISTENING' | 'THINKING' | 'SPEAKING';

export const InterviewRoom: React.FC<InterviewRoomProps> = ({
  registration,
  onInterviewFinished,
  onTerminated,
}) => {
  const { token } = useAuth();

  // Video feed ref & camera states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'requesting' | 'active' | 'error' | 'disconnected'>('requesting');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Interview state
  const [currentQuestion, setCurrentQuestion] = useState<string>('Initializing interview...');
  const [spokenGreeting, setSpokenGreeting] = useState<string>('');
  const [questionIndex, setQuestionIndex] = useState<number>(1);
  const [totalQuestions, setTotalQuestions] = useState<number>(registration.job?.numQuestions || 5);
  const [currentDifficulty, setCurrentDifficulty] = useState<QuestionDifficulty>(QuestionDifficulty.EASY);
  const [hintsRemaining, setHintsRemaining] = useState<number>(3);
  const [aiState, setAiState] = useState<AIState>('SPEAKING');

  // Candidate Voice State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [candidateTranscript, setCandidateTranscript] = useState<string>('');
  const [isThinkingTime, setIsThinkingTime] = useState<boolean>(false);
  const [thinkingSecondsLeft, setThinkingSecondsLeft] = useState<number>(0);
  const [conversationLog, setConversationLog] = useState<Array<{ sender: 'ai' | 'candidate'; text: string; time: string }>>([]);

  // Timer
  const [secondsRemaining, setSecondsRemaining] = useState<number>((registration.job?.durationMinutes || 20) * 60);

  // Proctoring / Warning state
  const [warningCount, setWarningCount] = useState<number>(0);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [isTerminated, setIsTerminated] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [detectedCompletionNotice, setDetectedCompletionNotice] = useState<string | null>(null);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const [isManualEditMode, setIsManualEditMode] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const isCompletedRef = useRef<boolean>(false);
  const autoSubmitTimeoutRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const silenceIntervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const candidateTranscriptRef = useRef<string>('');

  // Sync ref flags
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    isCompletedRef.current = isCompleted;
  }, [isCompleted]);

  useEffect(() => {
    candidateTranscriptRef.current = candidateTranscript;
  }, [candidateTranscript]);

  // Real-time microphone audio level monitor via Web Audio API
  const startMicAudioMonitor = useCallback(async () => {
    try {
      if (micStreamRef.current) return;
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = audioStream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(audioStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVol = () => {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateVol);
        };
        animFrameRef.current = requestAnimationFrame(updateVol);
      }
    } catch (err) {
      console.warn('Microphone audio monitor access error:', err);
    }
  }, []);

  // 1. Initialize Video webcam with disconnection recovery & retry
  const startWebcam = useCallback(async () => {
    setCameraStatus('requesting');
    setCameraError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('error');
      setCameraError('Camera media API unavailable');
      return;
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.warn('Video play warning:', e));
        };
      }

      const videoTrack = s.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setCameraStatus('disconnected');
          setCameraError('Camera stream disconnected or unplugged.');
          // Record proctoring event
          fetch('/api/interview/proctoring-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              registrationId: registration.id,
              eventType: ProctoringEventType.CAMERA_DISABLED,
              metadata: { message: 'Candidate camera track disconnected' },
            }),
          }).catch(() => {});
        };
      }

      setCameraStatus('active');
    } catch (err: any) {
      console.warn('Webcam stream access error:', err);
      setCameraStatus('error');
      setCameraError(err?.message || 'Camera permission denied or camera in use');
    }
  }, [registration.id, token]);

  useEffect(() => {
    startWebcam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (silenceIntervalRef.current) {
        clearInterval(silenceIntervalRef.current);
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [startWebcam]);

  // 2. Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Thinking Time Countdown
  useEffect(() => {
    if (thinkingSecondsLeft > 0) {
      const timer = setTimeout(() => {
        setThinkingSecondsLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isThinkingTime) {
      setIsThinkingTime(false);
      speakAISpeech("Time's up! Whenever you're ready, please share your thoughts.");
    }
  }, [thinkingSecondsLeft, isThinkingTime]);

  // 4. Start Interview API Call
  useEffect(() => {
    const initInterview = async () => {
      try {
        setAiState('THINKING');
        const res = await fetch('/api/interview/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ registrationId: registration.id }),
        });

        const data = await res.json();
        if (res.ok && data.firstQuestion) {
          setCurrentQuestion(data.firstQuestion.questionText);
          setCurrentDifficulty(data.firstQuestion.difficulty || QuestionDifficulty.EASY);
          setQuestionIndex(data.questionIndex || 1);
          setTotalQuestions(data.totalQuestions || 5);

          const greeting = data.spokenGreeting || data.firstQuestion.questionText;
          setSpokenGreeting(greeting);

          // Add to conversation log
          setConversationLog([
            {
              sender: 'ai',
              text: greeting,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);

          speakAISpeech(greeting);
        }
      } catch (err) {
        console.error('Failed to initialize interview session:', err);
      }
    };

    initInterview();
  }, [registration.id]);

  // 5. Text-To-Speech Output
  const speakAISpeech = (text: string) => {
    setAiState('SPEAKING');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select female or natural voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Natural') || v.name.includes('Google')));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        isSubmittingRef.current = false;
        setAiState('LISTENING');
        startSpeechRecognition();
      };
      utterance.onerror = () => {
        isSubmittingRef.current = false;
        setAiState('LISTENING');
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        isSubmittingRef.current = false;
        setAiState('LISTENING');
        startSpeechRecognition();
      }, 3000);
    }
  };

  // 6. Speech-to-Text Input with Resilient Continuous Listening & Spoken Wrap-up Detection
  const END_PHRASE_REGEX = /(?:thanks|thank you|done|that'?s all|that is all|that'?s it|finished)\s*(?:,|.)?\s*(?:next question|move on|go to next|next|please)?\s*$/i;
  const NEXT_DIRECT_REGEX = /\b(?:next question please|next question|go to next question|move to next question)\b\s*$/i;

  const clearSilenceTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (silenceIntervalRef.current) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    setSilenceCountdown(null);
  }, []);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    keepListeningRef.current = true;
    startMicAudioMonitor();

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const current = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join(' ');
        setCandidateTranscript(current);
        candidateTranscriptRef.current = current;

        // Reset silence countdown on every new incoming speech input
        clearSilenceTimers();

        // Check if candidate verbally indicated they finished their answer
        if (END_PHRASE_REGEX.test(current) || NEXT_DIRECT_REGEX.test(current)) {
          const cleaned = current
            .replace(END_PHRASE_REGEX, '')
            .replace(NEXT_DIRECT_REGEX, '')
            .trim();

          if (!autoSubmitTimeoutRef.current && !isSubmittingRef.current) {
            setDetectedCompletionNotice('🎯 Spoken wrap-up detected ("thanks, next question" / "done"). Proceeding to next question...');
            autoSubmitTimeoutRef.current = setTimeout(() => {
              autoSubmitTimeoutRef.current = null;
              setDetectedCompletionNotice(null);
              handleSendSpeech(cleaned || current);
            }, 800);
          }
        } else {
          // If candidate spoke a substantial answer (at least 4 words or 18 chars) and pauses,
          // initiate intelligent silence detection with a clear visual countdown
          const words = current.trim().split(/\s+/).filter(Boolean);
          if (words.length >= 4 && !isManualEditMode && !autoSubmitTimeoutRef.current && !isSubmittingRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              let count = 4;
              setSilenceCountdown(count);
              silenceIntervalRef.current = setInterval(() => {
                count -= 1;
                if (count <= 0) {
                  clearSilenceTimers();
                  handleSendSpeech(candidateTranscriptRef.current || current);
                } else {
                  setSilenceCountdown(count);
                }
              }, 1000);
            }, 3000);
          }
        }
      };

      recognition.onerror = (err: any) => {
        // 'no-speech' is a normal transient event when candidate pauses to think
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          console.warn('Speech recognition permission denied:', err);
          setIsRecording(false);
          keepListeningRef.current = false;
        }
      };

      recognition.onend = () => {
        // Auto-reconnect so speech recognition never dies on candidate mid-sentence or mid-thought
        if (keepListeningRef.current && !isSubmittingRef.current && !isCompletedRef.current) {
          try {
            recognition.start();
          } catch (e) {
            setTimeout(() => {
              if (keepListeningRef.current && !isSubmittingRef.current && !isCompletedRef.current) {
                try { recognition.start(); } catch (e2) {}
              }
            }, 200);
          }
        } else {
          setIsRecording(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Recognition start exception:', err);
    }
  }, [clearSilenceTimers, isManualEditMode, startMicAudioMonitor]);

  const stopSpeechRecognition = () => {
    clearSilenceTimers();
    keepListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsRecording(false);
  };

  // 7. Proctoring Integrity Listeners (Section 27 & 28)
  const lastViolationTimeRef = useRef<number>(0);
  useEffect(() => {
    let isMounted = true;

    const recordViolation = async (eventType: ProctoringEventType) => {
      // Guard: Do not record if unmounted, already terminated, finished, or missing credentials
      if (!isMounted || isTerminated || isCompleted || isCompletedRef.current || !registration?.id || !token) {
        return;
      }

      // Throttle: ignore repeated blur/tab events fired within 2 seconds
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 2000) {
        return;
      }
      lastViolationTimeRef.current = now;

      try {
        const res = await fetch('/api/interview/proctoring-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            registrationId: registration.id,
            eventType,
            metadata: { timestamp: new Date().toISOString() },
          }),
        });

        if (!res.ok) {
          console.warn('Proctoring event response non-OK status:', res.status);
          return;
        }

        const data = await res.json().catch(() => null);
        if (!data || !isMounted) return;

        const warningNum = data.warningNumber ?? data.warningCount ?? 0;
        if (warningNum === 1 || data.warningIssued) {
          setWarningCount(1);
          setShowWarningModal(true);
        } else if (warningNum >= 2 || data.terminated) {
          setWarningCount(2);
          setIsTerminated(true);
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
          if (recognitionRef.current) recognitionRef.current.stop();
        }
      } catch (err: any) {
        // Log as non-fatal warning so network blips or navigation aborts don't crash the session
        console.warn('Proctoring event notice (non-fatal):', err?.message || err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation(ProctoringEventType.TAB_SWITCH);
      }
    };

    const handleWindowBlur = () => {
      // In embedded iframe/preview environments, small focus shifts shouldn't immediately trigger
      if (document.hidden) {
        recordViolation(ProctoringEventType.WINDOW_BLUR);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [registration.id, token, isTerminated, isCompleted]);

  // 8. Submit Candidate Speech / Intent Actions
  const handleSendSpeech = async (overrideSpeech?: string) => {
    clearSilenceTimers();
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
    setDetectedCompletionNotice(null);

    const rawSpeech = overrideSpeech !== undefined ? overrideSpeech : candidateTranscript;
    const speechToSend = rawSpeech
      .replace(END_PHRASE_REGEX, '')
      .replace(NEXT_DIRECT_REGEX, '')
      .trim();

    if (!speechToSend || isSubmitting) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    stopSpeechRecognition();
    setAiState('THINKING');
    setIsManualEditMode(false);

    // Append to local log
    const candidateMsg = {
      sender: 'candidate' as const,
      text: speechToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setConversationLog(prev => [...prev, candidateMsg]);
    setCandidateTranscript('');
    candidateTranscriptRef.current = '';

    try {
      const res = await fetch('/api/interview/candidate-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registrationId: registration.id,
          candidateSpeech: speechToSend,
        }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (data.status === 'COMPLETED' || data.isInterviewFinished) {
        setIsCompleted(true);
        const completionMsg = data.interviewerResponse || data.aiSpokenReply || 'Thank you! Your interview has been completed.';
        speakAISpeech(completionMsg);
        return;
      }

      const spokenReply = data.interviewerResponse || data.aiSpokenReply;
      const nextQ = data.currentQuestion || data.nextQuestion;

      if (spokenReply) {
        // Append AI reply to log
        setConversationLog(prev => [
          ...prev,
          {
            sender: 'ai',
            text: spokenReply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        if (nextQ) {
          setCurrentQuestion(nextQ.questionText);
          setCurrentDifficulty(nextQ.difficulty);
          setQuestionIndex(data.questionIndex || data.currentQuestionIndex);
          setTotalQuestions(data.totalQuestions);
        }

        speakAISpeech(spokenReply);
      }
    } catch (err) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setAiState('LISTENING');
      startSpeechRecognition();
      console.error('Speech submit error:', err);
    }
  };

  // Special Candidate Intent Buttons
  const handleAskForMinute = () => {
    setIsThinkingTime(true);
    setThinkingSecondsLeft(60);
    const msg = "Take your time. You have 60 seconds of thinking time to structure your thoughts.";
    setConversationLog(prev => [
      ...prev,
      {
        sender: 'ai',
        text: msg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    speakAISpeech(msg);
  };

  const handleRequestHint = () => {
    if (hintsRemaining <= 0) return;
    setHintsRemaining(prev => prev - 1);
    handleSendSpeech("Could you give me a conceptual hint to guide my thought process?");
  };

  const handleRepeatQuestion = () => {
    handleSendSpeech("Could you please repeat or rephrase the question?");
  };

  const handleFinishInterview = async () => {
    setIsCompleted(true);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  // Format timer
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTimer = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-white flex flex-col justify-between select-none relative overflow-hidden">
      {/* Top Bar (Section 26: Company, Role, Live Timer) */}
      <header className="px-6 py-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">{registration.job?.company?.name}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                AI TECHNICAL INTERVIEW
              </span>
            </div>
            <p className="text-xs text-slate-400">{registration.job?.title}</p>
          </div>
        </div>

        {/* Center Progress pill */}
        <div className="hidden md:flex items-center gap-3 bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 text-xs">
          <span className="text-slate-400">Progress:</span>
          <span className="font-bold text-white">
            Question {questionIndex} of {totalQuestions}
          </span>
          <span className="text-slate-500">•</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            currentDifficulty === QuestionDifficulty.HARD
              ? 'bg-rose-500/20 text-rose-300'
              : currentDifficulty === QuestionDifficulty.MEDIUM
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            {currentDifficulty}
          </span>
        </div>

        {/* Right side: Countdown Timer & Proctor status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-amber-400">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>{formattedTimer}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/60">
            <ShieldCheck className="w-4 h-4" />
            <span>Integrity Guard Active</span>
          </div>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left / Center (8 cols): AI Avatar & Conversation Flow */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 shadow-2xl relative overflow-hidden">
          {/* AI Avatar & Audio State Visualizer */}
          <div className="text-center pt-2 pb-4">
            <div className="relative inline-block mx-auto mb-3">
              {/* Pulsing state ring */}
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
                  aiState === 'SPEAKING'
                    ? 'bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.6)] ring-8 ring-blue-500/30 animate-pulse'
                    : aiState === 'THINKING'
                    ? 'bg-amber-600 shadow-[0_0_50px_rgba(217,119,6,0.5)] ring-8 ring-amber-500/30'
                    : 'bg-emerald-600 shadow-[0_0_40px_rgba(16,185,129,0.4)] ring-8 ring-emerald-500/30'
                }`}
              >
                <Bot className="w-12 h-12 text-white" />
              </div>

              {/* State Badge */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span
                  className={`px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md ${
                    aiState === 'SPEAKING'
                      ? 'bg-blue-500 text-white'
                      : aiState === 'THINKING'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-500 text-white animate-bounce'
                  }`}
                >
                  {aiState === 'SPEAKING' && 'AI Speaking...'}
                  {aiState === 'THINKING' && 'AI Evaluating...'}
                  {aiState === 'LISTENING' && 'Listening to You'}
                </span>
              </div>
            </div>

            {/* Audio Waveform Animation Bars */}
            <div className="flex items-center justify-center gap-1.5 h-8 mt-4">
              {[0.4, 0.8, 1.2, 0.6, 1.5, 0.9, 1.4, 0.5, 1.1, 0.7].map((factor, idx) => {
                const dynamicHeight = isRecording && micVolume > 0
                  ? Math.max(8, Math.min(32, Math.round((micVolume / 100) * 32 * factor)))
                  : (aiState === 'SPEAKING' ? Math.max(8, factor * 20) : 8);

                return (
                  <div
                    key={idx}
                    className={`w-1.5 rounded-full transition-all duration-150 ${
                      aiState === 'SPEAKING'
                        ? 'bg-blue-400 animate-pulse'
                        : isRecording
                        ? micVolume > 15 ? 'bg-emerald-400' : 'bg-emerald-600/70'
                        : 'bg-slate-700'
                    }`}
                    style={{
                      height: `${dynamicHeight}px`,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Current Question Display */}
          <div className="bg-slate-800/90 rounded-xl p-5 border border-slate-700/80 my-4 shadow-inner">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold uppercase tracking-wider text-blue-400">Current Question</span>
              <span>Question {questionIndex} / {totalQuestions}</span>
            </div>
            <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
              {currentQuestion}
            </p>
          </div>

          {/* Thinking Time Indicator */}
          {isThinkingTime && (
            <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-300 mb-3 animate-pulse">
              <div className="flex items-center gap-2">
                <Hourglass className="w-4 h-4" />
                <span>Thinking Time Granted: Structure your response</span>
              </div>
              <span className="font-mono font-bold text-sm">{thinkingSecondsLeft}s remaining</span>
            </div>
          )}

          {/* Detected Spoken Wrap-up Alert */}
          {detectedCompletionNotice && (
            <div className="mb-3 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">{detectedCompletionNotice}</span>
              </div>
              <span className="font-mono text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded">Auto-advancing</span>
            </div>
          )}

          {/* Detected Silence / Auto-Submit Countdown Notice */}
          {silenceCountdown !== null && !detectedCompletionNotice && (
            <div className="mb-3 p-3 bg-blue-500/20 border border-blue-500/40 rounded-xl text-xs text-blue-200 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <Hourglass className="w-4 h-4 text-blue-400" />
                <span>
                  Voice paused. Auto-submitting in <strong className="font-mono text-white text-sm">{silenceCountdown}s</strong>...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => clearSilenceTimers()}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] rounded font-medium border border-slate-700 cursor-pointer transition"
                >
                  Keep Speaking
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearSilenceTimers();
                    handleSendSpeech();
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] rounded font-medium cursor-pointer transition"
                >
                  Submit Now
                </button>
              </div>
            </div>
          )}

          {/* Live Candidate Spoken Transcript Preview & Microphone Health */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isRecording ? (micVolume > 5 ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500') : 'bg-slate-600'}`} />
                <span className="flex items-center gap-1.5 font-medium">
                  <Mic className={`w-3.5 h-3.5 ${isRecording ? 'text-emerald-400' : 'text-slate-500'}`} />
                  {isRecording ? 'Mic Listening Active' : 'Microphone Standby'}
                </span>
                {isRecording && (
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-[10px] text-slate-500">Level:</span>
                    <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-100"
                        style={{ width: `${Math.min(100, micVolume * 1.5)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearSilenceTimers();
                    setIsManualEditMode(prev => !prev);
                  }}
                  className="text-[10px] text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  {isManualEditMode ? 'Voice Mode' : 'Type / Edit'}
                </button>
                {candidateTranscript && (
                  <button
                    type="button"
                    onClick={() => {
                      clearSilenceTimers();
                      setCandidateTranscript('');
                      candidateTranscriptRef.current = '';
                    }}
                    className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {isManualEditMode ? (
              <textarea
                rows={3}
                value={candidateTranscript}
                onChange={e => setCandidateTranscript(e.target.value)}
                placeholder="Type your technical response here or edit recognized speech..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs sm:text-sm text-slate-100 font-mono focus:border-blue-500 outline-none"
              />
            ) : (
              <p className="text-xs sm:text-sm text-slate-200 italic font-mono min-h-[44px] leading-relaxed">
                {candidateTranscript || (
                  <span className="text-slate-500 not-italic">
                    {isRecording
                      ? "Speak naturally into your microphone. Say 'Done' or 'Thanks, next question' when finished..."
                      : "Microphone paused. Click 'Speak / Answer' below to resume speaking."}
                  </span>
                )}
              </p>
            )}

            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
              <span>Tip: Speak naturally. Say "Done" or "Thanks, next question" to advance like a real human.</span>
              <span>Continuous Recognition</span>
            </div>
          </div>

          {/* Candidate Voice Controls Bar (Section 25 & 26) */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={isRecording ? stopSpeechRecognition : () => startSpeechRecognition()}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition cursor-pointer ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isRecording ? 'Pause Mic' : 'Speak / Answer'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendSpeech()}
                disabled={!candidateTranscript.trim() || isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Evaluating...' : 'Done / Next Question'}</span>
              </button>
            </div>

            {/* Candidate Intent Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAskForMinute}
                disabled={isThinkingTime || isSubmitting}
                title="Request 60 seconds to organize your response"
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
              >
                <Hourglass className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Need a Minute</span>
              </button>

              <button
                type="button"
                onClick={handleRequestHint}
                disabled={hintsRemaining <= 0 || isSubmitting}
                title="Ask for a conceptual hint"
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>Hint ({hintsRemaining})</span>
              </button>

              <button
                type="button"
                onClick={handleRepeatQuestion}
                disabled={isSubmitting}
                title="Ask AI to repeat or rephrase"
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Repeat</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Stage (4 cols): Candidate Camera Feed & Conversation Log */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Candidate Webcam Feed */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative aspect-4/3 shadow-xl flex items-center justify-center">
            {/* Live Video */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover scale-x-[-1] ${
                cameraStatus === 'active' ? 'block' : 'hidden'
              }`}
            />

            {/* Error or Reconnecting Screen */}
            {cameraStatus !== 'active' && (
              <div className="p-4 text-center flex flex-col items-center justify-center">
                {cameraStatus === 'requesting' ? (
                  <>
                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-2" />
                    <p className="text-xs text-slate-300">Connecting video feed...</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-2">
                      <VideoOff className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-rose-300">Camera Disconnected</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                      {cameraError || 'Camera feed lost. Please check permissions or reconnect device.'}
                    </p>
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 transition shadow-sm cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Retry Camera</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Live Camera Badge */}
            {cameraStatus === 'active' && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-semibold text-emerald-400 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Candidate Feed
              </div>
            )}

            {/* Reset / Reconnect camera trigger */}
            {cameraStatus === 'active' && (
              <button
                type="button"
                onClick={startWebcam}
                title="Reconnect camera stream"
                className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            )}

            {/* Warning counter pill if any */}
            {warningCount > 0 && (
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-rose-900/90 text-rose-300 text-[10px] font-bold border border-rose-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Warning {warningCount}/2</span>
              </div>
            )}
          </div>

          {/* Real-Time Conversation Log */}
          <div className="flex-1 bg-slate-900/60 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between overflow-hidden min-h-[300px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Interview Transcript Log
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Live Sync</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {conversationLog.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl ${
                    item.sender === 'ai'
                      ? 'bg-slate-800/80 text-slate-200 border border-slate-700/60'
                      : 'bg-blue-900/40 text-blue-100 border border-blue-800/60 ml-3'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-semibold uppercase text-blue-400">
                      {item.sender === 'ai' ? 'AI Interviewer' : 'Candidate'}
                    </span>
                    <span>{item.time}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-line">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Warning 1 Modal (Section 27 mandate) */}
      {showWarningModal && !isTerminated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 rounded-2xl border-2 border-amber-500 max-w-md w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/40">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-amber-400 uppercase tracking-wide">
              WARNING 1 – Interview Integrity Violation Detected
            </h2>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Leaving the interview screen, switching tabs, or minimizing the browser window is strictly prohibited.
            </p>
            <div className="mt-4 p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 font-semibold">
              CRITICAL NOTICE: A second violation will terminate the interview immediately.
            </div>
            <button
              type="button"
              onClick={() => setShowWarningModal(false)}
              className="mt-6 w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
            >
              I Understand &amp; Return to Interview
            </button>
          </div>
        </div>
      )}

      {/* Malpractice Termination Modal (Section 28 mandate) */}
      {isTerminated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg p-4">
          <div className="bg-slate-900 rounded-2xl border-2 border-rose-600 max-w-md w-full p-8 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-600/20 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-600/40 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-rose-500 uppercase tracking-wide">
              INTERVIEW TERMINATED – Reason: MALPRACTICE
            </h2>
            <p className="text-xs text-slate-300 mt-4 leading-relaxed">
              Repeated interview integrity violations were detected during your technical evaluation.
              Your registration has been marked as <strong>MALPRACTICE_TERMINATED</strong> and the hiring team has been notified.
            </p>
            <div className="mt-5 p-3 bg-slate-800/80 rounded-xl text-[11px] text-slate-400">
              Audit log recorded timestamped tab switches and window unfocus events.
            </div>
            <button
              type="button"
              onClick={onTerminated}
              className="mt-6 w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Exit to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Completion Modal (Section 45 mandate) */}
      {isCompleted && !isTerminated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg p-4">
          <div className="bg-slate-900 rounded-2xl border border-blue-500/50 max-w-lg w-full p-8 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Interview Completed Successfully</h2>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Thank you, <strong className="text-white">{registration.candidate?.fullName}</strong>. Your interview for{' '}
              <strong className="text-white">{registration.job?.title}</strong> at{' '}
              <strong className="text-white">{registration.job?.company?.name}</strong> has been successfully concluded.
            </p>
            <div className="mt-5 p-4 bg-blue-950/40 border border-blue-800/60 rounded-xl text-xs text-blue-200 text-left space-y-1.5">
              <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Synthesis &amp; Evaluation in Progress</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Our autonomous engine is compiling your responses, concept scores, and personalized feedback. 
                Your permitted interview report has been prepared and dispatched to your registered email.
              </p>
            </div>
            <button
              type="button"
              onClick={onInterviewFinished}
              className="mt-6 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View Candidate Assessment Report</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
