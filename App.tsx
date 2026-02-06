
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
  ZoomOut
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

const VisualInsight: React.FC<{ icon: any, label: string, feedback: string }> = ({ icon: Icon, label, feedback }) => (
  <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 space-y-3">
    <div className="flex items-center gap-3">
      <div className="bg-green-600/20 p-2 rounded-xl text-green-400"><Icon size={16} /></div>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    </div>
    <p className="text-xs font-bold text-slate-300 leading-relaxed">{feedback}</p>
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
          
          // Check for zoom capabilities
          try {
            const caps: any = track.getCapabilities();
            if (caps && caps.zoom) {
              setZoomCapabilities({
                min: caps.zoom.min,
                max: caps.zoom.max,
                step: caps.zoom.step
              });
              // Fix: cast track.getSettings() to any to access the non-standard 'zoom' property
              setZoomLevel((track.getSettings() as any).zoom || caps.zoom.min || 1);
            } else {
              setZoomCapabilities(null);
            }
          } catch (e) {
            console.debug("Zoom capabilities check failed or not supported by hardware/browser", e);
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
        // Keep only up to 5 representative frames
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

        // Carry over current zoom if recording starts and zoom is supported
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

  const deleteSession = (id: string) => {
    if (window.confirm("Delete this executive record from the archive?")) {
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const resetArchives = () => {
    if (window.confirm("Wipe all performance archives? This action is permanent.")) {
      setSessions([]);
      setAnalysis(null);
    }
  };

  const loadArchive = (record: SessionRecord) => {
    setAnalysis(record.analysis);
    setScenario(record.scenario);
    if (record.leadershipStyle) setLeadershipStyle(record.leadershipStyle);
    setActiveTab('audit');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-white font-sans selection:bg-green-500/30">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex flex-col w-80 bg-slate-900 border-r border-white/5 p-8 gap-12">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 p-2.5 rounded-2xl shadow-lg shadow-green-900/40">
            <Mic className="text-white" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black tracking-tighter uppercase leading-none text-white">Command Voice</h1>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">NYSC Executive Coach</span>
          </div>
        </div>
        
        <nav className="flex flex-col gap-2">
          <NavItem icon={LayoutDashboard} label="Address Arena" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
          <NavItem icon={History} label="Archives" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <NavItem icon={ShieldCheck} label="Policy HQ" active={activeTab === 'policy'} onClick={() => setActiveTab('policy')} />
        </nav>

        <div className="mt-auto bg-slate-800/50 p-6 rounded-[2rem] border border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <Award className="text-green-500" size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">
              {sessions.length > 0 ? 'Executive Record' : 'Elite Status'}
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
            {sessions.length > 0 
              ? `Management has archived ${sessions.length} of your recent addresses.`
              : 'Your next speech will be analyzed for administrative leadership.'
            }
          </p>
        </div>
      </aside>

      {/* Main Terminal View */}
      <main className="flex-1 flex flex-col overflow-y-auto pb-24 md:pb-0">
        <header className="p-6 md:p-10 flex justify-between items-center sticky top-0 bg-slate-950/80 backdrop-blur-md z-50">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
              {activeTab === 'audit' ? 'Address Arena' : activeTab === 'history' ? 'Executive Archives' : 'Policy Center'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Terminal 042-NYSC
            </div>
          </div>
          <div className="flex gap-2">
            {activeTab === 'history' && sessions.length > 0 && (
              <button onClick={resetArchives} className="bg-red-500/10 text-red-500 p-3 rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <Trash2 size={16} /> Wipe Archives
              </button>
            )}
            <button className="bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
              <Settings size={20} className="text-slate-400" />
            </button>
          </div>
        </header>

        <section className="px-6 md:px-10 pb-10 space-y-10">
          {activeTab === 'audit' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 space-y-8">
                {/* Deployment Config */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-white/5 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mission Scenario</label>
                      <select 
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value as NYSCScenario)}
                        className="w-full bg-slate-800 border-none rounded-2xl py-4 px-6 text-sm font-bold text-white focus:ring-2 focus:ring-green-500 appearance-none outline-none"
                      >
                        {Object.values(NYSCScenario).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Leadership Tone</label>
                      <select 
                        value={leadershipStyle}
                        onChange={(e) => setLeadershipStyle(e.target.value as LeadershipStyle)}
                        className="w-full bg-slate-800 border-none rounded-2xl py-4 px-6 text-sm font-bold text-white focus:ring-2 focus:ring-green-500 appearance-none outline-none"
                      >
                        {Object.values(LeadershipStyle).map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Hardware Calibration */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Video size={12} className="text-green-500" /> Resolution
                      </label>
                      <div className="flex bg-slate-800 p-1 rounded-xl">
                        {(['720p', '1080p', '4K'] as const).map(res => (
                          <button
                            key={res}
                            onClick={() => setResolution(res)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all ${resolution === res ? 'bg-green-600 text-white' : 'text-slate-400'}`}
                          >
                            {res}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Activity size={12} className="text-green-500" /> Frame Rate
                      </label>
                      <div className="flex bg-slate-800 p-1 rounded-xl">
                        {([24, 30, 60] as const).map(fps => (
                          <button
                            key={fps}
                            onClick={() => setFrameRate(fps)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all ${frameRate === fps ? 'bg-green-600 text-white' : 'text-slate-400'}`}
                          >
                            {fps}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Zap size={12} className="text-green-500" /> Mode
                      </label>
                      <button
                        onClick={() => setUseVideo(!useVideo)}
                        className={`w-full py-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${useVideo ? 'bg-green-600/10 border-green-500 text-green-500' : 'bg-slate-800 border-white/5 text-slate-400'}`}
                      >
                        {useVideo ? 'Visual Audit' : 'Audio Only'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {useVideo && (
                      <div ref={videoContainerRef} className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 group">
                         <video 
                           ref={videoRef} 
                           autoPlay 
                           muted 
                           playsInline 
                           className={`w-full h-full object-cover transition-all duration-500 ${isRecording ? 'grayscale-0 opacity-100' : 'grayscale opacity-60'}`} 
                         />
                         
                         {/* Fullscreen Overlay Controls */}
                         <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                           <div className="flex gap-2">
                             <div className="bg-red-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-2 pointer-events-auto">
                               <div className={`w-1.5 h-1.5 rounded-full bg-white ${isRecording ? 'animate-pulse' : ''}`} />
                               {isRecording ? 'Live Signal' : 'Preview'}
                             </div>
                             <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 pointer-events-auto">
                               {resolution} {frameRate}FPS
                             </div>
                           </div>
                           
                           <button 
                             onClick={toggleFullscreen}
                             className="bg-black/40 backdrop-blur-md p-2.5 rounded-xl border border-white/10 text-white hover:bg-white/20 transition-all pointer-events-auto"
                           >
                             {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                           </button>
                         </div>

                         {/* Zoom Slider Overlay */}
                         {zoomCapabilities && (
                           <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 group-hover:opacity-100 opacity-0 transition-opacity duration-300">
                             <ZoomIn size={14} className="text-white" />
                             <div className="h-40 w-8 flex items-center justify-center relative">
                               <input 
                                 type="range"
                                 min={zoomCapabilities.min}
                                 max={zoomCapabilities.max}
                                 step={zoomCapabilities.step}
                                 value={zoomLevel}
                                 onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                                 style={{
                                   appearance: 'none',
                                   width: '160px',
                                   height: '4px',
                                   transform: 'rotate(-90deg)',
                                   background: 'rgba(255,255,255,0.2)',
                                   borderRadius: '2px',
                                   cursor: 'pointer'
                                 }}
                                 className="absolute"
                               />
                             </div>
                             <ZoomOut size={14} className="text-white" />
                             <span className="text-[8px] font-black text-white">{zoomLevel.toFixed(1)}x</span>
                           </div>
                         )}

                         {isFullscreen && (
                           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/60 backdrop-blur-xl px-10 py-6 rounded-[3rem] border border-white/10 animate-in slide-in-from-bottom-10">
                              <button 
                                onClick={toggleRecording}
                                disabled={isAnalyzing}
                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500' : 'bg-green-600'}`}
                              >
                                {isRecording ? <Square fill="white" size={24} /> : <Mic size={24} className="text-white" />}
                              </button>
                              <div className="space-y-0.5">
                                <p className="text-xs font-black uppercase tracking-widest text-white">
                                  {isRecording ? 'Capturing...' : 'Initialize'}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {scenario}
                                </p>
                              </div>
                           </div>
                         )}
                      </div>
                    )}

                    {!isFullscreen && (
                      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-[2rem] gap-6 relative overflow-hidden group hover:border-green-500/30 transition-all">
                        <button 
                          onClick={toggleRecording}
                          disabled={isAnalyzing}
                          className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)] scale-110' : 'bg-green-600 shadow-[0_0_50px_rgba(22,163,74,0.4)] hover:scale-105'}`}
                        >
                          {isRecording ? <Square fill="white" size={32} /> : <Mic size={32} className="text-white" />}
                        </button>

                        <div className="text-center space-y-2 relative z-10">
                          <p className="text-lg font-black tracking-tight uppercase">
                            {isRecording ? 'Capturing Command Signal...' : isAnalyzing ? 'Processing Executive Intel...' : 'Initialize Arena Feed'}
                          </p>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {isRecording ? `${resolution} @ ${frameRate}FPS` : 'Click to begin institutional address'}
                          </p>
                        </div>

                        {isAnalyzing && (
                          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-20">
                            <div className="flex gap-1">
                              {[1,2,3].map(i => <div key={i} className="w-1.5 h-8 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Analysis Results */}
                {analysis && (
                  <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
                    <div className="bg-white rounded-[2.5rem] p-10 space-y-10 shadow-2xl">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 text-slate-950">
                          <h3 className="text-3xl font-black tracking-tighter uppercase">Executive Scorecard</h3>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg uppercase tracking-widest">Audit ID: #{sessions[0]?.id.slice(-6)}</span>
                            <span className="text-[10px] font-black bg-green-100 text-green-700 px-3 py-1.5 rounded-lg uppercase tracking-widest">Gemini-3 Multimodal</span>
                          </div>
                        </div>
                        <div className="text-right text-slate-950">
                          <div className="text-6xl font-black tracking-tighter leading-none">{analysis.overallScore}%</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Proficiency Level</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {analysis.metrics?.map((m: any, idx: number) => (
                          <MetricCard key={idx} {...m} />
                        ))}
                      </div>

                      {analysis.visualFeedback && (
                        <div className="bg-slate-950 rounded-[2rem] p-8 space-y-6">
                           <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-white/10" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visual Intelligence</span>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <VisualInsight icon={Smile} label="Emotional State" feedback={analysis.visualFeedback.emotionalState} />
                            <VisualInsight icon={User} label="Posture" feedback={analysis.visualFeedback.posture} />
                            <VisualInsight icon={MoveHorizontal} label="Gestures" feedback={analysis.visualFeedback.gestures} />
                            <VisualInsight icon={Eye} label="Eye Contact" feedback={analysis.visualFeedback.eyeContact} />
                          </div>
                        </div>
                      )}

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-xs font-black text-green-600 uppercase tracking-widest"><TrendingUp size={16} /> Key Strengths</h4>
                            <ul className="space-y-3">
                              {analysis.strengths?.map((s: string, i: number) => (
                                <li key={i} className="flex gap-3 text-sm font-bold text-slate-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest"><AlertCircle size={16} /> Improvements</h4>
                            <ul className="space-y-3">
                              {analysis.improvements?.map((im: string, i: number) => (
                                <li key={i} className="flex gap-3 text-sm font-bold text-slate-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                                  {im}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950 rounded-[2rem] p-8 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Official Transcript</h4>
                          <button className="text-[10px] font-black text-green-500 uppercase tracking-widest">Copy Feed</button>
                        </div>
                        <p className="text-sm font-bold text-slate-200 leading-relaxed italic">"{analysis.transcript}"</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-4 space-y-8">
                <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-white/5 space-y-8">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Suggested Directives</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actionable talking points</p>
                  </div>
                  
                  <div className="space-y-4">
                    {analysis?.suggestedPoints?.map((p: string, i: number) => (
                      <div key={i} className="p-5 bg-slate-800 rounded-2xl border border-white/5 flex gap-4">
                        <div className="bg-green-600/20 text-green-500 w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</div>
                        <p className="text-xs font-bold text-slate-300 leading-relaxed">{p}</p>
                      </div>
                    )) || (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-center space-y-4">
                        <Lightbulb size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Analysis Pending</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-[2.5rem] p-8 shadow-xl shadow-green-900/20 space-y-6">
                  <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center text-white"><Zap size={24} /></div>
                  <div className="space-y-2">
                    <h3 className="font-black text-lg tracking-tight uppercase">Executive Growth</h3>
                    <p className="text-xs font-bold text-white/70 leading-relaxed">Advance your administrative leadership with high-intensity simulations.</p>
                  </div>
                  <button className="w-full py-4 bg-white text-green-700 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-50 transition-all">Start Training</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
             <div className="space-y-8">
               {sessions.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-40 space-y-6 text-slate-600">
                   <div className="bg-slate-900 p-8 rounded-full"><History size={48} /></div>
                   <h3 className="text-xl font-black uppercase tracking-tighter text-white">Archives Empty</h3>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {sessions.map((record) => (
                     <div key={record.id} className="bg-slate-900/50 p-8 rounded-[2rem] border border-white/5 space-y-6 hover:bg-slate-900 transition-all group">
                       <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           <h3 className="font-black text-white uppercase tracking-tight truncate max-w-[150px]">{record.scenario}</h3>
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{record.date}</p>
                         </div>
                         <div className="text-3xl font-black text-green-500 tracking-tighter">{record.analysis.overallScore}%</div>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => loadArchive(record)} className="flex-1 py-3 bg-white/5 rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/5">Load Audit</button>
                         <button onClick={() => deleteSession(record.id)} className="p-3 bg-red-500/10 rounded-xl text-red-500 border border-red-500/20"><Trash2 size={16} /></button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          )}

          {activeTab === 'policy' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {['NYSC Act 2004', 'SAED Framework', 'PPA Deployment Code', 'Disciplinary Procedures', 'Service Bylaws', 'Financial Directives'].map((p) => (
                 <div key={p} className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 space-y-6 hover:border-green-500/30 transition-all group">
                   <div className="flex justify-between items-start">
                     <div className="bg-slate-800 p-4 rounded-2xl text-slate-400 group-hover:text-green-500 transition-colors"><ShieldCheck size={24} /></div>
                     <ExternalLink size={20} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
                   </div>
                   <div className="space-y-2">
                     <h3 className="font-black uppercase tracking-tighter text-white">{p}</h3>
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Official Policy Document</p>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </section>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-slate-900 border-t border-white/5 flex items-center px-4 z-[100] backdrop-blur-xl">
        <NavItem icon={LayoutDashboard} label="Arena" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} isMobile />
        <NavItem icon={History} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} isMobile />
        <NavItem icon={ShieldCheck} label="Policy" active={activeTab === 'policy'} onClick={() => setActiveTab('policy')} isMobile />
      </nav>

      {showDiagnostics && <PermissionDiagnostics onRetry={() => setShowDiagnostics(false)} onClose={() => setShowDiagnostics(false)} />}
    </div>
  );
};

export default App;
