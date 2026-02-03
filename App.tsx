
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
  Video, 
  VideoOff,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Target,
  Monitor,
  Settings
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
const SidebarItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
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

const MetricCard: React.FC<{ label: string, score: number, feedback: string }> = ({ label, score, feedback }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-center mb-3">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-xl font-black ${score > 70 ? 'text-green-600' : score > 40 ? 'text-amber-500' : 'text-red-500'}`}>
        {score}%
      </span>
    </div>
    <div className="w-full bg-slate-100 h-2.5 rounded-full mb-4 overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-1000 ease-out ${score > 70 ? 'bg-green-500' : score > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
        style={{ width: `${score}%` }}
      />
    </div>
    <p className="text-xs text-slate-600 font-medium italic">"{feedback}"</p>
  </div>
);

// --- Practice Room Component ---
const PracticeRoom: React.FC<{ onAnalysisComplete: (analysis: SessionRecord) => void }> = ({ onAnalysisComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [scenario, setScenario] = useState<NYSCScenario>(NYSCScenario.CAMP_ADDRESS);
  const [leadershipStyle, setLeadershipStyle] = useState<LeadershipStyle>(LeadershipStyle.COMMANDING);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [coachingAlerts, setCoachingAlerts] = useState<CoachingAlert[]>([]);
  const [wpm, setWpm] = useState<number>(0);
  
  // Camera View States
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'wide' | 'focused' | 'closeup'>('wide');

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

  // Adjust zoom based on viewMode
  useEffect(() => {
    switch (viewMode) {
      case 'wide': setZoomLevel(1); break;
      case 'focused': setZoomLevel(1.5); break;
      case 'closeup': setZoomLevel(2.2); break;
    }
  }, [viewMode]);

  const addCoachingAlert = (type: CoachingAlert['type'], message: string) => {
    const newAlert: CoachingAlert = { id: Math.random().toString(36).substr(2, 9), type, message, timestamp: Date.now() };
    setCoachingAlerts(prev => [newAlert, ...prev].slice(0, 3));
  };

  const startRecording = async () => {
    setError(null);
    setLiveTranscript("");
    setCoachingAlerts([]);
    setWpm(0);
    currentTranscriptRef.current = "";
    
    try {
      // Direct access to both Camera and Mic
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } } 
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

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = audioCtx.createMediaStreamSource(stream);
            const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioCtx.destination);

            frameIntervalRef.current = window.setInterval(() => {
              if (videoRef.current && canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  canvasRef.current.width = videoRef.current.videoWidth || 640;
                  canvasRef.current.height = videoRef.current.videoHeight || 480;
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
            const modelText = message.serverContent?.modelTurn?.parts[0]?.text;
            if (modelText && modelText.includes("LEADERSHIP:")) {
              addCoachingAlert('leadership', modelText.replace("LEADERSHIP:", "").trim());
            }
          },
          onerror: (e: any) => {
            console.error("Live session synchronization failed:", e);
            setError("Session error: The model or service could not be initialized. Verify connectivity.");
            stopRecording();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: 'You are an NYSC Executive Speech Coach. Evaluate the Zonal Inspector based on authority, clarity, and administrative terminology.'
        }
      });

      liveSessionRef.current = sessionPromise;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/webm' }));
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

    } catch (err: any) {
      setIsRecording(false);
      setError("System Access Denied: Microphone and Camera are required for the Executive Arena. Please check browser settings.");
      console.error(err);
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
  };

  const analyzeSpeech = async () => {
    if (!audioBlob) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const base64data = await blobToBase64(audioBlob);
      const analysis = await analyzeNYSCSpeech(base64data, scenario, leadershipStyle);
      onAnalysisComplete({
        id: Date.now().toString(),
        date: new Date().toLocaleString(),
        scenario,
        leadershipStyle,
        analysis
      });
    } catch (err: any) {
      setError("Final Audit failed. System processing timeout.");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Executive Stage</h1>
          <p className="text-sm text-slate-500 font-medium italic">Administrative Oratory Protocol Active.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full border border-green-200">System Ready</div>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 p-5 rounded-2xl flex items-center gap-3 text-red-700 font-bold animate-pulse">
           <AlertCircle size={20} className="shrink-0" /> <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Unified Stage with View Controls */}
      <div className="relative bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-slate-900 aspect-[16/10] group">
        <div className="w-full h-full overflow-hidden flex items-center justify-center bg-black">
          <video 
            ref={videoRef} 
            muted 
            playsInline 
            style={{ transform: `scaleX(-1) scale(${zoomLevel})` }}
            className={`w-full h-full object-cover transition-all duration-700 origin-center ${isRecording ? 'opacity-100' : 'opacity-10'}`} 
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {/* Presentation View Overlays */}
        {!isRecording && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-4">
            <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center animate-pulse border-2 border-slate-800">
              <Monitor size={48} className="text-slate-600" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Awaiting Signal</p>
          </div>
        )}

        {isRecording && (
          <>
            {/* Top Bar HUD */}
            <div className="absolute top-0 inset-x-0 p-8 flex justify-between items-start bg-gradient-to-b from-black/90 to-transparent pointer-events-none z-30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-xl shadow-2xl shadow-red-900/50">
                  <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">TRANSMITTING</span>
                </div>
                <div className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20 text-white flex items-center gap-2">
                  <Activity size={14} className="text-green-400" />
                  <span className="text-xs font-black uppercase">{wpm} WPM</span>
                </div>
              </div>
            </div>

            {/* View Mode & Zoom Sidebar */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
              <div className="p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col gap-2">
                {[
                  { id: 'wide', icon: Monitor, label: 'WIDE' },
                  { id: 'focused', icon: Target, label: 'FOCUS' },
                  { id: 'closeup', icon: Maximize2, label: 'CLOSE' }
                ].map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as any)}
                    className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border ${
                      viewMode === mode.id 
                      ? 'bg-green-600 border-green-500 text-white shadow-xl scale-110' 
                      : 'bg-white/5 border-transparent text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <mode.icon size={18} />
                    <span className="text-[7px] font-black uppercase">{mode.label}</span>
                  </button>
                ))}
              </div>
              
              <div className="p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col gap-2">
                 <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.1, 3.5))} className="w-14 h-12 flex items-center justify-center hover:bg-white/10 rounded-xl text-white transition-all"><ZoomIn size={20} /></button>
                 <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.1, 1))} className="w-14 h-12 flex items-center justify-center hover:bg-white/10 rounded-xl text-white transition-all"><ZoomOut size={20} /></button>
              </div>
            </div>

            {/* Coaching Overlays */}
            <div className="absolute top-24 right-8 w-72 space-y-4 pointer-events-none z-30">
              {coachingAlerts.map(alert => (
                <div key={alert.id} className="bg-amber-600/90 backdrop-blur-xl text-white p-5 rounded-3xl shadow-2xl border border-amber-400/30 flex gap-4 items-start animate-in slide-in-from-right-8 duration-500">
                   <div className="p-2 bg-white/20 rounded-xl"><Zap size={18} /></div>
                   <p className="text-sm font-bold leading-relaxed drop-shadow-sm">{alert.message}</p>
                </div>
              ))}
            </div>

            {/* Lower-Third Transcription */}
            <div className="absolute bottom-0 inset-x-0 p-12 bg-gradient-to-t from-black via-black/60 to-transparent z-30">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-2 mb-3 text-white/50">
                  <Settings size={14} className="animate-spin-slow" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Real-time Policy Synchronization</span>
                </div>
                <div className="h-32 overflow-y-auto custom-scrollbar">
                  <p className="text-2xl md:text-3xl font-serif text-white leading-tight italic opacity-95 transition-all duration-300 drop-shadow-2xl font-medium">
                    {liveTranscript || "Establishing secure administrative channel..."}
                  </p>
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Primary Control Hub */}
      <div className="flex flex-col items-center gap-6 pb-12">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-2xl flex items-center gap-10 animate-in slide-in-from-bottom-8">
          <div className="flex flex-col gap-1.5 pr-10 border-r border-slate-100">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Context</label>
             <select 
               value={scenario} 
               disabled={isRecording}
               onChange={(e) => setScenario(e.target.value as NYSCScenario)}
               className="font-black text-sm text-slate-800 outline-none bg-transparent cursor-pointer hover:text-green-600 transition-colors"
             >
               {Object.values(NYSCScenario).map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>

          <div className="flex flex-col gap-1.5 pr-10 border-r border-slate-100">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Leadership Tone</label>
             <select 
               value={leadershipStyle} 
               disabled={isRecording}
               onChange={(e) => setLeadershipStyle(e.target.value as LeadershipStyle)}
               className="font-black text-sm text-slate-800 outline-none bg-transparent cursor-pointer hover:text-green-600 transition-colors"
             >
               {Object.values(LeadershipStyle).map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>

          {!isRecording && !audioBlob && (
             <button onClick={startRecording} className="px-12 py-5 bg-slate-900 text-white rounded-3xl font-black hover:bg-slate-800 shadow-2xl shadow-slate-900/30 transition-all flex items-center gap-4 active:scale-95 text-lg">
               <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-inner"><Play size={20} fill="currentColor" className="ml-1" /></div>
               Open Session
             </button>
          )}

          {isRecording && (
             <button onClick={stopRecording} className="px-12 py-5 bg-red-600 text-white rounded-3xl font-black hover:bg-red-700 shadow-2xl shadow-red-900/40 transition-all flex items-center gap-4 active:scale-95 text-lg animate-pulse">
               <Square size={20} fill="currentColor" /> Conclude Address
             </button>
          )}

          {audioBlob && !isRecording && (
            <div className="flex items-center gap-4">
              <button onClick={() => { setAudioBlob(null); setLiveTranscript(""); }} className="px-8 py-5 text-slate-500 font-black hover:text-slate-900 text-sm tracking-widest uppercase">
                Abort
              </button>
              <button onClick={analyzeSpeech} disabled={isAnalyzing} className="px-12 py-5 bg-green-600 text-white rounded-3xl font-black hover:bg-green-700 shadow-2xl shadow-green-900/30 transition-all active:scale-95">
                {isAnalyzing ? "Processing Signal..." : "Strategic Audit"}
              </button>
            </div>
          )}
        </div>
      </div>
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
    <div className="min-h-screen flex bg-slate-50 selection:bg-green-100">
      <aside className="w-72 bg-slate-900 p-8 flex flex-col fixed h-full z-50 border-r border-slate-800">
        <div className="flex items-center gap-4 mb-16">
          <div className="bg-green-600 p-3 rounded-2xl shadow-2xl shadow-green-900/40"><ShieldCheck className="text-white" size={32} /></div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">NYSC <span className="text-green-500">PRO</span></h1>
        </div>
        <nav className="space-y-3 flex-1">
          <SidebarItem icon={LayoutDashboard} label="Strategic Hub" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Mic} label="Executive Stage" active={activeTab === 'practice'} onClick={() => setActiveTab('practice')} />
          <SidebarItem icon={GraduationCap} label="Policy Archive" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} />
        </nav>
        <div className="mt-auto p-5 bg-slate-800/40 rounded-[2rem] border border-white/5">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-700 flex items-center justify-center font-black text-white text-sm shadow-inner">AD</div>
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">Administrative</p>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Zonal Inspectorate</p>
              </div>
           </div>
        </div>
      </aside>
      <main className="flex-1 md:ml-72 min-h-screen p-8 md:p-16 overflow-y-auto">
        {activeTab === 'dashboard' && <Dashboard records={sessions} />}
        {activeTab === 'practice' && <PracticeRoom onAnalysisComplete={handleAnalysisComplete} />}
        {activeTab === 'knowledge' && <KnowledgeHub />}
        {activeTab === 'analysis' && selectedAnalysis && (
          <AnalysisView 
            record={selectedAnalysis} 
            onBack={() => { setActiveTab('dashboard'); setSelectedAnalysis(null); }} 
          />
        )}
      </main>
    </div>
  );
}

// --- Dashboard Component ---
const Dashboard: React.FC<{ records: SessionRecord[] }> = ({ records }) => {
  const avgScore = records.length > 0 
    ? Math.round(records.reduce((acc, r) => acc + r.analysis.overallScore, 0) / records.length) 
    : 0;
  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      <div>
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Strategic Hub</h1>
        <p className="text-slate-500 mt-2 font-medium text-lg">Monitoring administrative presence and oratory mastery.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-xl relative overflow-hidden group">
          <Award size={80} className="absolute -top-4 -right-4 text-green-100 rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Command Quotient</p>
          <h3 className="text-8xl font-black text-slate-900 tracking-tighter">{avgScore}%</h3>
        </div>
        <div className="bg-slate-900 p-12 rounded-[4rem] shadow-2xl text-white group overflow-hidden relative">
          <History size={80} className="absolute -top-4 -right-4 text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Total Briefings</p>
          <h3 className="text-8xl font-black text-white tracking-tighter">{records.length}</h3>
        </div>
      </div>
      {records.length > 0 && (
        <section className="space-y-8 pt-10">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4"><Monitor size={28} className="text-green-600" /> Briefing Archive</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {records.slice(0, 4).map(r => (
              <div key={r.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex items-center justify-between group hover:border-green-300 hover:shadow-2xl transition-all cursor-pointer">
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-black text-xl shadow-inner ${r.analysis.overallScore > 75 ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {r.analysis.overallScore}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-lg truncate max-w-[200px]">{r.scenario}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{r.date}</p>
                  </div>
                </div>
                <ChevronRight size={24} className="text-slate-200 group-hover:text-green-600 group-hover:translate-x-2 transition-all" />
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
    <div className="space-y-12 animate-in zoom-in-95 duration-700 pb-20">
      <button onClick={onBack} className="flex items-center gap-3 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] hover:text-slate-900 transition-all bg-white px-8 py-4 rounded-full border border-slate-200 shadow-md">
        <ChevronRight size={18} className="rotate-180" /> Operational Return
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-2xl">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-16">Administrative Audit</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {analysis.metrics.map((m, i) => <MetricCard key={i} label={m.label} score={m.score} feedback={m.feedback} />)}
            </div>
          </section>
          <section className="bg-slate-900 p-16 rounded-[4.5rem] shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-10 tracking-tight">Signal Transcript</h2>
            <div className="p-12 bg-slate-800/80 rounded-[3rem] text-slate-200 leading-relaxed font-serif text-2xl italic border border-white/5">{analysis.transcript}</div>
          </section>
        </div>
        <div className="space-y-12">
          <div className="bg-gradient-to-br from-green-600 to-green-900 p-16 rounded-[4rem] text-white shadow-2xl flex flex-col items-center">
            <h3 className="text-9xl font-black mb-2 tracking-tighter">{analysis.overallScore}%</h3>
            <p className="text-[12px] font-black uppercase tracking-[0.4em] opacity-80">Final Signal Quality</p>
          </div>
          <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl">
             <h2 className="font-black text-slate-900 text-lg uppercase tracking-widest mb-10 flex items-center gap-4"><ShieldCheck size={28} className="text-green-600" /> Command Assets</h2>
             {analysis.strengths.map((s, i) => (
               <div key={i} className="text-sm font-bold text-slate-700 bg-slate-50 p-6 rounded-3xl mb-4 border border-slate-100 shadow-sm">{s}</div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const KnowledgeHub: React.FC = () => (
  <div className="space-y-12 animate-in slide-in-from-right-10 duration-1000">
    <div>
      <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Policy Archive</h1>
      <p className="text-slate-500 mt-2 font-medium text-lg italic">Strategic alignment with the NYSC Statutory Act.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
       {[
         { title: 'NYSC Act 1993', desc: 'The operational foundation of corps management.', color: 'bg-green-100 text-green-700' },
         { title: 'Bye-Laws 2024', desc: 'Administrative disciplinary and social guidelines.', color: 'bg-blue-100 text-blue-700' },
         { title: 'Crisis Response', desc: 'Procedures for camp and field emergencies.', color: 'bg-purple-100 text-purple-700' }
       ].map(item => (
         <div key={item.title} className="bg-white p-10 rounded-[3.5rem] border border-slate-200 hover:border-green-400 transition-all group flex flex-col items-center text-center shadow-lg">
            <div className={`p-6 rounded-[2rem] mb-8 group-hover:scale-110 transition-transform duration-700 ${item.color}`}><ShieldCheck size={36} /></div>
            <h3 className="font-black text-slate-900 text-xl mb-3 tracking-tight">{item.title}</h3>
            <p className="text-sm text-slate-500 font-bold leading-relaxed">{item.desc}</p>
         </div>
       ))}
    </div>
    <div className="bg-slate-950 p-20 rounded-[5rem] border-t-8 border-green-600 flex flex-col items-center text-center gap-10 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <Zap size={64} className="text-green-500 animate-pulse" />
      <h2 className="text-4xl font-black text-white tracking-tighter">Administrative Intelligence Stream</h2>
      <p className="text-slate-400 font-bold max-w-2xl leading-relaxed text-xl">The Presence Monitor is currently synchronized with the Director General's latest circulars (2025) to ensure your administrative tone is contemporary and strategic.</p>
    </div>
  </div>
);
