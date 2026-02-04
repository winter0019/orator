
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Mic, 
  History, 
  Award, 
  ChevronRight, 
  Play, 
  Square, 
  AlertCircle, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  MessageSquareQuote, 
  Activity, 
  GraduationCap, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Target, 
  Monitor, 
  Settings, 
  Menu, 
  X, 
  Sliders, 
  RotateCcw, 
  Sun, 
  Contrast, 
  Palette, 
  Camera, 
  Waves, 
  RefreshCw, 
  Info, 
  ExternalLink, 
  CheckCircle2, 
  Lightbulb,
  Volume2,
  Flag,
  Video,
  Cpu,
  UserCheck,
  BarChart3
} from 'lucide-react';
import { NYSCScenario, LeadershipStyle, SessionRecord, CoachingAlert } from './types';
import { analyzeNYSCSpeech } from './services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

// --- Constants ---
const JPEG_QUALITY = 0.5;
const TARGET_SAMPLE_RATE = 16000;
const TRANSCRIPTION_DEBOUNCE_MS = 40; // Reduced for faster feedback
const BUFFER_SIZE = 4096;
const GATE_HOLD_MS = 250; // Hysteresis time to keep gate open

// --- Utils ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return data;
  const ratio = fromRate / toRate;
  const newLength = Math.floor(data.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    result[i] = data[Math.floor(i * ratio)];
  }
  return result;
}

function createBlob(data: Float32Array, inputSampleRate: number) {
  const resampled = resample(data, inputSampleRate, TARGET_SAMPLE_RATE);
  const l = resampled.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    int16[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`,
  };
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!blob || blob.size === 0) {
      return reject(new Error("Captured signal is empty or invalid."));
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        if (base64) resolve(base64);
        else reject(new Error("Signal decoding failed: empty result."));
      } else {
        reject(new Error("Unexpected result type from signal reader."));
      }
    };
    reader.onerror = () => {
      reject(new Error("The object can not be found or processed. Hardware interruption likely."));
    };
    reader.readAsDataURL(blob);
  });
};

// --- Sub-components ---

const NavItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void, isMobile?: boolean }> = ({ icon: Icon, label, active, onClick, isMobile }) => {
  if (isMobile) {
    return (
      <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all ${active ? 'text-green-600' : 'text-slate-400'}`}>
        <Icon size={20} fill={active ? "currentColor" : "none"} />
        <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${active ? 'bg-green-600 text-white shadow-xl shadow-green-900/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
      <Icon size={18} />
      {label}
    </button>
  );
};

const MetricCard: React.FC<{ label: string, score: number, feedback: string }> = ({ label, score, feedback }) => (
  <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 space-y-4">
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-xs font-black px-2 py-1 rounded-lg ${score > 75 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{score}%</span>
    </div>
    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full transition-all duration-1000 ${score > 75 ? 'bg-green-600' : 'bg-slate-400'}`} style={{ width: `${score}%` }} />
    </div>
    <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">{feedback}</p>
  </div>
);

const PermissionDiagnostics: React.FC<{ onRetry: () => void; onClose: () => void }> = ({ onRetry, onClose }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden">
      <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
        <div className="space-y-1">
          <div className="bg-amber-100 w-10 h-10 rounded-xl flex items-center justify-center text-amber-600 mb-4"><ShieldCheck size={24} /></div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Signal Access Blocked</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hardware Diagnostic Required</p>
        </div>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-900 transition-colors"><X size={24} /></button>
      </div>
      <div className="p-8 space-y-6">
        <div className="space-y-4">
          <div className="flex gap-4">
             <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-black text-slate-400 text-[10px] shrink-0">01</div>
             <p className="text-sm font-bold text-slate-600 leading-relaxed">Ensure your browser has permission to access the <span className="text-slate-900">Microphone</span> and <span className="text-slate-900">Camera</span>.</p>
          </div>
          <div className="flex gap-4">
             <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-black text-slate-400 text-[10px] shrink-0">02</div>
             <p className="text-sm font-bold text-slate-600 leading-relaxed">Check if other applications are currently occupying the media stream.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs hover:bg-slate-200 transition-all uppercase tracking-widest">Dismiss</button>
          <button onClick={() => { onClose(); onRetry(); }} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"><RefreshCw size={14} /> Re-Initialize Session</button>
        </div>
      </div>
    </div>
  </div>
);

interface TranscriptSegment {
  id: string;
  text: string;
  correction?: string;
}

const SegmentCorrectionModal: React.FC<{ 
  segment: TranscriptSegment; 
  onClose: () => void; 
  onSave: (correction: string) => void; 
}> = ({ segment, onClose, onSave }) => {
  const [value, setValue] = useState(segment.correction || segment.text);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="bg-green-100 p-1.5 rounded-lg text-green-600"><Flag size={18} /></div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Tune Transcription</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Audio Interpretation</label>
            <p className="p-4 bg-slate-50 rounded-2xl text-xs font-medium text-slate-600 italic leading-relaxed border border-slate-100">"{segment.text}"</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Executive Correction</label>
            <textarea 
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full p-4 bg-white border-2 border-slate-100 focus:border-green-500 rounded-2xl text-sm font-bold text-slate-800 outline-none transition-all h-24 resize-none"
              placeholder="Enter correct wording..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs hover:bg-slate-200 transition-all uppercase tracking-widest">Discard</button>
            <button onClick={() => onSave(value)} className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-black text-xs hover:bg-green-700 shadow-lg transition-all uppercase tracking-widest">Save Calibration</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddressArena: React.FC<{ onAnalysisComplete: (analysis: SessionRecord) => void }> = ({ onAnalysisComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [scenario, setScenario] = useState<NYSCScenario>(NYSCScenario.CAMP_ADDRESS);
  const [leadershipStyle, setLeadershipStyle] = useState<LeadershipStyle>(LeadershipStyle.COMMANDING);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Transcription state
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [correctingSegment, setCorrectingSegment] = useState<TranscriptSegment | null>(null);
  const [wpm, setWpm] = useState<number>(0);
  
  // Performance Controls
  const [targetResolution, setTargetResolution] = useState<'480p' | '720p' | '1080p'>('720p');
  const [aiVisionRate, setAiVisionRate] = useState<number>(1.5); 
  const [hardwareFPS, setHardwareFPS] = useState<number>(30); 
  const [noiseGateThreshold, setNoiseGateThreshold] = useState<number>(20); 
  const [signalLevel, setSignalLevel] = useState<number>(0);

  // View Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'wide' | 'focused' | 'closeup'>('wide');
  const [isPseudoFullScreen, setIsPseudoFullScreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [brightness, setBrightness] = useState(100);

  const arenaRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const transcriptTimeoutRef = useRef<number | null>(null);
  
  // Refs for audio gate and buffering
  const noiseGateRef = useRef(noiseGateThreshold);
  const gateLastActiveRef = useRef<number>(0);
  const currentSentenceRef = useRef<string>("");
  const audioBufferAccumulator = useRef<Float32Array>(new Float32Array(0));

  useEffect(() => {
    noiseGateRef.current = noiseGateThreshold;
  }, [noiseGateThreshold]);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptSegments]);

  useEffect(() => {
    switch (viewMode) {
      case 'wide': setZoomLevel(1); break;
      case 'focused': setZoomLevel(1.4); break;
      case 'closeup': setZoomLevel(2.0); break;
    }
  }, [viewMode]);

  const getResolutionValue = () => {
    switch(targetResolution) {
      case '480p': return { width: 854, height: 480 };
      case '1080p': return { width: 1920, height: 1080 };
      default: return { width: 1280, height: 720 };
    }
  };

  const startRecording = async () => {
    setError(null);
    setShowDiagnostics(false);
    setTranscriptSegments([]);
    setWpm(0);
    setAudioBlob(null);
    currentSentenceRef.current = "";
    audioBufferAccumulator.current = new Float32Array(0);
    
    const { width, height } = getResolutionValue();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true,
          channelCount: 1
        }, 
        video: { 
          width: { ideal: width }, 
          height: { ideal: height }, 
          frameRate: { ideal: hardwareFPS },
          facingMode: "user" 
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(console.error);
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      await audioCtx.resume();
      audioContextRef.current = audioCtx;
      const nativeRate = audioCtx.sampleRate;
      startTimeRef.current = Date.now();

      const source = audioCtx.createMediaStreamSource(stream);
      
      // Multi-stage filtering
      const highPass = audioCtx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.setValueAtTime(85, audioCtx.currentTime); 

      const presenceBoost = audioCtx.createBiquadFilter();
      presenceBoost.type = 'peaking';
      presenceBoost.frequency.setValueAtTime(3000, audioCtx.currentTime);
      presenceBoost.gain.setValueAtTime(3, audioCtx.currentTime);

      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-40, audioCtx.currentTime);
      compressor.knee.setValueAtTime(25, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(10, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

      const scriptProcessor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            scriptProcessor.onaudioprocess = (e) => {
              if (!isRecording) return;
              const inputData = e.inputBuffer.getChannelData(0);
              
              // RMS Signal Detection for Adaptive Gate
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              const db = 20 * Math.log10(rms || 0.00001);
              const normalizedLevel = Math.max(0, Math.min(100, (db + 60) * 1.6));
              setSignalLevel(normalizedLevel);

              // Adaptive Threshold Hysteresis
              const threshold = -60 + (noiseGateRef.current * 0.4); 
              const now = Date.now();
              const hasSpeech = db > threshold;
              
              if (hasSpeech) {
                gateLastActiveRef.current = now;
              }

              const isGateOpen = (now - gateLastActiveRef.current) < GATE_HOLD_MS;

              if (isGateOpen) {
                // Buffer Accumulation for Adaptive Chunking
                const newBuffer = new Float32Array(audioBufferAccumulator.current.length + inputData.length);
                newBuffer.set(audioBufferAccumulator.current);
                newBuffer.set(inputData, audioBufferAccumulator.current.length);
                audioBufferAccumulator.current = newBuffer;

                // Dynamic Buffering: Send immediately if loud, otherwise group to 2 buffers (approx 180ms)
                const isStrongSignal = db > (threshold + 10);
                if (audioBufferAccumulator.current.length >= BUFFER_SIZE * 2 || isStrongSignal) {
                  const pcmBlob = createBlob(audioBufferAccumulator.current, nativeRate);
                  sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
                  audioBufferAccumulator.current = new Float32Array(0);
                }
              } else {
                // Clear buffer if gate is closed to prevent "pops" when reopening
                audioBufferAccumulator.current = new Float32Array(0);
                // Send heartbeat to keep session alive
                if (Math.random() < 0.05) {
                  const silentData = new Float32Array(BUFFER_SIZE).fill(0);
                  const pcmBlob = createBlob(silentData, nativeRate);
                  sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
                }
              }
            };

            source.connect(highPass);
            highPass.connect(presenceBoost);
            presenceBoost.connect(compressor);
            compressor.connect(scriptProcessor);
            scriptProcessor.connect(audioCtx.destination);

            frameIntervalRef.current = window.setInterval(() => {
              if (videoRef.current && canvasRef.current && videoRef.current.videoWidth > 0) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  canvasRef.current.width = videoRef.current.videoWidth;
                  canvasRef.current.height = videoRef.current.videoHeight;
                  ctx.filter = `brightness(${brightness}%)`;
                  ctx.drawImage(videoRef.current, 0, 0);
                  const dataUrl = canvasRef.current.toDataURL('image/jpeg', JPEG_QUALITY);
                  const base64Data = dataUrl.split(',')[1];
                  if (base64Data) {
                    sessionPromise.then(session => session.sendRealtimeInput({ 
                      media: { data: base64Data, mimeType: 'image/jpeg' } 
                    })).catch(() => {});
                  }
                }
              }
            }, 1000 / aiVisionRate);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentSentenceRef.current += text;
              
              if (transcriptTimeoutRef.current) window.clearTimeout(transcriptTimeoutRef.current);
              transcriptTimeoutRef.current = window.setTimeout(() => {
                const raw = currentSentenceRef.current.trim();
                const sentences = raw.split(/(?<=[.!?])\s+/);
                const newSegments = sentences.map((s, i) => ({
                  id: `seg-${i}-${Date.now()}`,
                  text: s
                }));
                setTranscriptSegments(newSegments);
                const elapsedMins = (Date.now() - startTimeRef.current) / 60000;
                const words = raw.split(/\s+/).length;
                setWpm(Math.round(words / Math.max(elapsedMins, 0.01)));
              }, TRANSCRIPTION_DEBOUNCE_MS);
            }
          },
          onerror: (e: any) => {
            console.error(e);
            setError("Signal lost. Check network or hardware stability.");
            stopRecording();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: `You are an NYSC Executive Speech Coach. Tone: ${leadershipStyle}.`
        }
      });

      liveSessionRef.current = sessionPromise;
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: recorder.mimeType }));
      recorder.start(1000); 
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      setIsRecording(false);
      setError("System Access Denied. Diagnostic check required.");
      setShowDiagnostics(true);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') try { mediaRecorder.stop(); } catch (e) {}
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => { try { track.stop(); } catch (e) {} });
    if (videoRef.current) videoRef.current.srcObject = null;
    if (audioContextRef.current) try { audioContextRef.current.close().catch(() => {}); } catch (e) {}
    if (liveSessionRef.current) liveSessionRef.current.then((s: any) => { try { s.close(); } catch (e) {} }).catch(() => {});
    setIsRecording(false);
    setIsPseudoFullScreen(false);
  };

  const analyzeSpeech = async () => {
    if (!audioBlob || audioBlob.size === 0) {
      setError("Signal Capture Error: Empty audio buffer.");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const base64data = await blobToBase64(audioBlob);
      const fullTranscript = transcriptSegments.map(s => s.correction || s.text).join(' ');
      const analysis = await analyzeNYSCSpeech(base64data, scenario, leadershipStyle, audioBlob.type);
      onAnalysisComplete({
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        scenario,
        leadershipStyle,
        analysis: { ...analysis, transcript: fullTranscript }
      });
    } catch (err: any) {
      setError(`Audit failed: ${err.message || 'Administrative timeout.'}`);
      setIsAnalyzing(false);
    }
  };

  const handleSaveCorrection = (correction: string) => {
    if (!correctingSegment) return;
    setTranscriptSegments(prev => prev.map(s => 
      s.id === correctingSegment.id ? { ...s, correction } : s
    ));
    setCorrectingSegment(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-500">
      {showDiagnostics && <PermissionDiagnostics onRetry={startRecording} onClose={() => setShowDiagnostics(false)} />}
      {correctingSegment && (
        <SegmentCorrectionModal 
          segment={correctingSegment} 
          onClose={() => setCorrectingSegment(null)} 
          onSave={handleSaveCorrection} 
        />
      )}
      
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4 px-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Address Arena</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium italic">Advanced executive rehearsal stage.</p>
        </div>
        {!isRecording && !audioBlob && (
           <div className="flex items-center gap-3">
             <button onClick={() => setShowDiagnostics(true)} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">
               <ShieldCheck size={12} /> Access Check
             </button>
           </div>
        )}
      </header>

      {error && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-center justify-between gap-4 text-amber-900 animate-in shake">
           <div className="flex items-center gap-3 font-bold text-xs">
             <AlertCircle size={20} className="shrink-0 text-amber-600" />
             <p>{error}</p>
           </div>
           <button onClick={() => setShowDiagnostics(true)} className="px-6 py-2 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Troubleshoot</button>
        </div>
      )}

      {/* Arena Stage */}
      <div 
        ref={arenaRef}
        className={`relative bg-slate-950 overflow-hidden shadow-xl md:shadow-2xl transition-all duration-300 ${
          isPseudoFullScreen ? 'fixed inset-0 z-[100] w-screen h-screen border-0' : 'rounded-[1.5rem] md:rounded-[2.5rem] aspect-[4/3] md:aspect-[16/10] border-4 border-slate-900'
        } group`}
      >
        <div className="w-full h-full overflow-hidden flex items-center justify-center bg-black">
          <video 
            ref={videoRef} 
            muted 
            playsInline 
            style={{ transform: `scaleX(-1) scale(${zoomLevel})`, filter: `brightness(${brightness}%)` }}
            className={`w-full h-full object-cover transition-all duration-700 origin-center ${isRecording ? 'opacity-100' : 'opacity-20'}`} 
          />
          {!isRecording && !audioBlob && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-900/60 backdrop-blur-sm">
               <div className="p-6 bg-white/5 rounded-full border border-white/10 mb-2"><Mic size={48} className="text-green-500" /></div>
               <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Arena Calibrated</h2>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {/* HUD */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-30">
            <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full shadow-lg"><div className="w-2 h-2 rounded-full bg-white animate-pulse" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Live Audit</span></div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white flex items-center gap-2">
              <Waves size={10} className={`${signalLevel > noiseGateThreshold ? 'text-green-400' : 'text-blue-400'} transition-colors duration-200`} />
              <div className="flex items-center gap-1 w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-75 ${signalLevel > noiseGateThreshold ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-blue-500'}`} style={{ width: `${signalLevel}%` }} />
              </div>
            </div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white flex items-center gap-2"><Activity size={10} className="text-green-400" /><span className="text-[9px] font-black uppercase">{wpm} WPM</span></div>
          </div>
        )}

        {/* View Controls */}
        <div className={`absolute right-3 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 md:gap-3 z-40 ${isPseudoFullScreen ? 'pb-20' : ''}`}>
          <div className="p-1.5 md:p-2 bg-black/40 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 flex flex-col gap-2">
            {[ { id: 'wide', icon: Monitor, label: 'WIDE' }, { id: 'focused', icon: Target, label: 'FOCUS' }, { id: 'closeup', icon: Maximize2, label: 'CLOSE' } ].map(mode => (
              <button key={mode.id} onClick={() => setViewMode(mode.id as any)} className={`w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl flex flex-col items-center justify-center gap-0.5 md:gap-1 transition-all border ${viewMode === mode.id ? 'bg-green-600 border-green-500 text-white shadow-xl scale-105' : 'bg-white/5 border-transparent text-white/50 hover:text-white'}`}>
                <mode.icon size={16} /><span className="text-[6px] md:text-[7px] font-black uppercase">{mode.label}</span>
              </button>
            ))}
          </div>
          <div className="p-1.5 md:p-2 bg-black/40 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 flex flex-col gap-1 md:gap-2">
            <button 
              onClick={() => setIsPseudoFullScreen(!isPseudoFullScreen)} 
              title={isPseudoFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              className={`w-10 h-10 md:w-14 md:h-12 flex items-center justify-center rounded-lg text-white transition-all ${isPseudoFullScreen ? 'bg-amber-600 shadow-xl' : 'hover:bg-white/10 bg-white/5 border border-white/10'}`}
            >
              {isPseudoFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className={`w-10 h-10 md:w-14 md:h-12 flex items-center justify-center rounded-lg text-white transition-all ${showSettings ? 'bg-green-600 shadow-xl' : 'hover:bg-white/10 bg-white/5 border border-white/10'}`}><Sliders size={18} /></button>
          </div>
        </div>

        {/* Settings Menu */}
        {showSettings && (
          <div className="absolute bottom-24 right-4 md:right-32 bg-slate-900/95 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 w-64 md:w-80 shadow-2xl z-50 max-h-[70vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-right-10">
            <div className="flex items-center justify-between mb-6"><h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2"><Settings size={14} className="text-green-500" /> Executive Tuner</h3><button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white"><X size={18} /></button></div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/70 uppercase"><span className="flex items-center gap-2"><BarChart3 size={14} className="text-blue-400" /> Acoustic Gate</span><span className="text-blue-400">{noiseGateThreshold}%</span></div>
                <input type="range" min="0" max="100" value={noiseGateThreshold} onChange={(e) => setNoiseGateThreshold(parseInt(e.target.value))} className="w-full h-1 appearance-none bg-white/10 rounded-full cursor-pointer" />
                <p className="text-[8px] text-white/40 font-medium italic">Adjust to isolate your voice from room ambience.</p>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-[10px] font-black text-green-500 uppercase tracking-widest"><Video size={12} /> Optic Definition</div>
                <div className="grid grid-cols-3 gap-2">
                  {['480p', '720p', '1080p'].map(res => (
                    <button 
                      key={res} 
                      onClick={() => setTargetResolution(res as any)}
                      disabled={isRecording}
                      className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${targetResolution === res ? 'bg-green-600 border-green-500 text-white' : 'bg-white/5 border-transparent text-white/40 hover:text-white'} ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/70 uppercase"><span className="flex items-center gap-2"><Cpu size={14} /> AI Analysis Rate</span><span className="text-green-500">{aiVisionRate} FPS</span></div>
                <input type="range" min="0.5" max="5" step="0.5" value={aiVisionRate} onChange={(e) => setAiVisionRate(parseFloat(e.target.value))} className="w-full h-1 appearance-none bg-white/10 rounded-full cursor-pointer" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/70 uppercase"><span>Stage Display Rate</span><span className="text-amber-400">{hardwareFPS} Hz</span></div>
                <div className="grid grid-cols-2 gap-2">
                  {[30, 60].map(fps => (
                    <button 
                      key={fps} 
                      onClick={() => setHardwareFPS(fps)}
                      disabled={isRecording}
                      className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${hardwareFPS === fps ? 'bg-amber-600 border-amber-500 text-white' : 'bg-white/5 border-transparent text-white/40 hover:text-white'} ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/70 uppercase"><span className="flex items-center gap-2"><Sun size={14} /> Brightness</span><span className="text-green-500">{brightness}%</span></div>
                <input type="range" min="50" max="200" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full h-1 appearance-none bg-white/10 rounded-full cursor-pointer" />
              </div>

              <button 
                onClick={() => { setBrightness(100); setNoiseGateThreshold(20); setTargetResolution('720p'); setAiVisionRate(1.5); setHardwareFPS(30); }} 
                className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest flex items-center justify-center gap-2 border border-white/5 mt-2 transition-colors"
              >
                <RotateCcw size={14} /> Factory Reset
              </button>
            </div>
          </div>
        )}

        {/* Segmented Transcript Overlay */}
        <div className={`absolute bottom-0 inset-x-0 p-4 md:p-10 bg-gradient-to-t from-black via-black/40 to-transparent z-30 transition-all ${isPseudoFullScreen ? 'pb-16' : ''}`}>
          <div className="max-w-4xl mx-auto">
             <div className="h-28 md:h-40 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start gap-3">
                {transcriptSegments.length === 0 && isRecording && <p className="text-white/50 text-sm font-black uppercase tracking-widest animate-pulse">Establishing Signal Uplink...</p>}
                {transcriptSegments.map((seg, idx) => (
                  <div key={seg.id} className="group relative w-full flex items-center justify-center gap-3">
                    <p className={`font-serif leading-tight italic transition-all duration-300 drop-shadow-2xl text-center max-w-2xl ${seg.correction ? 'text-green-400' : 'text-white'} ${isPseudoFullScreen ? 'text-xl md:text-3xl' : 'text-sm md:text-xl'}`}>
                      {seg.correction || seg.text}
                    </p>
                    <button 
                      onClick={() => setCorrectingSegment(seg)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all scale-75 md:scale-100"
                      title="Calibrate sentence"
                    >
                      <Flag size={14} fill={seg.correction ? "currentColor" : "none"} />
                    </button>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
             </div>
          </div>
        </div>
      </div>

      {/* Control Area */}
      {!isPseudoFullScreen && (
        <div className="flex flex-col items-center gap-4 pb-20 md:pb-12">
          <div className="w-full bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <div className="flex flex-col gap-1.5 flex-1 w-full md:w-auto">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Monitor size={10} /> Scenario</label>
               <select value={scenario} disabled={isRecording} onChange={(e) => setScenario(e.target.value as NYSCScenario)} className="w-full font-black text-sm text-slate-800 outline-none bg-slate-50 p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                 {Object.values(NYSCScenario).map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
            
            <div className="flex flex-col gap-1.5 flex-1 w-full md:w-auto">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserCheck size={10} /> Leadership Tone</label>
               <select value={leadershipStyle} disabled={isRecording} onChange={(e) => setLeadershipStyle(e.target.value as LeadershipStyle)} className="w-full font-black text-sm text-slate-800 outline-none bg-slate-50 p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                 {Object.values(LeadershipStyle).map(ls => <option key={ls} value={ls}>{ls}</option>)}
               </select>
            </div>

            <div className="w-full md:w-auto flex justify-center pt-2 md:pt-0">
              {!isRecording && !audioBlob && (
                 <button onClick={startRecording} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 text-base">
                   <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"><Play size={16} fill="currentColor" className="ml-0.5" /></div>
                   Initialize Address
                 </button>
              )}
              {isRecording && (
                 <button onClick={stopRecording} className="w-full md:w-auto px-10 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 text-base animate-pulse">
                   <Square size={16} fill="currentColor" /> Conclude Address
                 </button>
              )}
              {audioBlob && !isRecording && (
                <div className="w-full md:w-auto flex items-center gap-3 flex-1">
                  <button onClick={() => { setAudioBlob(null); setTranscriptSegments([]); }} className="px-5 py-4 text-slate-400 font-black hover:text-slate-900 text-xs tracking-widest uppercase">Discard</button>
                  <button onClick={analyzeSpeech} disabled={isAnalyzing} className="flex-1 px-10 py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 shadow-xl transition-all active:scale-95">
                    {isAnalyzing ? "Analyzing Signal..." : "Generate Performance Audit"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- App Root ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'practice' | 'analysis' | 'knowledge'>('dashboard');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SessionRecord | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('nysc_oratory_sessions');
    if (saved) setSessions(JSON.parse(saved));
  }, []);

  const handleAnalysisComplete = (newRecord: SessionRecord) => {
    setSessions(prev => [newRecord, ...prev]);
    localStorage.setItem('nysc_oratory_sessions', JSON.stringify([newRecord, ...sessions]));
    setSelectedAnalysis(newRecord);
    setActiveTab('analysis');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 selection:bg-green-100">
      <aside className="hidden md:flex w-72 bg-slate-900 p-8 flex-col fixed h-full z-50 border-r border-slate-800">
        <div className="flex items-center gap-4 mb-16">
          <div className="bg-green-600 p-3 rounded-2xl shadow-2xl shadow-green-900/40"><ShieldCheck className="text-white" size={32} /></div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">NYSC <span className="text-green-500">Pro</span></h1>
        </div>
        <nav className="space-y-3 flex-1">
          <NavItem icon={LayoutDashboard} label="Address Arena" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={Mic} label="Executive Stage" active={activeTab === 'practice'} onClick={() => setActiveTab('practice')} />
          <NavItem icon={GraduationCap} label="Policy Archive" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} />
        </nav>
        <div className="mt-auto p-5 bg-slate-800/40 rounded-[2rem] border border-white/5">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-700 flex items-center justify-center font-black text-white text-sm">AD</div>
              <div><p className="text-[10px] font-black text-white uppercase tracking-widest">Executive User</p></div>
           </div>
        </div>
      </aside>

      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white sticky top-0 z-50">
        <div className="flex items-center gap-2">
           <div className="bg-green-600 p-1.5 rounded-lg"><ShieldCheck size={20} /></div>
           <span className="font-black text-lg tracking-tighter">NYSC Pro</span>
        </div>
      </header>

      <main className="flex-1 md:ml-72 min-h-screen p-4 md:p-16 overflow-y-auto pb-24 md:pb-16">
        {activeTab === 'dashboard' && <Dashboard records={sessions} />}
        {activeTab === 'practice' && <AddressArena onAnalysisComplete={handleAnalysisComplete} />}
        {activeTab === 'knowledge' && <KnowledgeHub />}
        {activeTab === 'analysis' && selectedAnalysis && (
          <AnalysisView record={selectedAnalysis} onBack={() => { setActiveTab('dashboard'); setSelectedAnalysis(null); }} />
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white/80 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around z-50 px-2 pb-safe shadow-2xl">
        <NavItem icon={LayoutDashboard} label="Arena" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isMobile />
        <NavItem icon={Mic} label="Stage" active={activeTab === 'practice'} onClick={() => setActiveTab('practice')} isMobile />
        <NavItem icon={GraduationCap} label="Policy" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} isMobile />
      </nav>
    </div>
  );
}

const Dashboard: React.FC<{ records: SessionRecord[] }> = ({ records }) => {
  const avgScore = records.length > 0 ? Math.round(records.reduce((acc, r) => acc + r.analysis.overallScore, 0) / records.length) : 0;
  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-1000">
      <div><h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">NYSC Executive Oratory</h1><p className="text-slate-500 font-medium">Strategic communication coaching for high-level officials.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-10">
        <div className="bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-xl">
          <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Average Score</p>
          <h3 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter">{avgScore}%</h3>
        </div>
        <div className="bg-slate-900 p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] shadow-2xl text-white">
          <p className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Total Addresses</p>
          <h3 className="text-5xl md:text-8xl font-black text-white tracking-tighter">{records.length}</h3>
        </div>
      </div>
      {records.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">Archives</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {records.slice(0, 4).map(r => (
              <div key={r.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group cursor-pointer shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${r.analysis.overallScore > 75 ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{r.analysis.overallScore}</div>
                  <div><p className="font-black text-slate-900 text-sm truncate">{r.scenario}</p><p className="text-[9px] text-slate-400 font-black uppercase">{r.date.split(',')[0]}</p></div>
                </div>
                <ChevronRight size={20} className="text-slate-200 group-hover:text-green-600 transition-all" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const AnalysisView: React.FC<{ record: SessionRecord, onBack: () => void }> = ({ record, onBack }) => {
  const analysis = record.analysis;
  return (
    <div className="space-y-8 md:space-y-12 animate-in zoom-in-95 duration-700 pb-24">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest bg-white px-5 py-3 rounded-full border border-slate-200 shadow-md"><ChevronRight size={16} className="rotate-180" /> Back</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl">
            <h2 className="text-2xl font-black text-slate-900 mb-8">Performance Audit</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{analysis.metrics.map((m, i) => <MetricCard key={i} label={m.label} score={m.score} feedback={m.feedback} />)}</div>
          </section>
          <section className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl">
            <h2 className="text-xl font-black text-white mb-6">Calibrated Transcript</h2>
            <div className="p-6 bg-slate-800 rounded-[1.5rem] text-slate-200 font-serif text-lg italic border border-white/5 leading-relaxed">{analysis.transcript}</div>
          </section>
        </div>
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-green-600 to-green-900 p-10 rounded-[2rem] text-white shadow-2xl flex flex-col items-center">
            <h3 className="text-7xl font-black mb-1 tracking-tighter">{analysis.overallScore}%</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 text-center">Executive Quotient</p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-2xl">
             <h2 className="font-black text-slate-900 text-sm uppercase mb-6 flex items-center gap-3"><ShieldCheck size={24} className="text-green-600" /> Command Strengths</h2>
             {analysis.strengths.map((s, i) => <div key={i} className="text-xs font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl mb-3 border border-slate-100">{s}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
};

const KnowledgeHub: React.FC = () => (
  <div className="space-y-8 md:space-y-12 animate-in slide-in-from-right-10 duration-1000 pb-20">
    <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Policy Archive</h1>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
       {[
         { title: 'NYSC Act 1993', desc: 'The operational foundation of corps management.', color: 'bg-green-100 text-green-700' },
         { title: 'Bye-Laws 2024', desc: 'Administrative disciplinary guidelines.', color: 'bg-blue-100 text-blue-700' },
         { title: 'Crisis Response', desc: 'SOPs for field office emergencies.', color: 'bg-purple-100 text-purple-700' }
       ].map(item => (
         <div key={item.title} className="bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-lg flex flex-col items-center text-center">
            <div className={`p-4 rounded-2xl mb-4 ${item.color}`}><ShieldCheck size={28} /></div>
            <h3 className="font-black text-slate-900 text-lg mb-2">{item.title}</h3>
            <p className="text-xs text-slate-500 font-bold">{item.desc}</p>
         </div>
       ))}
    </div>
  </div>
);
