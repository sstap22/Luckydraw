/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Trophy, Users, Play, RotateCcw, Trash2, Plus, X, ListChecks, Image as ImageIcon, Type as TypeIcon, Maximize, Download, AlertCircle, CheckCircle2, Info, Lock, Search } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import logoDefault from './Image/Logo/logo.png';
import heroDefault from './Image/Hero/hero.jpg';
import spinSoundFile from './Sound/soundspin.mp3';

interface Participant {
  id: string;
  name: string;
  phone: string;
}

interface Prize {
  id: string;
  name: string;
  quantity: number;
  remaining: number;
  list: Participant[];
  color?: string;
}

interface AppSettings {
  title: string;
  titleColor: string;
  titleSize: number;
  titleFont: string;
  logoUrl: string;
  logoSize: number;
  bgUrl: string;
  spinDuration: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  title: 'Lucky Draw Pro',
  titleColor: '#eab308', // yellow-500
  titleSize: 48,
  titleFont: 'Inter',
  logoUrl: logoDefault,
  logoSize: 60,
  bgUrl: heroDefault,
  spinDuration: 3000,
};

const DEFAULT_PRIZES: Prize[] = [
  { id: 'A', name: 'Giải A', quantity: 1, remaining: 1, list: [], color: '#eab308' },
  { id: 'B', name: 'Giải B', quantity: 3, remaining: 3, list: [], color: '#3b82f6' },
  { id: 'C', name: 'Giải C', quantity: 3, remaining: 3, list: [], color: '#10b981' },
  { id: 'D', name: 'Giải D', quantity: 10, remaining: 10, list: [], color: '#8b5cf6' },
];

const SAMPLE_PARTICIPANTS: Record<string, Participant[]> = {
  A: [
    { id: 'A001', name: 'Nguyễn Văn A', phone: '0901234567' },
    { id: 'A002', name: 'Trần Thị B', phone: '0912345678' },
  ],
  B: [
    { id: 'B001', name: 'Lê Văn C', phone: '0923456789' },
    { id: 'B002', name: 'Phạm Thị D', phone: '0934567890' },
    { id: 'B003', name: 'Hoàng Văn E', phone: '0945678901' },
    { id: 'B004', name: 'Đặng Thị F', phone: '0956789012' },
  ],
  C: [
    { id: 'C001', name: 'Bùi Văn G', phone: '0967890123' },
    { id: 'C002', name: 'Vũ Thị H', phone: '0978901234' },
    { id: 'C003', name: 'Đỗ Văn I', phone: '0989012345' },
    { id: 'C004', name: 'Ngô Thị K', phone: '0990123456' },
  ],
  D: Array.from({ length: 20 }, (_, i) => ({
    id: `D${String(i + 1).padStart(3, '0')}`,
    name: `Người dùng D${i + 1}`,
    phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
  })),
};

export default function App() {
  const [prizes, setPrizes] = useState<Prize[]>(() => {
    const saved = localStorage.getItem('lucky-draw-prizes');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((p: Prize) => ({
        ...p,
        list: p.list && p.list.length > 0 ? p.list : (SAMPLE_PARTICIPANTS[p.id] || [])
      }));
    }
    return DEFAULT_PRIZES.map(p => ({
      ...p,
      list: SAMPLE_PARTICIPANTS[p.id] || []
    }));
  });

  const [winners, setWinners] = useState<{ prizeId: string; person: Participant; timestamp: number }[]>(() => {
    const saved = localStorage.getItem('lucky-draw-winners');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('lucky-draw-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Reset to defaults if saved values are not base64 data (i.e., they are old image paths)
      const logoUrl = parsed.logoUrl?.startsWith('data:') ? parsed.logoUrl : logoDefault;
      const bgUrl = parsed.bgUrl?.startsWith('data:') ? parsed.bgUrl : heroDefault;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        logoUrl,
        bgUrl,
      };
    }
    return DEFAULT_SETTINGS;
  });

  const [currentPrizeId, setCurrentPrizeId] = useState<string>(prizes[0]?.id || '');
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayPerson, setDisplayPerson] = useState<Participant | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWinners, setShowWinners] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showFullInfo, setShowFullInfo] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [deleteWinnerTarget, setDeleteWinnerTarget] = useState<{ prizeId: string; personId: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [winnerSearchQuery, setWinnerSearchQuery] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordVerified, setAdminPasswordVerified] = useState(false);
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [passwordModalType, setPasswordModalType] = useState<'delete' | 'admin' | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;

    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  }, []);

  const ensureAudioReady = useCallback(async () => {
    const context = getAudioContext();
    if (!context) return null;

    if (context.state === 'suspended') {
      await context.resume();
    }

    return context;
  }, [getAudioContext]);

  const stopSpinSound = useCallback(() => {
    if (spinAudioRef.current) {
      spinAudioRef.current.pause();
      spinAudioRef.current.currentTime = 0;
    }
  }, []);

  const playSpinSound = useCallback(async () => {
    stopSpinSound();
    const context = await ensureAudioReady();
    if (!context) return;

    if (!spinAudioRef.current) {
      spinAudioRef.current = new Audio(spinSoundFile);
      spinAudioRef.current.preload = 'auto';
      spinAudioRef.current.loop = true;
      spinAudioRef.current.volume = 0.95;
    }

    spinAudioRef.current.currentTime = 0;
    const playPromise = spinAudioRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        spinAudioRef.current?.load();
        spinAudioRef.current?.play().catch(() => {});
      });
    }
  }, [ensureAudioReady, stopSpinSound]);

  const playWinSound = useCallback(async () => {
    const context = await ensureAudioReady();
    if (!context) return;

    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const filter = context.createBiquadFilter();

    master.gain.value = 1.0;
    compressor.threshold.value = -24;
    compressor.knee.value = 22;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.15;
    filter.type = 'highpass';
    filter.frequency.value = 150;
    filter.Q.value = 1;

    master.connect(filter);
    filter.connect(compressor);
    compressor.connect(context.destination);

    const fanfare = [392, 523.25, 659.25, 783.99, 659.25, 523.25, 392, 587.33];
    fanfare.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = index < 3 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(master);

      const startTime = context.currentTime + index * 0.12;
      const peakGain = index < 4 ? 0.48 : 0.34;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.34);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.37);
    });

    const shimmerOscillator = context.createOscillator();
    const shimmerGain = context.createGain();
    shimmerOscillator.type = 'sine';
    shimmerOscillator.frequency.value = 1568;
    shimmerGain.gain.value = 0.0001;
    shimmerOscillator.connect(shimmerGain);
    shimmerGain.connect(master);
    const shimmerStart = context.currentTime + 0.22;
    shimmerGain.gain.setValueAtTime(0.0001, shimmerStart);
    shimmerGain.gain.exponentialRampToValueAtTime(0.12, shimmerStart + 0.02);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, shimmerStart + 0.24);
    shimmerOscillator.start(shimmerStart);
    shimmerOscillator.stop(shimmerStart + 0.26);

    const tailDelay = context.createDelay(1.2);
    const tailFeedback = context.createGain();
    const tailFilter = context.createBiquadFilter();
    const tailGain = context.createGain();

    tailDelay.delayTime.value = 0.28;
    tailFeedback.gain.value = 0.22;
    tailFilter.type = 'lowpass';
    tailFilter.frequency.value = 1400;
    tailFilter.Q.value = 0.8;
    tailGain.gain.value = 0.0001;

    tailGain.connect(tailFilter);
    tailFilter.connect(tailDelay);
    tailDelay.connect(tailFeedback);
    tailFeedback.connect(tailDelay);
    tailDelay.connect(master);

    const tailChord = [392, 523.25, 659.25, 783.99];
    tailChord.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(tailGain);

      const startTime = context.currentTime + 0.86 + index * 0.015;
      const peakGain = index === tailChord.length - 1 ? 0.12 : 0.09;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.95);
      oscillator.start(startTime);
      oscillator.stop(startTime + 1.0);
    });
  }, [ensureAudioReady]);

  // Temporary states for settings modal
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
  const [tempPrizes, setTempPrizes] = useState<Prize[]>(prizes);
  const [tempAllParticipants, setTempAllParticipants] = useState<Participant[]>(() => 
    Array.from(new Map<string, Participant>(prizes.flatMap(p => p.list).map(p => [p.id, p])).values())
  );

  const spinIntervalRef = useRef<number | null>(null);

  // Sync temp states when opening settings
  useEffect(() => {
    if (showSettings) {
      setTempSettings(settings);
      setTempPrizes(prizes);
      setTempAllParticipants(Array.from(new Map<string, Participant>(prizes.flatMap(p => p.list).map(p => [p.id, p])).values()));
    }
  }, [showSettings, settings, prizes]);

  useEffect(() => {
    localStorage.setItem('lucky-draw-prizes', JSON.stringify(prizes));
  }, [prizes]);

  useEffect(() => {
    localStorage.setItem('lucky-draw-winners', JSON.stringify(winners));
  }, [winners]);

  useEffect(() => {
    localStorage.setItem('lucky-draw-settings', JSON.stringify(settings));
  }, [settings]);

  const currentPrizeIndex = prizes.findIndex(p => p.id === currentPrizeId);
  const currentPrize = prizes[currentPrizeIndex];
  
  // Logic: Prize at index i includes participants from lists 0 to i
  const cumulativeList = prizes
    .slice(0, currentPrizeIndex + 1)
    .reduce((acc: Participant[], prize: Prize) => [...acc, ...prize.list], [] as Participant[]);
  
  // Remove duplicates (by ID) and filter out winners
  const availableParticipants: Participant[] = Array.from(new Map<string, Participant>(cumulativeList.map(p => [p.id, p])).values())
    .filter(p => !winners.some(w => w.person.id === p.id));

  // All participants for display (remove duplicates)
  const displayParticipants: Participant[] = Array.from(new Map<string, Participant>(
    prizes.flatMap(prize => prize.list).map(p => [p.id, p])
  ).values());

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const startSpin = useCallback(() => {
    if (isSpinning || displayParticipants.length === 0 || availableParticipants.length === 0 || (currentPrize && currentPrize.remaining <= 0)) {
      if (displayParticipants.length === 0) showNotification('Không có người tham gia để hiển thị!', 'error');
      else if (availableParticipants.length === 0) showNotification('Không còn người tham gia hợp lệ cho giải này!', 'error');
      else if (currentPrize && currentPrize.remaining <= 0) showNotification('Giải này đã hết số lượng!', 'error');
      return;
    }

    setIsSpinning(true);
    setIsConfirming(false);
    setShowFullInfo(false);
    
    void playSpinSound();
    
    // Shuffle animation
    spinIntervalRef.current = window.setInterval(() => {
      const randomIndex = Math.floor(Math.random() * displayParticipants.length);
      setDisplayPerson(displayParticipants[randomIndex]);
    }, 40); // Faster spin

    // Stop spin after duration
    setTimeout(() => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      
      // Stop spin sound
      stopSpinSound();

      // Play win sound
      void playWinSound();
      
      const winner = availableParticipants[Math.floor(Math.random() * availableParticipants.length)];
      setDisplayPerson(winner);
      setIsSpinning(false);
      setIsConfirming(true);
      
      // Delay showing full info
      setTimeout(() => {
        setShowFullInfo(true);
      }, 1000);
      
      // Celebrate
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF4500', '#FFFFFF']
      });
    }, settings.spinDuration);
  }, [isSpinning, availableParticipants, currentPrize, currentPrizeId, settings.spinDuration, playSpinSound, playWinSound, stopSpinSound]);

  const handleConfirmWinner = () => {
    if (!displayPerson || !currentPrizeId) return;

    // Add winner
    setWinners(prev => [...prev, { prizeId: currentPrizeId, person: displayPerson, timestamp: Date.now() }]);
    
    // Update remaining
    setPrizes(prev => {
      const updated = prev.map(p => p.id === currentPrizeId ? { ...p, remaining: p.remaining - 1 } : p);
      const current = updated.find(p => p.id === currentPrizeId);
      if (current && current.remaining === 0) {
        setTimeout(() => showNotification(`Đã quay hết số lượng ${current.name}!`, 'info'), 500);
      }
      return updated;
    });

    setIsConfirming(false);
    showNotification('Đã xác nhận người trúng giải!', 'success');
  };

  const handleCancelWinner = () => {
    setDisplayPerson(null);
    setIsConfirming(false);
    setShowFullInfo(false);
    showNotification('Đã hủy lượt quay vừa rồi!', 'info');
  };

  const resetWinners = () => {
    setDeleteWinnerTarget(null);
    setPasswordModalType('delete');
    setShowPasswordModal(true);
  };

  const handleDeleteWinner = (prizeId: string, personId: string) => {
    setDeleteWinnerTarget({ prizeId, personId });
    setPasswordModalType('delete');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = () => {
    if (passwordModalType === 'delete') {
      if (passwordInput.trim() === 'tap') {
        if (deleteWinnerTarget) {
          // Delete single winner
          const { prizeId, personId } = deleteWinnerTarget;
          setWinners(prev => prev.filter(w => !(w.prizeId === prizeId && w.person.id === personId)));
          setPrizes(prev => prev.map(p => p.id === prizeId ? { ...p, remaining: p.remaining + 1 } : p));
          setDeleteWinnerTarget(null);
          showNotification('Đã xóa người trúng giải này!', 'success');
        } else {
          // Reset all
          const resetPrizes = prizes.map(p => ({ ...p, remaining: p.quantity }));
          setWinners([]);
          setPrizes(resetPrizes);
          setTempPrizes(resetPrizes);
          setDisplayPerson(null);
          showNotification('Đã xóa tất cả kết quả trúng thưởng!', 'success');
        }
        setShowPasswordModal(false);
        setPasswordInput('');
        setPasswordModalType(null);
      } else {
        showNotification('Mật khẩu không đúng!', 'error');
      }
    } else if (passwordModalType === 'admin') {
      if (adminPasswordInput.trim() === 'tap') {
        setAdminPasswordVerified(true);
        setShowParticipants(true);
        setAdminPasswordInput('');
        setShowPasswordModal(false);
        setPasswordModalType(null);
      } else {
        showNotification('Mật khẩu không đúng!', 'error');
        setAdminPasswordInput('');
      }
    }
  };

  const handleOpenParticipants = () => {
    if (adminPasswordVerified) {
      setShowParticipants(true);
    } else {
      setPasswordModalType('admin');
      setShowPasswordModal(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'bg') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === 'logo') {
        setTempSettings(prev => ({ ...prev, logoUrl: base64String }));
      } else {
        setTempSettings(prev => ({ ...prev, bgUrl: base64String }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = () => {
    setSettings(tempSettings);
    setPrizes(tempPrizes);
    setShowSettings(false);
    // confetti for feedback
    confetti({
      particleCount: 50,
      spread: 40,
      origin: { y: 0.9 },
      colors: ['#22c55e']
    });
  };

  const handleDownloadWinners = () => {
    if (winners.length === 0) return;

    // BOM for UTF-8 support in Excel
    const BOM = '\uFEFF';
    let csvContent = "Giải thưởng,Họ tên,Gen,Số điện thoại,Thời gian\n";
    
    winners.forEach(w => {
      const prize = prizes.find(p => p.id === w.prizeId);
      const prizeName = prize ? prize.name : w.prizeId;
      const time = new Date(w.timestamp).toLocaleString();
      csvContent += `"${prizeName}","${w.person.name}","${w.person.id}","${w.person.phone}","${time}"\n`;
    });

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `danh_sach_trung_thuong_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-yellow-500/30 flex flex-col relative overflow-hidden"
      style={{
        backgroundImage: `url(${settings.bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Header / Top Bar */}
      <header className="p-6 flex justify-between items-center bg-transparent sticky top-0 z-20">
        {/* Left: Logo */}
        <div className="w-1/4">
          {settings.logoUrl && (
            <img 
              src={settings.logoUrl} 
              alt="Logo" 
              referrerPolicy="no-referrer"
              style={{ height: `${settings.logoSize}px`, width: 'auto' }}
              className="object-contain"
            />
          )}
        </div>

        {/* Center: Title */}
        <div className="flex-1 text-center">
          <h1 
            style={{ 
              color: settings.titleColor, 
              fontSize: `${settings.titleSize}px`,
              fontFamily: settings.titleFont 
            }}
            className="font-black tracking-tight drop-shadow-2xl"
          >
            {settings.title}
          </h1>
        </div>

        {/* Right: Buttons */}
        <div className="w-1/4 flex justify-end gap-3">
          <button 
            onClick={() => setShowWinners(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors relative bg-slate-800/50"
            title="Danh sách trúng giải"
          >
            <ListChecks size={24} />
            {winners.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-[10px] flex items-center justify-center rounded-full border-2 border-slate-900">
                {winners.length}
              </span>
            )}
          </button>
          <button 
            onClick={handleOpenParticipants}
            className="p-2 hover:bg-white/10 rounded-full transition-colors relative bg-slate-800/50"
            title="Danh sách người tham gia (Admin)"
          >
            <Users size={24} />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors bg-slate-800/50"
            title="Cài đặt"
          >
            <Settings size={24} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-y-auto">
        {/* Sidebar - Prize Selector (1/4 width) */}
        <aside className="w-1/4 bg-transparent p-6 flex flex-col gap-4 overflow-y-auto border-r border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="text-yellow-500" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Danh sách giải</h2>
          </div>
          {prizes.map(prize => (
            <button
              key={prize.id}
              onClick={() => !isSpinning && setCurrentPrizeId(prize.id)}
              disabled={isSpinning}
              className={cn(
                "w-full p-4 rounded-2xl font-semibold transition-all duration-300 border-2 text-left flex flex-col gap-1",
                currentPrizeId === prize.id 
                  ? "shadow-xl scale-[1.02] border-white/20" 
                  : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-500 hover:bg-slate-800"
              )}
              style={currentPrizeId === prize.id ? { 
                backgroundColor: prize.color || '#eab308',
                color: '#000'
              } : {}}
            >
              <span className="text-lg">{prize.name}</span>
              <div className="flex justify-between items-center opacity-70 text-xs">
                <span>Số lượng: {prize.quantity}</span>
                <span>Còn lại: {prize.remaining}</span>
              </div>
              <div className="w-full bg-black/20 h-1.5 rounded-full mt-1 overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-500", currentPrizeId === prize.id ? "bg-slate-900" : "bg-yellow-500")}
                  style={{ 
                    width: `${(prize.remaining / prize.quantity) * 100}%`,
                    backgroundColor: currentPrizeId === prize.id ? '#000' : (prize.color || '#eab308')
                  }}
                />
              </div>
            </button>
          ))}
        </aside>

        {/* Main Content (3/4 width) */}
        <main className="w-3/4 flex flex-col items-center justify-start py-12 px-8 relative">
          {/* Display Area */}
          <div className="relative w-full max-w-4xl min-h-[650px] bg-gradient-to-b from-slate-800/80 to-slate-900/90 backdrop-blur-md rounded-[40px] border-4 border-slate-700/50 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-12 text-center transition-all duration-500">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-500 rounded-full blur-3xl" />
              <div className="absolute bottom-10 right-10 w-32 h-32 bg-blue-500 rounded-full blur-3xl" />
            </div>

            <AnimatePresence mode="wait">
              {isSpinning ? (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-6"
                >
                  <div className="relative">
                    <div className="w-32 h-32 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
                    <Trophy size={48} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-yellow-500 animate-pulse" />
                  </div>
                  <p className="text-3xl font-bold text-yellow-500 animate-pulse tracking-widest uppercase">Đang tìm người may mắn...</p>
                  
                  {/* Preview of names jumping */}
                  {displayPerson && (
                    <motion.div
                      key={displayPerson.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 0.8, scale: 1.2 }}
                      className="text-6xl font-mono font-bold text-yellow-400"
                    >
                      {displayPerson.id}
                    </motion.div>
                  )}
                </motion.div>
              ) : displayPerson ? (
                <motion.div
                  key={displayPerson.id}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex flex-col gap-6"
                >
                  {isConfirming && (
                    <div className="mb-4 inline-block px-6 py-2 bg-yellow-500 text-slate-900 font-black rounded-full animate-bounce uppercase tracking-widest text-sm">
                      Chúc mừng người trúng giải!
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">GEN</span>
                    <div className="text-5xl md:text-7xl font-mono font-bold text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                      {displayPerson.id}
                    </div>
                  </div>

                  <AnimatePresence>
                    {showFullInfo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-4 overflow-hidden"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Họ và Tên</span>
                          <div className="text-4xl md:text-6xl font-black text-white drop-shadow-lg">
                            {displayPerson.name}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Số điện thoại</span>
                          <div className="text-3xl md:text-5xl font-semibold text-slate-300">
                            {displayPerson.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1***$3')}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isConfirming && showFullInfo && (
                    <div className="mt-8 flex gap-4 justify-center">
                      <button
                        onClick={handleCancelWinner}
                        className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 border border-white/10"
                      >
                        <RotateCcw size={20} />
                        Quay lại
                      </button>
                      <button
                        onClick={handleConfirmWinner}
                        className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-green-500/20 transition-all active:scale-95"
                      >
                        <CheckCircle2 size={20} />
                        Xác nhận
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="text-slate-600 flex flex-col items-center gap-4">
                  <Trophy size={100} className="opacity-20" />
                  {currentPrize && currentPrize.remaining > 0 ? (
                    <p className="text-2xl font-medium">Sẵn sàng quay {currentPrize.name}</p>
                  ) : (
                    <p className="text-2xl font-medium text-red-400/80 max-w-md">
                      Số lượng {currentPrize?.name} đã hết, Vui lòng quay giải tiếp theo
                    </p>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Spin Button */}
          <div className="mt-12">
            {!isConfirming && (
              <button
                onClick={startSpin}
                disabled={isSpinning}
                className={cn(
                  "group relative px-20 py-8 rounded-full text-3xl font-black uppercase tracking-widest transition-all duration-500 overflow-hidden",
                  isSpinning 
                    ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
                    : (availableParticipants.length === 0 || (currentPrize && currentPrize.remaining <= 0))
                      ? "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      : "bg-yellow-500 text-slate-900 hover:scale-110 hover:shadow-2xl hover:shadow-yellow-500/40 active:scale-95"
                )}
              >
                <span className="relative z-10 flex items-center gap-4">
                  {isSpinning ? (
                    <>
                      <RotateCcw className="animate-spin" size={32} />
                      Đang quay...
                    </>
                  ) : (
                    <>
                      <Play fill="currentColor" size={32} />
                      Quay số
                    </>
                  )}
                </span>
                {!isSpinning && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                )}
              </button>
            )}
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings size={20} /> Cài đặt chương trình
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveSettings}
                  className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-full font-bold text-sm transition-all shadow-lg shadow-green-900/20 flex items-center gap-2"
                >
                  Lưu thay đổi
                </button>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* All Participants List */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-slate-400">Danh sách tất cả người tham gia ( Tên,GEN,SĐT)</label>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-yellow-500 uppercase">Tất cả người tham gia</span>
                    <span className="text-[10px] text-slate-500">{tempAllParticipants.length} người</span>
                  </div>
                  <textarea 
                    rows={6}
                    placeholder="Nguyễn Văn A,A001,0901234567&#10;Trần Thị B,B001,0912345678&#10;Lê Văn C,C001,0923456789"
                    value={tempAllParticipants.map(p => `${p.name},${p.id},${p.phone}`).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(l => l.trim());
                      const newList = lines.map(line => {
                        const [name, id, phone] = line.split(',').map(s => s.trim());
                        return { name: name || 'N/A', id: id || 'N/A', phone: phone || 'N/A' };
                      });
                      setTempAllParticipants(newList);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  />

                </div>
              </div>

              {/* Logo & Background */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-slate-400">Tùy chọn hiển thị</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs text-slate-500">Tiêu đề chương trình</label>
                    <input 
                      value={tempSettings.title}
                      onChange={(e) => setTempSettings({ ...tempSettings, title: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Màu chữ</label>
                    <div className="flex gap-2">
                      <input 
                        type="color"
                        value={tempSettings.titleColor}
                        onChange={(e) => setTempSettings({ ...tempSettings, titleColor: e.target.value })}
                        className="w-10 h-10 bg-transparent border-none cursor-pointer"
                      />
                      <input 
                        value={tempSettings.titleColor}
                        onChange={(e) => setTempSettings({ ...tempSettings, titleColor: e.target.value })}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Cỡ chữ (px)</label>
                    <input 
                      type="number"
                      value={tempSettings.titleSize}
                      onChange={(e) => setTempSettings({ ...tempSettings, titleSize: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs text-slate-500">Font chữ</label>
                    <select 
                      value={tempSettings.titleFont}
                      onChange={(e) => setTempSettings({ ...tempSettings, titleFont: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="Inter">Inter (Mặc định)</option>
                      <option value="'Space Grotesk'">Space Grotesk</option>
                      <option value="Outfit">Outfit</option>
                      <option value="'Playfair Display'">Playfair Display</option>
                      <option value="'JetBrains Mono'">JetBrains Mono</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs text-slate-500 flex items-center gap-2">
                      <ImageIcon size={14} /> Tải Logo (PNG/JPG)
                    </label>
                    <div className="flex gap-3">
                      <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-700 hover:border-yellow-500/50 rounded-lg px-4 py-2 text-sm text-slate-400 flex items-center justify-center gap-2 transition-all">
                        <Plus size={16} /> Chọn tệp từ thiết bị
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(e, 'logo')}
                        />
                      </label>
                      {tempSettings.logoUrl && (
                        <button 
                          onClick={() => setTempSettings({ ...tempSettings, logoUrl: logoDefault })}
                          className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 flex items-center gap-2">
                      <Maximize size={14} /> Kích thước Logo (px)
                    </label>
                    <input 
                      type="number"
                      value={tempSettings.logoSize}
                      onChange={(e) => setTempSettings({ ...tempSettings, logoSize: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs text-slate-500 flex items-center gap-2">
                      <ImageIcon size={14} /> Tải Hình nền
                    </label>
                    <div className="flex gap-3">
                      <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-700 hover:border-yellow-500/50 rounded-lg px-4 py-2 text-sm text-slate-400 flex items-center justify-center gap-2 transition-all">
                        <Plus size={16} /> Chọn tệp từ thiết bị
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(e, 'bg')}
                        />
                      </label>
                      {tempSettings.bgUrl && (
                        <button 
                          onClick={() => setTempSettings({ ...tempSettings, bgUrl: heroDefault })}
                          className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Spin Duration */}
              <div className="space-y-3 pt-6 border-t border-slate-800">
                <label className="text-sm font-medium text-slate-400">Thời gian quay (giây)</label>
                <input 
                  type="number" 
                  value={tempSettings.spinDuration / 1000}
                  onChange={(e) => setTempSettings({ ...tempSettings, spinDuration: Number(e.target.value) * 1000 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              {/* Prize Config */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-400">Cấu hình giải thưởng</label>
                </div>
                <div className="space-y-3">
                  {tempPrizes.map((prize, idx) => (
                    <div key={prize.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-wrap gap-4 items-end">
                      <div className="flex-1 min-w-[180px] space-y-2">
                        <label className="text-xs text-slate-500">Tên giải</label>
                        <input 
                          value={prize.name}
                          onChange={(e) => {
                            const newPrizes = [...tempPrizes];
                            newPrizes[idx].name = e.target.value;
                            setTempPrizes(newPrizes);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="w-20 space-y-2 flex-shrink-0">
                        <label className="text-xs text-slate-500">Màu</label>
                        <input 
                          type="color"
                          value={prize.color || '#eab308'}
                          onChange={(e) => {
                            const newPrizes = [...tempPrizes];
                            newPrizes[idx].color = e.target.value;
                            setTempPrizes(newPrizes);
                          }}
                          className="w-full h-9 bg-transparent border-none cursor-pointer"
                        />
                      </div>
                      <div className="w-24 space-y-2 flex-shrink-0">
                        <label className="text-xs text-slate-500">Số lượng</label>
                        <input 
                          type="number"
                          value={prize.quantity}
                          onChange={(e) => {
                            const newPrizes = [...tempPrizes];
                            const val = Number(e.target.value);
                            newPrizes[idx].quantity = val;
                            newPrizes[idx].remaining = Math.max(0, val - winners.filter(w => w.prizeId === prize.id).length);
                            setTempPrizes(newPrizes);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="w-24 space-y-2 flex-shrink-0 ml-8">
                        <label className="text-xs text-slate-500">Còn lại</label>
                        <input 
                          type="number"
                          value={prize.remaining}
                          readOnly
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          setConfirmDialog({
                            message: `Bạn có chắc chắn muốn xóa ${prize.name}?`,
                            onConfirm: () => {
                              setTempPrizes(tempPrizes.filter(p => p.id !== prize.id));
                              setConfirmDialog(null);
                            }
                          });
                        }}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => {
                      const id = String.fromCharCode(65 + tempPrizes.length);
                      setTempPrizes([...tempPrizes, { id, name: `Giải ${id}`, quantity: 1, remaining: 1, list: [], color: '#eab308' }]);
                    }}
                    className="w-full py-3 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={18} /> Thêm giải thưởng
                  </button>
                </div>
              </div>

              {/* Data Management */}
              <div className="pt-6 border-t border-slate-800 flex gap-4">
                <button 
                  onClick={resetWinners}
                  className="flex-1 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} /> Reset kết quả
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Winners Modal */}
      {showWinners && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full"
          >
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-transparent">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-2xl text-yellow-500">
                  <ListChecks size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Danh sách trúng giải</h2>
                  <p className="text-slate-400">Tổng cộng {winners.length} người may mắn</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input 
                    type="text"
                    placeholder="Tìm tên, GEN hoặc SĐT..."
                    value={winnerSearchQuery}
                    onChange={(e) => setWinnerSearchQuery(e.target.value)}
                    className="w-80 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all text-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  {winners.length > 0 && (
                    <button 
                      onClick={handleDownloadWinners}
                      className="p-4 hover:bg-white/10 rounded-2xl transition-all text-white/70 hover:text-white bg-white/5 border border-white/10"
                      title="Tải xuống danh sách (CSV)"
                    >
                      <Download size={24} />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setShowWinners(false);
                      setWinnerSearchQuery('');
                    }} 
                    className="p-4 hover:bg-red-500/20 rounded-2xl transition-all text-white/70 hover:text-red-500 bg-white/5 border border-white/10"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto p-8 bg-transparent">
              {winners.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-6">
                  <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center">
                    <Users size={48} className="opacity-20" />
                  </div>
                  <p className="text-2xl font-medium">Chưa có kết quả quay số</p>
                </div>
              ) : (
                <div className="flex h-full gap-8 min-w-max pb-4">
                  {prizes.map(prize => {
                    const prizeWinners = winners.filter(w => {
                      if (w.prizeId !== prize.id) return false;
                      if (!winnerSearchQuery.trim()) return true;
                      const query = winnerSearchQuery.toLowerCase();
                      return (
                        w.person.name.toLowerCase().includes(query) ||
                        w.person.id.toLowerCase().includes(query) ||
                        w.person.phone.includes(query)
                      );
                    });
                    if (prizeWinners.length === 0) return null;
                    return (
                      <div 
                        key={prize.id} 
                        className={cn(
                          "flex flex-col h-full bg-slate-900/40 rounded-[40px] border border-white/10 overflow-hidden shadow-2xl backdrop-blur-md transition-all duration-500",
                          prizeWinners.length > 12 ? "w-[900px]" : prizeWinners.length > 6 ? "w-[650px]" : "w-[350px]"
                        )}
                      >
                        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-end">
                          <div>
                            <h3 className="text-2xl font-black" style={{ color: prize.color || '#eab308' }}>{prize.name}</h3>
                            <p className="text-slate-400 font-medium mt-0.5 uppercase tracking-widest text-[10px]">Danh sách trúng giải</p>
                          </div>
                          <div className="text-xl font-mono font-bold text-white/20">
                            {prizeWinners.length.toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div className={cn(
                          "flex-1 overflow-y-auto p-4 custom-scrollbar grid gap-3 content-start",
                          prizeWinners.length > 12 ? "grid-cols-3" : prizeWinners.length > 6 ? "grid-cols-2" : "grid-cols-1"
                        )}>
                          {prizeWinners.map((w, i) => (
                            <motion.div 
                              key={i}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.03 }}
                              className="bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-2xl border border-white/5 flex flex-col gap-2 group"
                            >
                              <div className="text-lg font-black text-white group-hover:text-yellow-400 transition-colors mb-1">
                                {w.person.name}
                              </div>
                              <div className="flex items-center flex-wrap gap-x-3 gap-y-2 text-[11px] text-slate-400 font-medium">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-600 uppercase font-bold">GEN:</span>
                                  <span className="font-mono text-yellow-500/80">{w.person.id}</span>
                                </div>
                                <div className="w-1 h-1 bg-slate-700 rounded-full" />
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-600 uppercase font-bold">SĐT:</span>
                                  <span>{w.person.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1***$3')}</span>
                                </div>
                                <div className="w-1 h-1 bg-slate-700 rounded-full" />
                                <div className="flex items-center gap-2">
                                  <div className="px-2 py-0.5 bg-white/5 rounded-md text-[9px] font-mono text-slate-500">
                                    #{i + 1}
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteWinner(w.prizeId, w.person.id)}
                                    className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-all opacity-0 group-hover:opacity-100"
                                    title="Xóa người này"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && passwordModalType === 'delete' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 shadow-2xl p-8 space-y-6"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500">
                  <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold">Xác nhận mật khẩu</h2>
                <p className="text-slate-400 text-sm">Vui lòng nhập mật khẩu để thực hiện thao tác này</p>
              </div>

              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handlePasswordSubmit();
                }}
                placeholder="Nhập mật khẩu..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-white"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordInput('');
                    setDeleteWinnerTarget(null);
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-white rounded-xl font-bold transition-all"
                >
                  Xác nhận
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showPasswordModal && passwordModalType === 'admin' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 shadow-2xl p-8 space-y-6"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                  <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold">Nhập mật khẩu Admin</h2>
                <p className="text-slate-400 text-sm">Danh sách người tham gia sẽ là người có cơ hội đạt giải</p>
              </div>

              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handlePasswordSubmit();
                }}
                placeholder="Nhập mật khẩu..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setAdminPasswordInput('');
                    setPasswordModalType(null);
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold transition-all"
                >
                  Xác nhận
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Participants Modal */}
      {showParticipants && adminPasswordVerified && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full"
          >
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-transparent">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                  <Users size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Danh sách người tham gia</h2>
                  <p className="text-slate-400">Tổng cộng {prizes.reduce((sum, p) => sum + p.list.length, 0)} người</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowParticipants(false);
                  setParticipantSearchQuery('');
                }} 
                className="p-4 hover:bg-white/10 rounded-2xl transition-all text-white/70 hover:text-white bg-white/5 border border-white/10"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-x-auto p-8 bg-transparent">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Danh sách người tham gia theo giải (CSV: Tên,GEN,SĐT)</h3>
                <div className="space-y-6">
                  {prizes.map((prize, idx) => (
                    <div key={prize.id} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                      <div className="mb-4 pb-4 border-b border-slate-700">
                        <h4 className="text-lg font-bold" style={{ color: prize.color || '#eab308' }}>
                          {prize.name}
                        </h4>
                        <p className="text-xs text-slate-400">{prize.list.length} người</p>
                      </div>
                      
                      <textarea 
                        rows={4}
                        placeholder="Nguyễn Văn A,A001,0901234567"
                        defaultValue={prize.list.map(p => `${p.name},${p.id},${p.phone}`).join('\n')}
                        onBlur={(e) => {
                          const lines = e.target.value.split('\n').filter(l => l.trim());
                          const newList = lines.map(line => {
                            const [name, id, phone] = line.split(',').map(s => s.trim());
                            return { name: name || 'N/A', id: id || 'N/A', phone: phone || 'N/A' };
                          });
                          const newPrizes = [...prizes];
                          newPrizes[idx].list = newList;
                          setPrizes(newPrizes);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {prizes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-6">
                  <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center">
                    <Users size={48} className="opacity-20" />
                  </div>
                  <p className="text-2xl font-medium">Chưa có danh sách người tham gia</p>
                </div>
              ) : (
                <div className="flex h-full gap-8 min-w-max pb-4">
                  {prizes.map(prize => (
                    <div key={prize.id} className="bg-slate-800/30 rounded-2xl p-6 min-w-[400px] border border-slate-700/50 flex flex-col">
                      <div className="mb-4 pb-4 border-b border-slate-700">
                        <h3 className="text-lg font-bold" style={{ color: prize.color || '#eab308' }}>
                          {prize.name}
                        </h3>
                        <p className="text-xs text-slate-400">{prize.list.length} người tham gia</p>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-2">
                        {prize.list.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">Không có người tham gia</p>
                        ) : (
                          prize.list.map(person => (
                            <div key={person.id} className="p-3 bg-slate-900/50 rounded-lg text-xs border border-slate-700/50 hover:border-slate-600 transition-colors">
                              <div className="font-semibold text-white">{person.name}</div>
                              <div className="text-slate-400">{person.id} | {person.phone}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 shadow-2xl p-8 space-y-6"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                  <AlertCircle size={32} />
                </div>
                <h2 className="text-xl font-bold">Xác nhận xóa</h2>
                <p className="text-slate-400 text-sm">{confirmDialog.message}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl font-bold transition-all"
                >
                  Xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-[110] px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[300px]"
            style={{
              backgroundColor: notification.type === 'success' ? '#064e3b' : notification.type === 'error' ? '#450a0a' : '#0f172a',
              borderColor: notification.type === 'success' ? '#059669' : notification.type === 'error' ? '#dc2626' : '#1e293b',
              color: notification.type === 'success' ? '#34d399' : notification.type === 'error' ? '#f87171' : '#94a3b8'
            }}
          >
            {notification.type === 'success' && <CheckCircle2 size={20} />}
            {notification.type === 'error' && <AlertCircle size={20} />}
            {notification.type === 'info' && <Info size={20} />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
