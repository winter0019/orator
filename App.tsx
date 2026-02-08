
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Mic, 
  History, 
  Award, 
  Square, 
  AlertCircle, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Activity, 
  Maximize2, 
  Minimize2, 
  Settings, 
  X, 
  RefreshCw, 
  ExternalLink, 
  Lightbulb,
  Video,
  Trash2,
  Smile,
  MoveHorizontal,
  Eye,
  User,
  ZoomIn,
  ZoomOut,
  ChevronRight
} from 'lucide-react';
import { NYSCScenario, LeadershipStyle, SessionRecord, SpeechAnalysis } from './types';
import { analyzeNYSCSpeech } from './services/geminiService';

// --- Utils ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const blobToBase64 = async (blob: Blob): Promise<string> => {
  if (!blob || blob.size === 0) {
    throw new Error("Captured signal is empty or invalid.");
  }
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return encode(bytes);
  } catch (e) {
    console.error("Blob to Base64 failure:", e);
    throw new Error("The object can not be found: Media buffer access failed.");
  }
};

// --- Sub-components ---

const NavItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void, isMobile?: boolean }> = ({ icon: Icon, label, active, onClick, isMobile }) => {
  if (isMobile) {
    return (
      <button 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all duration-300 py-1 ${active ? 'text-green-500 scale-105' : 'text-slate-500'}`}
      >
        <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-green-500/10' : ''}`}>
          <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        </div>
        <span className="text-[8px] font-black uppercase tracking-[0.15em]">{label}</span>
      </button>
    );
  }
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 group ${active ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
    >
      <Icon size={18} className={`${active ? 'scale-110' : 'group-hover:translate-x-1'} transition-transform`} />
      {label}
    </button>
  );
};

const MetricCard: React.FC<{ label: string, score: number, feedback: string }> = ({ label, score, feedback }) => (
  <div className="bg-white p-5 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${score > 75 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        {score}%
      </span>
    </div>
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-1000 ease-out rounded-full ${score > 75 ? 'bg-green-500' : 'bg-amber-500'}`} 
        style={{ width: `${score}%` }} 
      />
    </div>
    <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic line-clamp-2 md:line-clamp-none">
      {feedback}
    </p>
  </div>
);

const VisualInsight: React.FC<{ icon: any, label: string, feedback: string }> = ({ icon: Icon, label, feedback }) => (
  <div className="bg-slate-900/40 p-5 rounded-[1.5rem] border border-white/5 space-y-3 hover:bg-slate-900/60 transition-colors">
    <div className="flex items-center gap-3">
      <div className="bg-green-600/20 p-2 rounded-xl text-green-400"><Icon size={16} /></div>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    </div>
    <p className="text-xs font-bold text-slate-300 leading-relaxed">{feedback}</p>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'history' | 'policy'>('audit');
  const [scenario, setScenario] = useState<NYSCScenario>(NYSCScenario.CAMP_ADDRESS);
  const [leadershipStyle, setLeadershipStyle] = useState<LeadershipStyle>(LeadershipStyle.MOTIVATIONAL);
  
  // Arena Configuration State
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4K'>('1080p');
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(30);
  const [useVideo, setUseVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Zoom State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number, max: number, step: number } | null>(null);

  // Persistence state
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [analysis, setAnalysis] = useState<SpeechAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const frameIntervalRef = useRef<number | null>(null);
  const framesRef = useRef<string[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Load archives on mount
  useEffect(() => {
    const saved = localStorage.getItem('nysc_oratory_archives');
    if (saved) {
      try {
        setSessions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse archives");
      }
    }
  }, []);

  // Save archives when sessions update
  useEffect(() => {
    localStorage.setItem('nysc_oratory_archives', JSON.stringify(sessions));
  }, [sessions]);

  // Handle Fullscreen Event Changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle Video Preview when toggle changed
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startPreview = async () => {
      if (useVideo && !isRecording) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: resolution === '4K' ? 3840 : resolution === '1080p' ? 1920 : 1280,
              height: resolution === '4K' ? 2160 : resolution === '1080p' ? 1080 : 720,
              frameRate: frameRate
            }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }

          const track = stream.getVideoTracks()[0];
          videoTrackRef.current = track;
          
          try {
            const caps: any = track.getCapabilities();
            if (caps && caps.zoom) {
              setZoomCapabilities({
                min: caps.zoom.min,
                max: caps.zoom.max,
                step: caps.zoom.step
              });
              setZoomLevel((track.getSettings() as any).zoom || caps.zoom.min || 1);
            } else {
              setZoomCapabilities(null);
            }
          } catch (e) {
            setZoomCapabilities(null);
          }
        } catch (err) {
          console.error("Preview failed:", err);
        }
      }
    };

    startPreview();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [useVideo, resolution, frameRate, isRecording]);

  const handleZoomChange = (value: number) => {
    setZoomLevel(value);
    if (videoTrackRef.current) {
      try {
        videoTrackRef.current.applyConstraints({
          advanced: [{ zoom: value }]
        } as any);
      } catch (e) {
        console.error("Failed to apply zoom:", e);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        framesRef.current.push(frame);
        if (framesRef.current.length > 5) {
          const first = framesRef.current[0];
          const last = framesRef.current[framesRef.current.length - 1];
          const middle1 = framesRef.current[Math.floor(framesRef.current.length * 0.25)];
          const middle2 = framesRef.current[Math.floor(framesRef.current.length * 0.5)];
          const middle3 = framesRef.current[Math.floor(framesRef.current.length * 0.75)];
          framesRef.current = [first, middle1, middle2, middle3, last];
        }
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const constraints: MediaStreamConstraints = { 
          audio: true,
          video: useVideo ? {
            width: resolution === '4K' ? 3840 : resolution === '1080p' ? 1920 : 1280,
            height: resolution === '4K' ? 2160 : resolution === '1080p' ? 1080 : 720,
            frameRate: frameRate
          } : false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (useVideo && videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const track = stream.getVideoTracks()[0];
        videoTrackRef.current = track;

        if (useVideo && zoomCapabilities) {
          try {
            track.applyConstraints({ advanced: [{ zoom: zoomLevel }] } as any);
          } catch (e) { console.debug("Initial recording zoom apply failed"); }
        }

        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        framesRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (useVideo) captureFrame();
          stream.getTracks().forEach(track => track.stop());

          setIsAnalyzing(true);
          try {
            const base64 = await blobToBase64(blob);
            const result = await analyzeNYSCSpeech(base64, scenario, leadershipStyle, 'audio/webm', framesRef.current);
            setAnalysis(result);
            
            const newRecord: SessionRecord = {
              id: Date.now().toString(),
              date: new Date().toLocaleString(),
              scenario,
              leadershipStyle,
              analysis: result
            };
            setSessions(prev => [newRecord, ...prev]);
          } catch (err: any) {
            console.error("Analysis service failure:", err);
            setShowDiagnostics(true);
          } finally {
            setIsAnalyzing(false);
          }
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);

        if (useVideo) {
          frameIntervalRef.current = window.setInterval(captureFrame, 5000);
        }
      } catch (err) {
        setShowDiagnostics(true);
      }
    }
  };

  const loadArchive = (record: SessionRecord) => {
    setAnalysis(record.analysis);
    setScenario(record.scenario);
    if (record.leadershipStyle) setLeadershipStyle(record.leadershipStyle);
    setActiveTab('audit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-white font-sans selection:bg-green-500/30 overflow-x-hidden">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 lg:w-80 bg-slate-900 border-r border-white/5 p-6 lg:p-8 gap-10 lg:gap-12 sticky top-0 h-screen">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 p-2.5 rounded-2xl shadow-lg shadow-green-900/40 shrink-0">
            <Mic className="text-white" size={24} />
          </div>
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-base lg:text-lg font-black tracking-tighter uppercase leading-none text-white truncate">Command Voice</h1>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">NYSC Executive Coach</span>
          </div>
        </div>
        
        <nav className="flex flex-col gap-2">
          <NavItem icon={LayoutDashboard} label="Address Arena" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
          <NavItem icon={History} label="Archives" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <NavItem icon={ShieldCheck} label="Policy HQ" active={activeTab === 'policy'} onClick={() => setActiveTab('policy')} />
        </nav>

        <div className="mt-auto bg-slate-800/40 p-5 rounded-[2rem] border border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <Award className="text-green-500" size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Elite Status</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
            {sessions.length > 0 
              ? `You have archived ${sessions.length} official communications.`
              : 'Your next speech will be analyzed for structural integrity.'
            }
          </p>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-0">
        <header className="px-5 pt-[calc(1.5rem+var(--sat))] pb-6 md:px-10 md:py-10 flex justify-between items-center sticky top-0 bg-slate-950/90 backdrop-blur-xl z-[60] border-b border-white/5">
          <div className="space-y-1">
            <h2 className="text-xl md:text-3xl font-black tracking-tighter uppercase truncate">
              {activeTab === 'audit' ? 'Address Arena' : activeTab === 'history' ? 'Executive Archives' : 'Policy Center'}
            </h2>
            <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Terminal ID: NY-042
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {activeTab === 'history' && sessions.length > 0 && (
              <button onClick={() => setSessions([])} className="bg-red-500/10 text-red-500 px-3 md:px-4 py-2.5 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                <Trash2 size={14} /> <span className="hidden sm:inline">Wipe Data</span>
              </button>
            )}
            <button className="bg-white/5 p-2.5 md:p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
              <Settings size={20} className="text-slate-400" />
            </button>
          </div>
        </header>

        <div className="px-4 md:px-10 pt-6 pb-12 space-y-8 md:space-y-12">
          {activeTab === 'audit' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
              <div className="lg:col-span-8 space-y-6 md:space-y-8">
                {/* Configuration Panel */}
                <div className="bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 border border-white/5 shadow-xl space-y-6 md:space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-8">
                    <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mission Scenario</label>
                      <div className="relative">
                        <select 
                          value={scenario}
                          onChange={(e) => setScenario(e.target.value as NYSCScenario)}
                          className="w-full bg-slate-800/80 border border-white/5 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 text-xs md:text-sm font-bold text-white focus:ring-2 focus:ring-green-500 appearance-none outline-none pr-10"
                        >
                          {Object.values(NYSCScenario).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Leadership Tone</label>
                      <div className="relative">
                        <select 
                          value={leadershipStyle}
                          onChange={(e) => setLeadershipStyle(e.target.value as LeadershipStyle)}
                          className="w-full bg-slate-800/80 border border-white/5 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 text-xs md:text-sm font-bold text-white focus:ring-2 focus:ring-green-500 appearance-none outline-none pr-10"
                        >
                          {Object.values(LeadershipStyle).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 rotate-90 pointer-events-none" size={16} />
                      </div>
                    </div>
                  </div>

                  {/* Calibration Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 pt-5 border-t border-white/5">
                    <div className="space-y-2 col-span-1">
                      <label className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Video size={10} className="text-green-500" /> Resolution
                      </label>
                      <div className="flex bg-slate-800 p-1 rounded-xl">
                        {(['720p', '1080p'] as const).map(res => (
                          <button
                            key={res}
                            onClick={() => setResolution(res)}
                            className={`flex-1 py-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-tighter rounded-lg transition-all ${resolution === res ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}
                          >
                            {res}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2 col-span-1">
                      <label className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Activity size={10} className="text-green-500" /> FPS
                      </label>
                      <div className="flex bg-slate-800 p-1 rounded-xl">
                        {([30, 60] as const).map(fps => (
                          <button
                            key={fps}
                            onClick={() => setFrameRate(fps)}
                            className={`flex-1 py-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-tighter rounded-lg transition-all ${frameRate === fps ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}
                          >
                            {fps}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <label className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Zap size={10} className="text-green-500" /> Capture
                      </label>
                      <button
                        onClick={() => setUseVideo(!useVideo)}
                        className={`w-full py-2 px-3 rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest border transition-all ${useVideo ? 'bg-green-600/10 border-green-500 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-slate-800 border-white/5 text-slate-400'}`}
                      >
                        {useVideo ? 'Multi-Modal' : 'Audio-Only'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {useVideo && (
                      <div ref={videoContainerRef} className="relative w-full aspect-video bg-black rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-white/10 group shadow-2xl">
                         <video 
                           ref={videoRef} 
                           autoPlay 
                           muted 
                           playsInline 
                           className={`w-full h-full object-cover transition-all duration-700 ${isRecording ? 'grayscale-0' : 'grayscale-50 brightness-75'}`} 
                         />
                         
                         {/* Video Overlay Top */}
                         <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
                           <div className="flex flex-wrap gap-1.5">
                             <div className="bg-red-600 px-2.5 py-1 rounded-full text-[7px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-auto shadow-lg">
                               <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-white ${isRecording ? 'animate-pulse' : ''}`} />
                               {isRecording ? 'Capturing' : 'Preview'}
                             </div>
                             <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[7px] md:text-[9px] font-black uppercase tracking-widest border border-white/10 pointer-events-auto">
                               {resolution} • {frameRate}
                             </div>
                           </div>
                           <button 
                             onClick={toggleFullscreen}
                             className="bg-black/40 backdrop-blur-md p-1.5 md:p-2 rounded-xl border border-white/10 text-white hover:bg-green-600 transition-all pointer-events-auto shadow-lg"
                           >
                             {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                           </button>
                         </div>

                         {/* Responsive Zoom Slider Overlay */}
                         {zoomCapabilities && (
                           <div className="absolute bottom-4 left-4 right-4 md:right-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:right-4 flex flex-row md:flex-col items-center gap-3 bg-black/60 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-auto">
                             <ZoomOut size={14} className="text-white shrink-0" />
                             <input 
                               type="range"
                               min={zoomCapabilities.min}
                               max={zoomCapabilities.max}
                               step={zoomCapabilities.step}
                               value={zoomLevel}
                               onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                               className="w-full md:h-24 md:w-3 accent-green-500 cursor-pointer"
                               style={{ writingMode: 'bt-lr' } as any}
                             />
                             <ZoomIn size={14} className="text-white shrink-0" />
                           </div>
                         )}

                         {isFullscreen && (
                           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-black/80 backdrop-blur-2xl px-6 py-4 rounded-[2.5rem] border border-white/10 shadow-3xl animate-in slide-in-from-bottom-10 duration-500 pointer-events-auto">
                              <button 
                                onClick={toggleRecording}
                                disabled={isAnalyzing}
                                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 scale-105 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-green-600 hover:scale-105'}`}
                              >
                                {isRecording ? <Square fill="white" size={18} /> : <Mic size={20} className="text-white" />}
                              </button>
                              <div className="space-y-0.5 min-w-[100px]">
                                <p className="text-[9px] md:text-xs font-black uppercase tracking-[0.1em] text-white">
                                  {isRecording ? 'Live Audit' : 'Standby'}
                                </p>
                                <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                                  {scenario}
                                </p>
                              </div>
                           </div>
                         )}
                      </div>
                    )}

                    {!isFullscreen && (
                      <div className="flex flex-col items-center justify-center py-10 md:py-20 border-2 border-dashed border-white/10 rounded-[2rem] md:rounded-[2.5rem] gap-6 md:gap-8 relative overflow-hidden group hover:border-green-500/40 transition-all bg-slate-800/20">
                        <button 
                          onClick={toggleRecording}
                          disabled={isAnalyzing}
                          className={`relative z-10 w-20 h-20 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-700 ${isRecording ? 'bg-red-500 shadow-[0_0_60px_rgba(239,68,68,0.5)] scale-110 rotate-180' : 'bg-green-600 shadow-[0_0_60px_rgba(34,197,94,0.4)] hover:scale-110 hover:shadow-green-500/60'}`}
                        >
                          {isRecording ? <Square fill="white" size={28} /> : <Mic size={32} md:size={40} className="text-white" />}
                        </button>

                        <div className="text-center space-y-2 md:space-y-3 relative z-10 px-4">
                          <p className="text-base md:text-2xl font-black tracking-tight uppercase">
                            {isRecording ? 'Monitoring Signal...' : isAnalyzing ? 'Processing Audit...' : 'Initialize Session'}
                          </p>
                          <p className="text-[9px] md:text-xs font-bold text-slate-500 uppercase tracking-[0.2em] leading-relaxed max-w-[240px] md:max-w-none mx-auto">
                            {isRecording ? `Secure Encryption • ${resolution}` : 'Select scenario and click node to begin'}
                          </p>
                        </div>

                        {isAnalyzing && (
                          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-20 animate-in fade-in duration-500">
                            <div className="flex gap-1 mb-6">
                              {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-8 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-green-500 animate-pulse">Analyzing Executive Intel</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Scorecard Display */}
                {analysis && (
                  <div className="space-y-6 md:space-y-12 animate-in slide-in-from-bottom-12 duration-1000">
                    <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 space-y-8 md:space-y-14 shadow-2xl overflow-hidden relative">
                      <div className="absolute top-0 left-0 w-full h-1.5 md:h-2 bg-gradient-to-r from-green-500 via-green-400 to-green-600" />
                      
                      <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-8">
                        <div className="space-y-3 text-slate-950 w-full md:w-auto">
                          <h3 className="text-2xl md:text-5xl font-black tracking-tighter uppercase leading-tight md:leading-none">Performance<br/>Audit</h3>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2.5 py-1.5 rounded-lg uppercase tracking-widest border border-slate-200">ID: {sessions[0]?.id.slice(-6)}</span>
                            <span className="text-[9px] font-black bg-green-100 text-green-700 px-2.5 py-1.5 rounded-lg uppercase tracking-widest border border-green-200">Engine V3</span>
                          </div>
                        </div>
                        <div className="text-left md:text-right w-full md:w-auto">
                          <div className="text-6xl md:text-9xl font-black tracking-tighter leading-none text-slate-900 flex items-baseline md:justify-end">
                            {analysis.overallScore}<span className="text-2xl md:text-4xl text-slate-300 ml-1">%</span>
                          </div>
                          <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 md:mt-4">Command Proficiency Index</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                        {analysis.metrics?.map((m: any, idx: number) => (
                          <MetricCard key={idx} {...m} />
                        ))}
                      </div>

                      {analysis.visualFeedback && (
                        <div className="bg-slate-950 rounded-[2rem] p-5 md:p-10 space-y-6 md:space-y-8">
                           <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-white/5" />
                            <span className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Visual Intelligence</span>
                            <div className="h-px flex-1 bg-white/5" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5">
                            <VisualInsight icon={Smile} label="Emotions" feedback={analysis.visualFeedback.emotionalState} />
                            <VisualInsight icon={User} label="Posture" feedback={analysis.visualFeedback.posture} />
                            <VisualInsight icon={MoveHorizontal} label="Gestures" feedback={analysis.visualFeedback.gestures} />
                            <VisualInsight icon={Eye} label="Gaze" feedback={analysis.visualFeedback.eyeContact} />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
                        <div className="space-y-5">
                          <h4 className="flex items-center gap-2.5 text-[10px] md:text-sm font-black text-green-600 uppercase tracking-widest"><TrendingUp size={18} /> Core Strengths</h4>
                          <ul className="space-y-3">
                            {analysis.strengths?.map((s: string, i: number) => (
                              <li key={i} className="flex gap-3 text-xs md:text-base font-bold text-slate-600 bg-green-50/50 p-4 rounded-xl border border-green-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-5">
                          <h4 className="flex items-center gap-2.5 text-[10px] md:text-sm font-black text-amber-600 uppercase tracking-widest"><AlertCircle size={18} /> Growth Areas</h4>
                          <ul className="space-y-3">
                            {analysis.improvements?.map((im: string, i: number) => (
                              <li key={i} className="flex gap-3 text-xs md:text-base font-bold text-slate-600 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                                {im}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-slate-950 rounded-[2rem] p-5 md:p-10 space-y-4 md:space-y-6">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Transcript</h4>
                          <button className="text-[9px] font-black text-green-500 uppercase tracking-widest hover:text-green-400 transition-colors">Export</button>
                        </div>
                        <p className="text-xs md:text-lg font-bold text-slate-200 leading-relaxed italic opacity-90">"{analysis.transcript}"</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Responsive Side Panels */}
              <div className="lg:col-span-4 space-y-6 md:space-y-8">
                <div className="bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 border border-white/5 shadow-xl space-y-6 md:space-y-8 lg:sticky lg:top-28">
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Directives</h3>
                    <p className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest">Target Talking Points</p>
                  </div>
                  
                  <div className="space-y-3 md:space-y-4">
                    {analysis?.suggestedPoints?.map((p: string, i: number) => (
                      <div key={i} className="p-4 md:p-5 bg-slate-800/50 rounded-[1.25rem] border border-white/5 flex gap-3 hover:bg-slate-800 transition-colors group">
                        <div className="bg-green-600/20 text-green-500 w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl flex items-center justify-center text-[10px] md:text-xs font-black shrink-0 group-hover:bg-green-600 group-hover:text-white transition-all">{i+1}</div>
                        <p className="text-[11px] md:text-sm font-bold text-slate-300 leading-relaxed">{p}</p>
                      </div>
                    )) || (
                      <div className="flex flex-col items-center justify-center py-12 md:py-16 text-slate-700 text-center space-y-4">
                        <div className="bg-slate-800/40 p-5 rounded-full"><Lightbulb size={28} className="text-slate-600" /></div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em]">Awaiting Input</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 shadow-xl shadow-green-900/30 space-y-4 md:space-y-6 mt-6 md:mt-10">
                    <div className="bg-white/20 w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-white"><Zap size={20} md:size={24} /></div>
                    <div className="space-y-1 md:space-y-2">
                      <h3 className="font-black text-base md:text-xl tracking-tighter uppercase">Rapid Drills</h3>
                      <p className="text-[10px] md:text-xs font-bold text-white/70 leading-relaxed">Engage in high-intensity verbal drills to refine presence.</p>
                    </div>
                    <button className="w-full py-3 md:py-4 bg-white text-green-800 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Start Drill</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
             <div className="space-y-8 animate-in fade-in duration-700">
               {sessions.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-32 md:py-40 space-y-6 text-slate-700">
                   <div className="bg-slate-900 p-8 md:p-10 rounded-full border border-white/5"><History size={48} md:size={64} /></div>
                   <div className="text-center space-y-2">
                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">Archives Clean</h3>
                    <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em]">No official sessions logged yet.</p>
                   </div>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-8">
                   {sessions.map((record) => (
                     <div 
                      key={record.id} 
                      onClick={() => loadArchive(record)}
                      className="bg-slate-900/40 p-6 md:p-8 rounded-[2rem] border border-white/5 space-y-6 md:space-y-8 hover:bg-slate-900 hover:border-green-500/30 transition-all group cursor-pointer shadow-lg"
                    >
                       <div className="flex justify-between items-start">
                         <div className="space-y-1.5 flex-1 pr-3">
                           <h3 className="font-black text-white uppercase tracking-tight line-clamp-2 text-sm md:text-base">{record.scenario}</h3>
                           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{record.date}</p>
                         </div>
                         <div className="text-3xl md:text-4xl font-black text-green-500 tracking-tighter group-hover:scale-110 transition-transform">
                          {record.analysis.overallScore}<span className="text-xs md:text-sm text-slate-600">%</span>
                         </div>
                       </div>
                       <div className="flex gap-2.5">
                         <button className="flex-1 py-3 bg-white/5 rounded-xl text-[9px] font-black text-white uppercase tracking-widest border border-white/5 group-hover:bg-green-600 transition-colors">Re-Analyze</button>
                         <button 
                          onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(s => s.id !== record.id)); }} 
                          className="p-3 bg-red-500/10 rounded-xl text-red-500 border border-red-500/10 hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          )}

          {activeTab === 'policy' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-8 animate-in slide-in-from-bottom-10 duration-700">
               {[
                { title: 'NYSC Act 2004', desc: 'Primary Legal Framework' },
                { title: 'SAED Guidelines', desc: 'Skill Acquisition Directives' },
                { title: 'PPA Deployment', desc: 'Protocol for Assignments' },
                { title: 'Disciplinary Code', desc: 'Bye-Laws & Enforcement' },
                { title: 'Service Benefits', desc: 'Allowance & Insurance' },
                { title: 'Executive Ethics', desc: 'Code of Conduct' }
               ].map((p) => (
                 <div key={p.title} className="bg-slate-900/60 p-6 md:p-8 rounded-[1.75rem] md:rounded-[2.5rem] border border-white/5 space-y-5 md:space-y-6 hover:border-green-500/50 hover:bg-slate-900 transition-all group cursor-pointer shadow-xl">
                   <div className="flex justify-between items-start">
                     <div className="bg-slate-800 p-3.5 rounded-xl text-slate-400 group-hover:text-green-500 group-hover:bg-green-500/10 transition-all"><ShieldCheck size={24} strokeWidth={1.5} /></div>
                     <ExternalLink size={18} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
                   </div>
                   <div className="space-y-1.5">
                     <h3 className="text-base md:text-lg font-black uppercase tracking-tighter text-white group-hover:text-green-400 transition-colors">{p.title}</h3>
                     <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em]">{p.desc}</p>
                   </div>
                   <div className="pt-3.5 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase text-slate-600 group-hover:text-slate-400">Restricted Access</span>
                    <ChevronRight size={12} className="text-slate-700 group-hover:text-green-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </main>

      {/* Optimized Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4.5rem+var(--sab))] bg-slate-900/90 backdrop-blur-2xl border-t border-white/10 flex items-start pt-3 px-2 z-[100] safe-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
        <NavItem icon={LayoutDashboard} label="Arena" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} isMobile />
        <NavItem icon={History} label="Archives" active={activeTab === 'history'} onClick={() => setActiveTab('history')} isMobile />
        <NavItem icon={ShieldCheck} label="Policy" active={activeTab === 'policy'} onClick={() => setActiveTab('policy')} isMobile />
      </nav>

      {/* Hardware Diagnostics Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2rem] md:rounded-[2.5rem] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 md:p-10 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div className="space-y-2">
                <div className="bg-amber-100 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-amber-600 mb-2 md:mb-4 shadow-sm"><ShieldCheck size={24} md:size={28} /></div>
                <h2 className="text-xl md:text-2xl font-black text-slate-950 uppercase tracking-tighter">Hardware Error</h2>
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Diagnostic Required</p>
              </div>
              <button onClick={() => setShowDiagnostics(false)} className="text-slate-300 hover:text-slate-950 transition-colors p-2"><X size={24} md:size={28} /></button>
            </div>
            <div className="p-6 md:p-10 space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                {[
                  { step: '01', text: 'Allow Microphone and Camera access in browser settings.' },
                  { step: '02', text: 'Close other apps (Zoom, Teams) using the hardware.' }
                ].map(item => (
                  <div key={item.step} className="flex gap-4">
                    <div className="bg-slate-100 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-black text-slate-500 text-[10px] md:text-xs shrink-0 border border-slate-200">{item.step}</div>
                    <p className="text-xs md:text-sm font-bold text-slate-600 leading-relaxed pt-1.5 md:pt-2">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button onClick={() => setShowDiagnostics(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs hover:bg-slate-200 transition-all uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => { setShowDiagnostics(false); toggleRecording(); }} 
                  className="flex-[2] py-3.5 bg-slate-950 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs hover:bg-slate-900 shadow-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 md:gap-3 active:scale-95"
                >
                  <RefreshCw size={14} md:size={16} /> Re-Initialize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
