
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
  CheckCircle2
} from 'lucide-react';
import { NYSCScenario, LeadershipStyle, SessionRecord, CoachingAlert } from './types';
import { analyzeNYSCSpeech } from './services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

// --- Constants ---
const FRAME_RATE = 1; 
const JPEG_QUALITY = 0.4;

// --- Utils ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
};

// --- Sub-components ---

const PermissionDiagnostics: React.FC<{ onRetry: () => void, onClose: () => void }> = ({ onRetry, onClose }) => {
  const [micState, setMicState] = useState<PermissionState | 'unknown'>('unknown');
  const [camState, setCamState] = useState<PermissionState | 'unknown'>('unknown');

  useEffect(() => {
    const checkPerms = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const mic = await navigator.permissions.query({ name: 'microphone' as any });
          const cam = await navigator.permissions.query({ name: 'camera' as any });
          setMicState(mic.state);
          setCamState(cam.state);
          mic.onchange = () => setMicState(mic.state);
          cam.onchange = () => setCamState(cam.state);
        }
      } catch (e) {
        console.warn("Permissions API not fully supported", e);
      }
    };
    checkPerms();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><AlertCircle size={24} /></div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Access Diagnostics</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={24} /></button>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-5 rounded-2xl border ${micState === 'granted' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
              <div className="flex justify-between items-start mb-3">
                <Mic size={20} />
                {micState === 'granted' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1">Microphone</p>
              <p className="text-lg font-black capitalize">{micState}</p>
            </div>
            <div className={`p-5 rounded-2xl border ${camState === 'granted' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
              <div className="flex justify-between items-start mb-3">
                <Camera size={20} />
                {camState === 'granted' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1">Camera</p>
              <p className="text-lg font-black capitalize">{camState}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Info size={14} /> Recovery Steps</h3>
            <ul className="space-y-3">
              <li className="flex gap-3 text-sm font-medium text-slate-600">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center shrink-0">1</span>
                Look at your browser's address bar. Click the <strong>lock icon</strong> or <strong>settings icon</strong>.
              </li>
              <li className="flex gap-3 text-sm font-medium text-slate-600">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center shrink-0">2</span>
                Locate <strong>Camera</strong> and <strong>Microphone</strong>. Toggle them to "Allow".
              </li>
              <li className="flex gap-3 text-sm font-medium text-slate-600">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center shrink-0">3</span>
                Refresh the page or click "Retry System Link" below.
              </li>
            </ul>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button onClick={onRetry} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 shadow-xl transition-all flex items-center justify-center gap-2">
              <RefreshCw size={18} /> Retry System Link
            </button>
            <button onClick={onClose} className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600">Close Diagnostics</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NavItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void, isMobile?: boolean }> = ({ icon: Icon, label, active, onClick, isMobile }) => {
  if (isMobile) {
    return (
      <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all ${
          active ? 'text-green-500' : 'text-slate-400'
        }`}
      >
        <Icon size={20} />
        <span className="text-[10px] font-bold uppercase tracking-tighter">{label.split(' ')[0]}</span>
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active ? 'bg-green-700 text-white shadow-xl shadow-green-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="font-semibold text-sm">{label}</span>
    </button>
  );
};

const MetricCard: React.FC<{ label: string, score: number, feedback: string }> = ({ label, score, feedback }) => (
  <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-center mb-2 md:mb-3">
      <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-lg md:text-xl font-black ${score > 70 ? 'text-green-600' : score > 40 ? 'text-amber-500' : 'text-red-500'}`}>
        {score}%
      </span>
    </div>
    <div className="w-full bg-slate-100 h-2 rounded-full mb-3 md:mb-4 overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-1000 ease-out ${score > 70 ? 'bg-green-500' : score > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
        style={{ width: `${score}%` }}
      />
    </div>
    <p className="text-[10px] md:text-xs text-slate-600 font-medium italic leading-relaxed">"{feedback}"</p>
  </div>
);

// --- Address Arena Component ---
const AddressArena: React.FC<{ onAnalysisComplete: (analysis: SessionRecord) => void }> = ({ onAnalysisComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [scenario, setScenario] = useState<NYSCScenario>(NYSCScenario.CAMP_ADDRESS);
  const [leadershipStyle, setLeadershipStyle] = useState<LeadershipStyle>(LeadershipStyle.COMMANDING);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [coachingAlerts, setCoachingAlerts] = useState<CoachingAlert[]>([]);
  const [wpm, setWpm] = useState<number>(0);
  
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'wide' | 'focused' | 'closeup'>('wide');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPseudoFullScreen, setIsPseudoFullScreen] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const arenaRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const currentTranscriptRef = useRef<string>("");
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveTranscript]);

  useEffect(() => {
    switch (viewMode) {
      case 'wide': setZoomLevel(1); break;
      case 'focused': setZoomLevel(1.4); break;
      case 'closeup': setZoomLevel(2.0); break;
    }
  }, [viewMode]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
      if (!(document.fullscreenElement || (document as any).webkitFullscreenElement)) {
        setIsPseudoFullScreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullScreen = () => {
    const elem = arenaRef.current;
    if (!elem) return;

    const isCurrentlyFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || isPseudoFullScreen);

    if (!isCurrentlyFS) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => setIsPseudoFullScreen(true));
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else {
        setIsPseudoFullScreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsPseudoFullScreen(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    setShowDiagnostics(false);
    setLiveTranscript("");
    setCoachingAlerts([]);
    setWpm(0);
    currentTranscriptRef.current = "";
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }, 
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioCtx.resume();
      audioContextRef.current = audioCtx;
      startTimeRef.current = Date.now();

      // Advanced Audio Processing Chain for Noise Filtering
      const source = audioCtx.createMediaStreamSource(stream);
      
      // High-pass filter to remove low-frequency rumble (fan noise, background hum)
      const highPassFilter = audioCtx.createBiquadFilter();
      highPassFilter.type = 'highpass';
      highPassFilter.frequency.setValueAtTime(100, audioCtx.currentTime); // Filter everything below 100Hz
      
      // Dynamic compressor to normalize levels
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, audioCtx.currentTime);
      compressor.knee.setValueAtTime(40, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

      const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
            };
            
            // Connect nodes: Source -> HighPass -> Compressor -> Processor
            source.connect(highPassFilter);
            highPassFilter.connect(compressor);
            compressor.connect(scriptProcessor);
            scriptProcessor.connect(audioCtx.destination);

            frameIntervalRef.current = window.setInterval(() => {
              if (videoRef.current && canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  canvasRef.current.width = videoRef.current.videoWidth || 640;
                  canvasRef.current.height = videoRef.current.videoHeight || 480;
                  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
                  ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                  canvasRef.current.toBlob(async (blob) => {
                    if (blob) {
                      const base64Data = await blobToBase64(blob);
                      sessionPromise.then(session => session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } })).catch(() => {});
                    }
                  }, 'image/jpeg', JPEG_QUALITY);
                }
              }
            }, 1000 / FRAME_RATE);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentTranscriptRef.current += text;
              setLiveTranscript(currentTranscriptRef.current);
              const elapsedMins = (Date.now() - startTimeRef.current) / 60000;
              const words = currentTranscriptRef.current.trim().split(/\s+/).length;
              setWpm(Math.round(words / Math.max(elapsedMins, 0.01)));
            }
          },
          onerror: (e: any) => {
            console.error(e);
            setError("Stream interrupted. Ensure a stable network connection.");
            stopRecording();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: 'You are an NYSC Executive Speech Coach. NOISE SUPPRESSION MODE: ENABLED. Transcribe accurately for administrative terminologies.'
        }
      });

      liveSessionRef.current = sessionPromise;
      
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
        }
      } else {
        mimeType = '';
      }

      const recorderOptions = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: recorder.mimeType }));
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

    } catch (err: any) {
      console.error(err);
      setIsRecording(false);
      setError("System Access Denied. NYSC Oratory Pro requires microphone and camera access to provide executive analysis.");
      setShowDiagnostics(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) mediaRecorder.stop();
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (liveSessionRef.current) liveSessionRef.current.then((s: any) => s.close()).catch(() => {});
    setIsRecording(false);
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    }
    setIsPseudoFullScreen(false);
  };

  const analyzeSpeech = async () => {
    if (!audioBlob) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const base64data = await blobToBase64(audioBlob);
      const analysis = await analyzeNYSCSpeech(base64data, scenario, leadershipStyle, audioBlob.type);
      onAnalysisComplete({
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        scenario,
        leadershipStyle,
        analysis
      });
    } catch (err: any) {
      setError("Audit generation failed. Signal processing interrupted.");
      setIsAnalyzing(false);
    }
  };

  const resetCameraSettings = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  const inFullScreenMode = isFullScreen || isPseudoFullScreen;

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-500">
      {showDiagnostics && <PermissionDiagnostics onRetry={startRecording} onClose={() => setShowDiagnostics(false)} />}
      
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4 px-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Address Arena</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium italic">Administrative Oratory Protocol Active.</p>
        </div>
        {!isRecording && !audioBlob && (
           <div className="flex items-center gap-3">
             <button onClick={() => setShowDiagnostics(true)} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">
               <ShieldCheck size={12} /> Access Check
             </button>
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-full">
               <Camera size={12} /> Optic Link
             </div>
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-full">
               <Mic size={12} /> Audio Link
             </div>
           </div>
        )}
      </header>

      {error && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-amber-900 animate-in shake duration-300">
           <div className="flex items-center gap-3 font-bold text-xs md:text-sm">
             <AlertCircle size={20} className="shrink-0 text-amber-600" />
             <p>{error}</p>
           </div>
           <button onClick={() => setShowDiagnostics(true)} className="px-6 py-2 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 shadow-md">Troubleshoot Access</button>
        </div>
      )}

      {/* Arena Stage Container */}
      <div 
        ref={arenaRef}
        className={`relative bg-slate-950 overflow-hidden shadow-xl md:shadow-2xl border-slate-900 transition-all duration-300 ${
          inFullScreenMode 
          ? 'fixed inset-0 z-[100] w-screen h-screen border-0 rounded-none' 
          : 'rounded-[1.5rem] md:rounded-[2.5rem] border-2 md:border-4 aspect-[4/3] md:aspect-[16/10]'
        } group`}
      >
        <div className="w-full h-full overflow-hidden flex items-center justify-center bg-black">
          <video 
            ref={videoRef} 
            muted 
            playsInline 
            style={{ 
              transform: `scaleX(-1) scale(${zoomLevel})`,
              filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
            }}
            className={`w-full h-full object-cover transition-all duration-700 origin-center ${isRecording ? 'opacity-100' : 'opacity-20'}`} 
          />
          {!isRecording && !audioBlob && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-900/60 backdrop-blur-sm">
               <div className="p-6 bg-white/5 rounded-full border border-white/10 mb-2">
                 <Mic size={48} className="text-green-500" />
               </div>
               <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">System Ready</h2>
               <p className="text-slate-300 text-xs md:text-sm max-w-sm">Noise filters, frequency gates, and administrative models are primed. Click 'Start Address' below.</p>
               {error && <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest animate-pulse mt-4">Hardware Link Failure Detected</p>}
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {/* HUD Stats */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-30">
            <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full shadow-lg">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-[9px] font-black text-white uppercase tracking-widest">Live Audit</span>
            </div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white flex items-center gap-2">
              <Waves size={10} className="text-blue-400" />
              <span className="text-[9px] font-black uppercase tracking-tighter">Biquad Filter Engaged</span>
            </div>
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white flex items-center gap-2">
              <Activity size={10} className="text-green-400" />
              <span className="text-[9px] font-black uppercase">{wpm} WPM</span>
            </div>
          </div>
        )}

        {/* View Controls & Full Screen Toggle */}
        <div className={`absolute right-3 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 md:gap-3 z-40 ${inFullScreenMode ? 'pb-20' : ''}`}>
          <div className="p-1.5 md:p-2 bg-black/40 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 flex flex-col gap-2">
            {[
              { id: 'wide', icon: Monitor, label: 'WIDE' },
              { id: 'focused', icon: Target, label: 'FOCUS' },
              { id: 'closeup', icon: Maximize2, label: 'CLOSE' }
            ].map(mode => (
              <button 
                key={mode.id}
                onClick={() => setViewMode(mode.id as any)}
                className={`w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl flex flex-col items-center justify-center gap-0.5 md:gap-1 transition-all border ${
                  viewMode === mode.id 
                  ? 'bg-green-600 border-green-500 text-white shadow-xl scale-105 md:scale-110' 
                  : 'bg-white/5 border-transparent text-white/50 hover:text-white'
                }`}
              >
                <mode.icon size={16} />
                <span className="text-[6px] md:text-[7px] font-black uppercase">{mode.label}</span>
              </button>
            ))}
          </div>
          
          <div className="p-1.5 md:p-2 bg-black/40 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 flex flex-col gap-1 md:gap-2">
              <button 
                onClick={toggleFullScreen} 
                className={`w-10 h-10 md:w-14 md:h-12 flex items-center justify-center rounded-lg text-white transition-all ${inFullScreenMode ? 'bg-green-600' : 'hover:bg-white/10'}`}
                title={inFullScreenMode ? "Exit Full Screen" : "Enter Full Screen"}
              >
                {inFullScreenMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.1, 3.5))} className="w-10 h-10 md:w-14 md:h-12 flex items-center justify-center hover:bg-white/10 rounded-lg text-white"><ZoomIn size={18} /></button>
              <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.1, 1))} className="w-10 h-10 md:w-14 md:h-12 flex items-center justify-center hover:bg-white/10 rounded-lg text-white"><ZoomOut size={18} /></button>
              <button onClick={() => setShowSettings(!showSettings)} className={`w-10 h-10 md:w-14 md:h-12 flex items-center justify-center rounded-lg text-white transition-all ${showSettings ? 'bg-green-600' : 'hover:bg-white/10'}`}><Sliders size={18} /></button>
          </div>
        </div>

        {/* Tuning Menu */}
        {showSettings && (
          <div className="absolute bottom-24 right-4 md:right-32 bg-slate-900/95 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 w-64 md:w-80 shadow-2xl z-50 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Settings size={14} className="text-green-500" /> Optical Calibration
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/70 uppercase"><span className="flex items-center gap-2"><Sun size={14} /> Brightness</span><span className="text-green-500">{brightness}%</span></div>
                <input type="range" min="50" max="200" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full h-1 appearance-none bg-white/10 rounded-full cursor-pointer" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/70 uppercase"><span className="flex items-center gap-2"><Contrast size={14} /> Contrast</span><span className="text-green-500">{contrast}%</span></div>
                <input type="range" min="50" max="200" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full h-1 appearance-none bg-white/10 rounded-full cursor-pointer" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/70 uppercase"><span className="flex items-center gap-2"><Palette size={14} /> Saturation</span><span className="text-green-500">{saturation}%</span></div>
                <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(parseInt(e.target.value))} className="w-full h-1 appearance-none bg-white/10 rounded-full cursor-pointer" />
              </div>
              <button onClick={resetCameraSettings} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest flex items-center justify-center gap-2 border border-white/5"><RotateCcw size={14} /> Reset</button>
            </div>
          </div>
        )}

        {/* Pseudo-FullScreen Exit Button */}
        {isPseudoFullScreen && (
          <button 
            onClick={stopRecording}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-600 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-2"
          >
            <Square size={14} fill="currentColor" /> Finish Address
          </button>
        )}

        {/* Lower Third Transcript */}
        <div className={`absolute bottom-0 inset-x-0 p-4 md:p-10 bg-gradient-to-t from-black via-black/40 to-transparent z-30 transition-all ${inFullScreenMode ? 'pb-16' : ''}`}>
          <div className="max-w-4xl mx-auto text-center">
             <div className="h-20 md:h-32 overflow-y-auto custom-scrollbar flex items-end justify-center">
                <p className={`font-serif text-white leading-tight italic opacity-95 transition-all duration-300 drop-shadow-2xl ${inFullScreenMode ? 'text-2xl md:text-4xl' : 'text-lg md:text-2xl'}`}>
                  {liveTranscript || (isRecording ? "Transmitting high-fidelity audio signal..." : "")}
                </p>
                <div ref={transcriptEndRef} />
             </div>
          </div>
        </div>
      </div>

      {/* Control Area */}
      {!inFullScreenMode && (
        <div className="flex flex-col items-center gap-4 pb-20 md:pb-12">
          <div className="w-full bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="w-full md:w-auto flex flex-col gap-1.5 md:pr-10 md:border-r border-slate-100">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scenario</label>
               <select value={scenario} disabled={isRecording} onChange={(e) => setScenario(e.target.value as NYSCScenario)} className="w-full md:w-auto font-black text-sm text-slate-800 outline-none bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl cursor-pointer">
                 {Object.values(NYSCScenario).map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
            <div className="w-full md:w-auto flex flex-col gap-1.5 md:pr-10 md:border-r border-slate-100">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leadership Tone</label>
               <select value={leadershipStyle} disabled={isRecording} onChange={(e) => setLeadershipStyle(e.target.value as LeadershipStyle)} className="w-full md:w-auto font-black text-sm text-slate-800 outline-none bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl cursor-pointer">
                 {Object.values(LeadershipStyle).map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
            <div className="w-full md:w-auto flex justify-center flex-1">
              {!isRecording && !audioBlob && (
                 <button onClick={startRecording} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 text-base">
                   <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"><Play size={16} fill="currentColor" className="ml-0.5" /></div>
                   Start Address
                 </button>
              )}
              {isRecording && (
                 <button onClick={stopRecording} className="w-full md:w-auto px-10 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 text-base animate-pulse">
                   <Square size={16} fill="currentColor" /> Conclude Address
                 </button>
              )}
              {audioBlob && !isRecording && (
                <div className="w-full md:w-auto flex items-center gap-3 flex-1">
                  <button onClick={() => { setAudioBlob(null); setLiveTranscript(""); }} className="px-5 py-4 text-slate-400 font-black hover:text-slate-900 text-xs tracking-widest uppercase">Discard</button>
                  <button onClick={analyzeSpeech} disabled={isAnalyzing} className="flex-1 px-10 py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 shadow-xl transition-all active:scale-95">
                    {isAnalyzing ? "Analyzing High-Fidelity Signal..." : "Generate Pro Audit"}
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
      {/* Sidebar */}
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
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">Executive User</p>
                <p className="text-[8px] font-black text-slate-500 uppercase">Zonal Inspectorate</p>
              </div>
           </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white sticky top-0 z-50">
        <div className="flex items-center gap-2">
           <div className="bg-green-600 p-1.5 rounded-lg"><ShieldCheck size={20} /></div>
           <span className="font-black text-lg tracking-tighter">NYSC Pro</span>
        </div>
        <div className="text-[10px] font-black text-green-500 uppercase tracking-widest">Executive Level</div>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 min-h-screen p-4 md:p-16 overflow-y-auto pb-24 md:pb-16">
        {activeTab === 'dashboard' && <Dashboard records={sessions} />}
        {activeTab === 'practice' && <AddressArena onAnalysisComplete={handleAnalysisComplete} />}
        {activeTab === 'knowledge' && <KnowledgeHub />}
        {activeTab === 'analysis' && selectedAnalysis && (
          <AnalysisView record={selectedAnalysis} onBack={() => { setActiveTab('dashboard'); setSelectedAnalysis(null); }} />
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white/80 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around z-50 px-2 pb-safe shadow-2xl">
        <NavItem icon={LayoutDashboard} label="Arena" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isMobile />
        <NavItem icon={Mic} label="Stage" active={activeTab === 'practice'} onClick={() => setActiveTab('practice')} isMobile />
        <NavItem icon={GraduationCap} label="Policy" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} isMobile />
      </nav>
    </div>
  );
}

// --- Dashboard Component ---
const Dashboard: React.FC<{ records: SessionRecord[] }> = ({ records }) => {
  const avgScore = records.length > 0 ? Math.round(records.reduce((acc, r) => acc + r.analysis.overallScore, 0) / records.length) : 0;
  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-1000">
      <div>
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">NYSC Pro</h1>
        <p className="text-slate-500 mt-1 md:mt-2 font-medium text-sm md:text-lg">Analyzing administrative oratory and command impact.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-10">
        <div className="bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-xl relative overflow-hidden group">
          <Award size={48} className="absolute -top-2 -right-2 text-green-100 rotate-12 md:size-20" />
          <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 md:mb-4">Average Signal Score</p>
          <h3 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter">{avgScore}%</h3>
        </div>
        <div className="bg-slate-900 p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] shadow-2xl text-white group overflow-hidden relative">
          <History size={48} className="absolute -top-2 -right-2 text-white/5 -rotate-12 md:size-20" />
          <p className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 md:mb-4">Executive Sessions</p>
          <h3 className="text-5xl md:text-8xl font-black text-white tracking-tighter">{records.length}</h3>
        </div>
      </div>
      
      {records.length > 0 && (
        <section className="space-y-4 md:space-y-8">
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Monitor size={20} className="text-green-600" /> Administrative Archives</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {records.slice(0, 4).map(r => (
              <div key={r.id} className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border border-slate-100 flex items-center justify-between group hover:border-green-300 transition-all cursor-pointer shadow-sm">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] flex items-center justify-center font-black text-base md:text-xl ${r.analysis.overallScore > 75 ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{r.analysis.overallScore}</div>
                  <div><p className="font-black text-slate-900 text-sm md:text-lg truncate max-w-[150px] md:max-w-[200px]">{r.scenario}</p><p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase">{r.date.split(',')[0]}</p></div>
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
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-black text-[10px] md:text-[11px] uppercase tracking-widest hover:text-slate-900 transition-all bg-white px-5 md:px-8 py-3 md:py-4 rounded-full border border-slate-200 shadow-md"><ChevronRight size={16} className="rotate-180" /> Return to Hub</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        <div className="lg:col-span-2 space-y-8 md:space-y-12">
          <section className="bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-xl">
            <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter mb-8 md:mb-16">High-Fidelity Audit</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-10">{analysis.metrics.map((m, i) => <MetricCard key={i} label={m.label} score={m.score} feedback={m.feedback} />)}</div>
          </section>
          <section className="bg-slate-900 p-8 md:p-16 rounded-[2rem] md:rounded-[4.5rem] shadow-2xl">
            <h2 className="text-xl md:text-2xl font-black text-white mb-6 md:mb-10 tracking-tight">Signal Transcript</h2>
            <div className="p-6 md:p-12 bg-slate-800/80 rounded-[1.5rem] md:rounded-[3rem] text-slate-200 leading-relaxed font-serif text-lg md:text-2xl italic border border-white/5">{analysis.transcript}</div>
          </section>
        </div>
        <div className="space-y-8 md:space-y-12">
          <div className="bg-gradient-to-br from-green-600 to-green-900 p-10 md:p-16 rounded-[2rem] md:rounded-[4rem] text-white shadow-2xl flex flex-col items-center">
            <h3 className="text-7xl md:text-9xl font-black mb-1 md:mb-2 tracking-tighter">{analysis.overallScore}%</h3>
            <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] opacity-80 text-center">Final Factor</p>
          </div>
          <div className="bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border border-slate-200 shadow-2xl">
             <h2 className="font-black text-slate-900 text-sm md:text-lg uppercase tracking-widest mb-6 md:mb-10 flex items-center gap-3 md:gap-4"><ShieldCheck size={24} className="text-green-600" /> Command Strengths</h2>
             {analysis.strengths.map((s, i) => <div key={i} className="text-xs md:text-sm font-bold text-slate-700 bg-slate-50 p-4 md:p-6 rounded-2xl md:rounded-3xl mb-3 md:mb-4 border border-slate-100">{s}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
};

const KnowledgeHub: React.FC = () => (
  <div className="space-y-8 md:space-y-12 animate-in slide-in-from-right-10 duration-1000 pb-20">
    <div>
      <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">Policy Archive</h1>
      <p className="text-slate-500 mt-1 md:mt-2 font-medium text-sm md:text-lg italic">Strategic alignment with the NYSC Act (1993/2004).</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
       {[
         { title: 'NYSC Act 1993', desc: 'The operational foundation of corps management and administrative authority.', color: 'bg-green-100 text-green-700' },
         { title: 'Bye-Laws 2024', desc: 'Administrative disciplinary and social guidelines for corps members.', color: 'bg-blue-100 text-blue-700' },
         { title: 'Crisis Response', desc: 'Standard operating procedures for field office emergencies.', color: 'bg-purple-100 text-purple-700' }
       ].map(item => (
         <div key={item.title} className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[3.5rem] border border-slate-200 hover:border-green-400 transition-all group flex flex-col items-center text-center shadow-lg">
            <div className={`p-4 md:p-6 rounded-2xl md:rounded-[2rem] mb-4 md:mb-8 group-hover:scale-110 transition-transform duration-700 ${item.color}`}><ShieldCheck size={28} /></div>
            <h3 className="font-black text-slate-900 text-lg md:text-xl mb-2 tracking-tight">{item.title}</h3>
            <p className="text-xs md:text-sm text-slate-500 font-bold leading-relaxed">{item.desc}</p>
         </div>
       ))}
    </div>
    <div className="bg-slate-950 p-10 md:p-20 rounded-[2rem] md:rounded-[5rem] border-t-8 border-green-600 flex flex-col items-center text-center gap-6 md:gap-10 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <Zap size={48} className="text-green-500 animate-pulse md:size-16" />
      <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter">Strategic Monitor</h2>
      <p className="text-slate-400 font-bold max-w-2xl leading-relaxed text-sm md:text-xl">Presence Monitor synchronized with latest Director General circulars.</p>
    </div>
  </div>
);
