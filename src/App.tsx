import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Download, Trash2, RefreshCw, ChevronLeft, Settings2, Share2, BookImage, Sparkles, CalendarHeart, Info, X } from 'lucide-react';
import * as Mp4Muxer from 'mp4-muxer';
import { get, set, clear } from 'idb-keyval';

const SHAPES = [
  {
    id: 'circle',
    name: '동그라미',
    desc: '동글동글 귀여운 것들',
    guide: <circle cx="50" cy="50" r="35" strokeDasharray="4 4" />,
    icon: <circle cx="50" cy="50" r="35" />,
    colorClass: 'bg-coral',
    borderClass: 'hover:border-coral'
  },
  {
    id: 'square',
    name: '네모',
    desc: '반듯반듯 네모난 것들',
    guide: <rect x="20" y="20" width="60" height="60" rx="8" strokeDasharray="4 4" />,
    icon: <rect x="20" y="20" width="60" height="60" rx="8" />,
    colorClass: 'bg-sky',
    borderClass: 'hover:border-sky'
  },
  {
    id: 'triangle',
    name: '세모',
    desc: '뾰족뾰족 세모난 것들',
    guide: <polygon points="50,20 85,75 15,75" strokeDasharray="4 4" strokeLinejoin="round" />,
    icon: <polygon points="50,20 85,75 15,75" strokeLinejoin="round" />,
    colorClass: 'bg-butter',
    borderClass: 'hover:border-butter'
  },
  {
    id: 'free',
    name: '자유롭게',
    desc: '모양 상관없이 찰칵!',
    guide: null,
    icon: <path d="M25,60 Q50,20 75,60 T25,60" fill="none" strokeWidth="8" strokeLinecap="round" />,
    colorClass: 'bg-mint',
    borderClass: 'hover:border-mint'
  }
];

export default function App() {
  const [allFrames, setAllFrames] = useState<Record<string, string[]>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [onionSkinOpacity, setOnionSkinOpacity] = useState(0.3);
  const [secondsPerFrame, setSecondsPerFrame] = useState(1);
  const [guideScale, setGuideScale] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const [view, setView] = useState<'home' | 'capture' | 'preview'>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const frames = selectedShapeId ? (allFrames[selectedShapeId] || []) : [];

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load saved data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        let savedAllFrames = await get('matchcut-all-frames');
        if (!savedAllFrames) {
          const oldFrames = await get('matchcut-frames');
          const oldShape = await get('matchcut-shape') || 'circle';
          if (oldFrames && oldFrames.length > 0) {
            savedAllFrames = { [oldShape]: oldFrames };
            await set('matchcut-all-frames', savedAllFrames);
          } else {
            savedAllFrames = {};
          }
        }
        setAllFrames(savedAllFrames);

        const savedShape = await get('matchcut-shape');
        if (savedShape && savedAllFrames[savedShape]?.length > 0) {
          setSelectedShapeId(savedShape);
          setView('capture');
        }
      } catch (err) {
        console.error("Failed to load saved data:", err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Initialize camera
  useEffect(() => {
    if (view === 'capture') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [view]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          aspectRatio: 9/16,
          width: { ideal: 1080 }, 
          height: { ideal: 1920 } 
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("카메라 접근 권한이 필요해요! 📸");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const captureFrame = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = 720;
      canvas.height = 1280;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const videoRatio = video.videoWidth / video.videoHeight;
        const targetRatio = 9 / 16;
        let drawWidth = video.videoWidth;
        let drawHeight = video.videoHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (videoRatio > targetRatio) {
          drawWidth = video.videoHeight * targetRatio;
          offsetX = (video.videoWidth - drawWidth) / 2;
        } else {
          drawHeight = video.videoWidth / targetRatio;
          offsetY = (video.videoHeight - drawHeight) / 2;
        }

        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        setAllFrames(prev => {
          if (!selectedShapeId) return prev;
          const currentFrames = prev[selectedShapeId] || [];
          const newAllFrames = { ...prev, [selectedShapeId]: [...currentFrames, dataUrl] };
          set('matchcut-all-frames', newAllFrames).catch(console.error);
          return newAllFrames;
        });
      }
    }
  }, [selectedShapeId]);

  const removeFrame = (index: number) => {
    setAllFrames(prev => {
      if (!selectedShapeId) return prev;
      const currentFrames = prev[selectedShapeId] || [];
      const newAllFrames = { ...prev, [selectedShapeId]: currentFrames.filter((_, i) => i !== index) };
      set('matchcut-all-frames', newAllFrames).catch(console.error);
      return newAllFrames;
    });
  };

  const generateVideo = async () => {
    if (frames.length === 0 || !canvasRef.current) return;
    setIsGenerating(true);
    setView('preview');

    try {
      if (!('VideoEncoder' in window)) {
        throw new Error("이 브라우저는 MP4 인코딩을 지원하지 않아요. 최신 브라우저를 사용해주세요!");
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error("Could not get 2d context");

      canvas.width = 720;
      canvas.height = 1280;

      let muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: 720,
          height: 1280
        },
        fastStart: 'in-memory'
      });

      let videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta as Mp4Muxer.Mp4VideoChunkMetadata),
        error: e => console.error("VideoEncoder error:", e)
      });

      videoEncoder.configure({
        codec: 'avc1.42E01F',
        width: 720,
        height: 1280,
        bitrate: 5_000_000,
        framerate: Math.max(1, Math.round(1 / secondsPerFrame)),
      });

      for (let i = 0; i < frames.length; i++) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = frames[i];
        });
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const timestamp = i * secondsPerFrame * 1_000_000;
        const duration = secondsPerFrame * 1_000_000;
        const frame = new VideoFrame(canvas, { timestamp, duration });
        videoEncoder.encode(frame, { keyFrame: true });
        frame.close();
      }

      await videoEncoder.flush();
      muxer.finalize();
      
      const buffer = muxer.target.buffer;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (error) {
      console.error("Error generating video:", error);
      alert(error instanceof Error ? error.message : "영상 생성 중 오류가 발생했어요.");
      setView('capture');
    } finally {
      setIsGenerating(false);
    }
  };

  const shareVideo = async () => {
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const file = new File([blob], 'matchcut.mp4', { type: 'video/mp4' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: '나의 매치컷 기록',
          text: '내가 만든 귀여운 매치컷 영상! 🎬✨',
          files: [file]
        });
      } else {
        alert('이 브라우저에서는 공유 기능을 지원하지 않아요. 다운로드 후 공유해주세요! 🥲');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const resetAll = async () => {
    if (window.confirm("현재 도형의 기록을 모두 지울까요? 📝")) {
      setAllFrames(prev => {
        if (!selectedShapeId) return prev;
        const newAllFrames = { ...prev, [selectedShapeId]: [] };
        set('matchcut-all-frames', newAllFrames).catch(console.error);
        return newAllFrames;
      });
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
    }
  };

  const handleBackToHome = () => {
    setView('home');
  };

  const handleSelectShape = async (id: string) => {
    setSelectedShapeId(id);
    await set('matchcut-shape', id);
    setView('capture');
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" /></div>;

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  if (view === 'home') {
    return (
      <div className="min-h-screen text-ink flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <button 
          onClick={() => setShowInfo(true)} 
          className="absolute top-6 right-6 p-3 bg-white rounded-full shadow-sm text-ink/60 hover:text-ink hover:scale-110 transition-all z-20"
        >
          <Info className="w-6 h-6" />
        </button>

        <div className="max-w-md w-full space-y-10 z-10">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-sm mb-2 rotate-[-3deg] relative">
              <BookImage className="w-10 h-10 text-coral" />
            </div>
            <div className="space-y-1">
              <p className="text-sky font-bold text-sm">{today}</p>
              <h1 className="text-4xl font-bold tracking-tight text-ink">나의 매치컷 일기장</h1>
            </div>
            <p className="text-ink/70 text-lg">
              오늘의 귀여운 조각들을 모아<br/>하나의 일기로 엮어봐요 ✏️
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {SHAPES.map(shape => {
              const frameCount = allFrames[shape.id]?.length || 0;
              return (
              <button
                key={shape.id}
                onClick={() => handleSelectShape(shape.id)}
                className={`relative bg-white rounded-xl p-6 flex flex-col items-center gap-4 shadow-sm hover:shadow-md transition-all border-2 border-transparent ${shape.borderClass} group`}
              >
                <div className="washi-tape" style={{ width: '50px', top: '-8px' }}></div>
                {frameCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-coral text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm z-10 animate-in zoom-in">
                    {frameCount}장
                  </div>
                )}
                <div className={`w-16 h-16 rounded-full ${shape.colorClass} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                  <svg viewBox="0 0 100 100" className="w-8 h-8 stroke-white stroke-[2] fill-none">
                    {shape.icon}
                  </svg>
                </div>
                <div className="text-center">
                  <span className="block font-bold text-ink text-lg">{shape.name}</span>
                  <span className="block text-xs text-ink/50 mt-1">{shape.desc}</span>
                </div>
              </button>
            )})}
          </div>
        </div>

        {/* Info Modal */}
        {showInfo && (
          <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white p-6 pt-8 rounded-2xl max-w-sm w-full relative shadow-xl rotate-1">
              <div className="washi-tape" style={{ width: '100px', top: '-14px' }}></div>
              <button 
                onClick={() => setShowInfo(false)} 
                className="absolute top-4 right-4 p-2 text-ink/40 hover:text-ink transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-2xl font-bold text-ink mb-6 flex items-center gap-2">
                <BookImage className="w-6 h-6 text-coral" />
                일기장 사용법
              </h2>
              
              <div className="space-y-5 text-ink/80 text-sm leading-relaxed">
                <div>
                  <strong className="text-ink text-base flex items-center gap-1.5 mb-1">
                    <span className="bg-butter w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span> 
                    모양 고르기
                  </strong>
                  <p className="pl-6">동그라미, 네모, 세모 등 오늘 기록하고 싶은 모양을 선택해주세요.</p>
                </div>
                
                <div>
                  <strong className="text-ink text-base flex items-center gap-1.5 mb-1">
                    <span className="bg-mint w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> 
                    가이드에 맞춰 찰칵!
                  </strong>
                  <p className="pl-6">화면에 나타난 가이드라인에 피사체를 맞추고 사진을 찍어보세요. (우측 상단 ⚙️설정에서 가이드 크기도 조절할 수 있어요!)</p>
                </div>
                
                <div>
                  <strong className="text-ink text-base flex items-center gap-1.5 mb-1">
                    <span className="bg-sky w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span> 
                    매치컷 일기 완성 🎬
                  </strong>
                  <p className="pl-6">사진을 다 찍고 재생(▶) 버튼을 누르면, 뚝딱뚝딱 나만의 귀여운 매치컷 영상이 완성됩니다.</p>
                </div>

                <div className="bg-paper p-4 rounded-xl border border-ink/5 mt-6 relative rotate-[-1deg]">
                  <div className="washi-tape" style={{ width: '40px', top: '-8px', right: '10px', left: 'auto', transform: 'rotate(5deg)' }}></div>
                  <p className="font-bold text-coral mb-1">💡 꿀팁!</p>
                  <p>찍은 사진들은 자동으로 저장되니, 언제든 앱을 나갔다 들어와서 이어 찍을 수 있어요!</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const activeShape = SHAPES.find(s => s.id === selectedShapeId);

  return (
    <div className="min-h-screen text-ink flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {view === 'capture' ? (
            <button 
              onClick={handleBackToHome}
              className="px-4 py-2 rounded-full bg-white shadow-sm hover:bg-gray-50 text-ink transition-colors flex items-center gap-1 text-sm font-bold"
            >
              <ChevronLeft className="w-4 h-4" />
              일기장으로
            </button>
          ) : (
            <div className="flex items-center gap-2 px-2 text-ink bg-white/80 backdrop-blur-sm py-1.5 rounded-full shadow-sm">
              <BookImage className="w-5 h-5 text-coral" />
              <h1 className="text-sm font-bold tracking-tight pr-2">나의 매치컷 일기장</h1>
            </div>
          )}
        </div>
        
        {view === 'capture' && (
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-full bg-white shadow-sm hover:bg-gray-50 text-ink transition-colors pointer-events-auto"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Settings Panel */}
      {showSettings && view === 'capture' && (
        <div className="fixed top-20 right-4 z-50 bg-white/95 backdrop-blur-xl border border-ink/5 rounded-[2rem] p-6 w-72 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="space-y-6">
            <div>
              <label className="flex justify-between text-sm font-bold text-ink mb-3">
                <span>잔상(오니언 스킨) 진하기</span>
                <span className="text-coral">{Math.round(onionSkinOpacity * 100)}%</span>
              </label>
              <input 
                type="range" 
                min="0" max="1" step="0.1" 
                value={onionSkinOpacity}
                onChange={(e) => setOnionSkinOpacity(parseFloat(e.target.value))}
                className="w-full accent-coral"
              />
            </div>
            <div>
              <label className="flex justify-between text-sm font-bold text-ink mb-3">
                <span>사진당 시간</span>
                <span className="text-coral">{secondsPerFrame}초</span>
              </label>
              <input 
                type="range" 
                min="0.1" max="3" step="0.1" 
                value={secondsPerFrame}
                onChange={(e) => setSecondsPerFrame(parseFloat(e.target.value))}
                className="w-full accent-coral"
              />
            </div>
            <div>
              <label className="flex justify-between text-sm font-bold text-ink mb-3">
                <span>가이드 크기</span>
                <span className="text-coral">{Math.round(guideScale * 100)}%</span>
              </label>
              <input 
                type="range" 
                min="0.5" max="2" step="0.1" 
                value={guideScale}
                onChange={(e) => setGuideScale(parseFloat(e.target.value))}
                className="w-full accent-coral"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full relative overflow-hidden flex flex-col pt-20">
        {view === 'capture' ? (
          <>
            {/* Camera View (9:16 Container) */}
            <div className="relative flex-1 overflow-hidden flex items-center justify-center px-4">
              <div className="relative w-full max-w-[min(100%,(100vh-320px)*9/16)] bg-white p-3 pb-12 rounded-sm shadow-md rotate-[-1deg]">
                <div className="washi-tape"></div>
                <div className="relative w-full aspect-[9/16] bg-black overflow-hidden rounded-sm">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  
                  {/* Onion Skin (Previous Frame) */}
                  {frames.length > 0 && (
                    <img 
                      src={frames[frames.length - 1]} 
                      alt="Previous frame" 
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ opacity: onionSkinOpacity }}
                    />
                  )}

                  {/* Shape Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {activeShape && activeShape.guide && (
                      <svg 
                        viewBox="0 0 100 100" 
                        className="w-[60%] max-w-sm drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] stroke-white stroke-[1.5] fill-none opacity-90 transition-transform" 
                        style={{ overflow: 'visible', transform: `scale(${guideScale})` }}
                      >
                        {activeShape.guide}
                      </svg>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-3 left-0 right-0 text-center font-bold text-ink/60 text-sm">
                  {activeShape?.name} 기록 중... ✏️
                </div>
              </div>
            </div>

            {/* Controls & Timeline */}
            <div className="pb-[env(safe-area-inset-bottom)] pt-2">
              {/* Timeline */}
              <div className="h-28 flex items-center px-6 overflow-x-auto gap-4 snap-x hide-scrollbar">
                {frames.length === 0 ? (
                  <div className="w-full text-center text-ink/50 text-sm font-bold flex items-center justify-center gap-2 bg-white/50 py-4 rounded-xl border border-ink/5">
                    <Sparkles className="w-4 h-4" />
                    <span>첫 번째 조각을 기록해주세요!</span>
                  </div>
                ) : (
                  frames.map((frame, idx) => (
                    <div key={idx} className={`relative group shrink-0 snap-center bg-white p-2 pb-6 rounded-sm shadow-sm ${idx % 2 === 0 ? 'rotate-3' : '-rotate-3'} hover:rotate-0 transition-transform`}>
                      <div className="washi-tape" style={{ width: '30px', top: '-6px', height: '16px' }}></div>
                      <div className="w-14 h-20 overflow-hidden bg-ink/5">
                        <img src={frame} alt={`Frame ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-bold text-ink/40">
                        {idx + 1}
                      </div>
                      <button 
                        onClick={() => removeFrame(idx)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Controls */}
              <div className="h-32 flex items-center justify-between px-8 max-w-md mx-auto w-full">
                <button 
                  onClick={resetAll}
                  disabled={frames.length === 0}
                  className="w-14 h-14 rounded-full flex items-center justify-center bg-white shadow-sm hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  <RefreshCw className="w-6 h-6 text-ink" />
                </button>

                <button 
                  onClick={captureFrame}
                  className="w-20 h-20 rounded-full border-4 border-coral flex items-center justify-center p-1 active:scale-95 transition-transform bg-white shadow-sm"
                >
                  <div className="w-full h-full bg-coral rounded-full" />
                </button>

                <button 
                  onClick={generateVideo}
                  disabled={frames.length < 2}
                  className="w-14 h-14 rounded-full flex items-center justify-center bg-ink text-white hover:bg-ink/80 disabled:opacity-30 transition-colors shadow-sm"
                >
                  <Play className="w-6 h-6 ml-1 fill-white" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Preview View */
          <div className="flex-1 flex flex-col">
            <div className="p-4 pt-safe flex items-center justify-between">
              <button 
                onClick={() => setView('capture')}
                className="px-4 py-2 rounded-full bg-white shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1 text-sm font-bold text-ink"
              >
                <ChevronLeft className="w-4 h-4" />
                뒤로가기
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-4 border-coral/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-coral rounded-full border-t-transparent animate-spin" />
                  </div>
                  <p className="text-coral font-bold animate-pulse tracking-tight">일기를 엮는 중... 🎬</p>
                </div>
              ) : videoUrl ? (
                <>
                  <div className="relative w-full max-w-[min(100%,(100vh-300px)*9/16)] bg-white p-3 pb-12 rounded-sm shadow-md rotate-1">
                    <div className="washi-tape"></div>
                    <div className="w-full aspect-[9/16] bg-ink/5 overflow-hidden rounded-sm">
                      <video 
                        src={videoUrl} 
                        controls 
                        autoPlay 
                        loop 
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 text-center font-bold text-ink/60">
                      {activeShape?.name} 일기 완성! ✨
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 w-full max-w-[min(100%,(100vh-300px)*9/16)]">
                    <button 
                      onClick={shareVideo}
                      className="w-full py-4 rounded-2xl font-bold text-lg bg-coral text-white hover:bg-coral/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Share2 className="w-5 h-5" />
                      친구들에게 자랑하기
                    </button>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setView('capture')}
                        className="flex-1 py-4 rounded-2xl font-bold bg-white text-ink shadow-sm hover:bg-gray-50 transition-colors"
                      >
                        더 찍기
                      </button>
                      <a 
                        href={videoUrl} 
                        download={`matchcut-${Date.now()}.mp4`}
                        className="flex-1 py-4 rounded-2xl font-bold bg-ink text-white hover:bg-ink/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Download className="w-5 h-5" />
                        저장
                      </a>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
