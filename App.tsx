
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plate, AppMode } from './types';
import { detectPlatesFromImage } from './services/geminiService';
import { 
  PlusIcon, 
  CameraIcon, 
  TrashIcon, 
  ListBulletIcon, 
  XMarkIcon,
  ExclamationTriangleIcon,
  VideoCameraIcon,
  HashtagIcon
} from '@heroicons/react/24/outline';

const normalizePlate = (val: string) => val.toUpperCase().replace(/[^A-Z0-9]/g, '');
const ALERT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const App: React.FC = () => {
  const [plates, setPlates] = useState<Plate[]>([]);
  const [mode, setMode] = useState<AppMode>(AppMode.LIST);
  const [newPlate, setNewPlate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedRecently, setDetectedRecently] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState<{number: string, time: string, match: boolean}[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('flash_plates');
    if (saved) {
      setPlates(JSON.parse(saved));
    }
    audioRef.current = new Audio(ALERT_SOUND_URL);
  }, []);

  useEffect(() => {
    localStorage.setItem('flash_plates', JSON.stringify(plates));
  }, [plates]);

  const addPlate = () => {
    const normalized = normalizePlate(newPlate);
    if (normalized.length < 4) {
      alert("Plaque trop courte");
      return;
    }
    if (plates.some(p => p.number === normalized)) {
      alert("Déjà surveillé");
      return;
    }
    const plate: Plate = {
      id: crypto.randomUUID(),
      number: normalized,
      createdAt: Date.now(),
    };
    setPlates([plate, ...plates]);
    setNewPlate('');
  };

  const removePlate = (id: string) => {
    setPlates(plates.filter(p => p.id !== id));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
      }
    } catch (err) {
      console.error("LAPI Camera Error:", err);
      alert("Erreur Caméra. Vérifiez les permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const processFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing || mode !== AppMode.FLASH) return;
    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) return;

    setIsProcessing(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    // LAPI resolution optimization
    const width = 1024;
    const height = (videoRef.current.videoHeight / videoRef.current.videoWidth) * width;
    canvasRef.current.width = width;
    canvasRef.current.height = height;
    
    context.drawImage(videoRef.current, 0, 0, width, height);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
    const base64 = dataUrl.split(',')[1];

    try {
      const detected = await detectPlatesFromImage(base64);
      
      detected.forEach(num => {
        const norm = normalizePlate(num);
        const isMatch = plates.some(p => p.number === norm);
        
        // Add to real-time log
        setSessionLog(prev => [{
          number: norm,
          time: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
          match: isMatch
        }, ...prev].slice(0, 10));

        if (isMatch) {
          audioRef.current?.play().catch(() => {});
          setDetectedRecently(norm);
          setTimeout(() => setDetectedRecently(null), 5000);
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  }, [plates, isProcessing, mode]);

  useEffect(() => {
    let interval: number;
    if (mode === AppMode.FLASH) {
      startCamera();
      interval = window.setInterval(processFrame, 1800);
    } else {
      stopCamera();
    }
    return () => {
      clearInterval(interval);
      stopCamera();
    };
  }, [mode, processFrame]);

  return (
    <div className="flex flex-col h-screen bg-black text-blue-500 overflow-hidden select-none">
      {/* HUD HEADER */}
      <header className="px-4 py-2 bg-slate-900/80 backdrop-blur-md border-b border-blue-900/50 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,1)]" />
          <h1 className="text-sm font-black tracking-tighter uppercase italic">SYSTEME LAPI v2.5</h1>
        </div>
        <div className="text-[10px] text-blue-400 font-mono">
          STATUS: {isProcessing ? 'SCANNING...' : 'WAITING'}
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {mode === AppMode.LIST ? (
          <div className="h-full overflow-y-auto p-4 bg-slate-950 space-y-4">
            <div className="bg-slate-900 p-4 border border-blue-900/30 rounded-lg">
              <p className="text-[10px] uppercase font-bold mb-2 opacity-60">Ajouter Cible Surveillance</p>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  placeholder="PLAQUE"
                  className="flex-1 bg-black border border-blue-900/50 rounded p-2 text-white font-mono uppercase focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button onClick={addPlate} className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-500 transition shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                  ADD
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <HashtagIcon className="w-4 h-4" /> Base Cibles ({plates.length})
              </h2>
              {plates.map(p => (
                <div key={p.id} className="bg-slate-900 border-l-4 border-blue-500 p-3 flex justify-between items-center rounded-r">
                  <div>
                    <span className="text-xl font-black font-mono text-white tracking-widest">{p.number}</span>
                    <p className="text-[8px] opacity-40 uppercase">UID: {p.id.slice(0,8)}</p>
                  </div>
                  <button onClick={() => removePlate(p.id)} className="text-slate-500 hover:text-red-500 transition p-2">
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* LAPI CAMERA INTERFACE */
          <div className="absolute inset-0 flex flex-col bg-black">
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 crt-overlay" />
            
            {/* HUD SCANNER */}
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              <div className="flex-1 relative m-6 border-2 border-blue-500/20 rounded-3xl overflow-hidden">
                <div className="scanning-line" />
                
                {/* HUD Corners */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
                <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" />

                {/* Center Reticle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/10 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-red-500 rounded-full shadow-[0_0_10px_red]" />
                </div>
              </div>

              {/* REAL-TIME DETECTION LOG */}
              <div className="h-1/3 bg-black/60 backdrop-blur-md border-t border-blue-900/50 p-4 font-mono text-[10px] overflow-hidden">
                <div className="flex justify-between border-b border-blue-900/30 pb-1 mb-2">
                  <span className="font-bold opacity-80 tracking-widest">LOG DE DÉTECTION TEMPS RÉEL</span>
                  <span className="text-red-500 animate-pulse">● LIVE</span>
                </div>
                <div className="space-y-1 overflow-y-auto h-full pb-8">
                  {sessionLog.length === 0 && <p className="opacity-30 italic">RECHERCHE DE PLAQUES EN COURS...</p>}
                  {sessionLog.map((log, i) => (
                    <div key={i} className={`flex justify-between items-center ${log.match ? 'text-red-500 font-bold bg-red-500/10 px-1 rounded border-l-2 border-red-500' : 'opacity-60'}`}>
                      <span>[{log.time}]</span>
                      <span className="tracking-widest">{log.number}</span>
                      <span>{log.match ? '!! MATCH !!' : 'CLEAN'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MATCH OVERLAY */}
            {detectedRecently && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xs px-4 pointer-events-none">
                <div className="bg-red-700 border-4 border-white text-white p-4 rounded-xl shadow-[0_0_50px_rgba(255,0,0,0.8)] glitch">
                  <div className="flex items-center gap-3 mb-2">
                    <ExclamationTriangleIcon className="w-8 h-8 shrink-0" />
                    <h2 className="font-black text-xl italic leading-none">CIBLE DÉTECTÉE</h2>
                  </div>
                  <div className="bg-black/40 p-2 rounded border border-white/20 text-center">
                    <span className="text-4xl font-black font-mono tracking-tighter">{detectedRecently}</span>
                  </div>
                  <p className="text-[10px] text-center mt-2 font-bold uppercase tracking-widest opacity-80">Action requise immédiatement</p>
                </div>
              </div>
            )}
            
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}
      </main>

      {/* FOOTER NAVIGATION */}
      <nav className="bg-slate-900 border-t border-blue-900/50 p-4 pb-8 flex justify-around items-center z-50">
        <button onClick={() => setMode(AppMode.LIST)} className={`flex flex-col items-center gap-1 transition-all ${mode === AppMode.LIST ? 'text-blue-400 scale-110' : 'text-slate-500 hover:text-blue-400'}`}>
          <ListBulletIcon className="w-6 h-6" />
          <span className="text-[8px] font-bold uppercase tracking-widest">Base</span>
        </button>

        <button 
          onClick={() => setMode(mode === AppMode.FLASH ? AppMode.LIST : AppMode.FLASH)} 
          className="relative group"
        >
          <div className={`p-4 -mt-12 rounded-full border-4 border-slate-950 shadow-2xl transition-all duration-300 ${mode === AppMode.FLASH ? 'bg-red-600 shadow-[0_0_20px_red]' : 'bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.5)]'}`}>
            {mode === AppMode.FLASH ? (
              <XMarkIcon className="w-8 h-8 text-white" />
            ) : (
              <VideoCameraIcon className="w-8 h-8 text-white" />
            )}
          </div>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest">
            {mode === AppMode.FLASH ? 'DISCONNECT' : 'SCAN LAPI'}
          </span>
        </button>

        <div className="w-6" />
      </nav>
    </div>
  );
};

export default App;
