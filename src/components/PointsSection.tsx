import { useState, useEffect } from 'react';
import { User, PointHistory, SystemSettings } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, limit, orderBy } from 'firebase/firestore';
import { Coins, Play, Trophy, HelpCircle, RefreshCw, Star, CheckCircle, Video, ListPlus } from 'lucide-react';

interface PointsSectionProps {
  currentUser: User | null;
  onPointsUpdated: (newPoints: number) => void;
  settings: SystemSettings;
}

export function PointsSection({ currentUser, onPointsUpdated, settings }: PointsSectionProps) {
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeAd, setActiveAd] = useState<{ active: boolean; secondsRemaining: number; title: string; image: string } | null>(null);
  const [adSuccess, setAdSuccess] = useState('');
  const [earning, setEarning] = useState(false);

  // Load Point History
  const fetchHistory = async () => {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'pointHistory'),
        where('userId', '==', currentUser.id),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const logs: PointHistory[] = [];
      snap.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() } as PointHistory);
      });
      setHistory(logs);
    } catch (e) {
      console.error("Error loading point history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentUser]);

  // Handle active ad countdown
  useEffect(() => {
    if (!activeAd) return;

    if (activeAd.secondsRemaining <= 0) {
      handleCompleteAd();
      return;
    }

    const timer = setTimeout(() => {
      setActiveAd(prev => prev ? { ...prev, secondsRemaining: prev.secondsRemaining - 1 } : null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeAd]);

  const mockAds = [
    { title: "TON Space Premium Wallet Coin", image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=500&auto=format&fit=crop&q=60" },
    { title: "Tap-to-Earn Crypto Miner Sim", image: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=500&auto=format&fit=crop&q=60" },
    { title: "Telegram Premium Super Sticker Packs", image: "https://images.unsplash.com/photo-1614680376739-414d95ff43df?w=500&auto=format&fit=crop&q=60" },
    { title: "Viral Mini-Game Champion Tournaments", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=60" }
  ];

  const handleStartAd = () => {
    if (!currentUser) {
      alert("Please authenticate or open the application inside Telegram.");
      return;
    }
    const idx = Math.floor(Math.random() * mockAds.length);
    const chosen = mockAds[idx];
    setAdSuccess('');
    
    // Start countdown timer
    setActiveAd({
      active: true,
      secondsRemaining: settings.adWatchTimer || 8,
      title: chosen.title,
      image: chosen.image
    });
  };

  const handleCompleteAd = async () => {
    if (!currentUser || !activeAd) return;
    setEarning(true);
    const awardPoints = settings.adWatchReward || 15;

    try {
      const now = new Date();
      const userId = currentUser.id;
      const finalPoints = currentUser.points + awardPoints;

      // 1. Commit upgraded score to Firestore
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        points: finalPoints
      });

      // 2. Log point history reference
      const historyRef = doc(db, 'pointHistory', `${userId}_ad_${Date.now()}`);
      await setDoc(historyRef, {
        userId,
        type: 'earn_ad',
        points: awardPoints,
        description: `Watched visual advertisement: "${activeAd.title}"`,
        createdAt: now.toISOString()
      });

      onPointsUpdated(finalPoints);
      setAdSuccess(`Success! You earned +${awardPoints} points.`);
      setActiveAd(null);
      fetchHistory(); // Reload historical items
    } catch (e) {
      console.error(e);
      alert("Earning points failed. Please check internet connectivity.");
      setActiveAd(null);
    } finally {
      setEarning(false);
    }
  };

  const handleCancelAd = () => {
    if (confirm("If you close this ad early, you won't earn any reward points.")) {
      setActiveAd(null);
    }
  };

  return (
    <div className="w-full pb-20 px-4 animate-fade-in" id="points-view-section">
      {/* Visual Header */}
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="relative mb-3">
          <div className="absolute inset-0 bg-amber-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
          <div className="bg-[#111111] border border-amber-500/30 p-4 rounded-3xl relative">
            <Coins className="w-10 h-10 text-amber-500" />
          </div>
        </div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">Earn Points Dashboard</h2>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm">
          Watch short advertisements, complete rewards, and unlock viral premium videos instantly.
        </p>
      </div>

      {/* User points balance bento box */}
      <div className="bg-gradient-to-br from-neutral-900 to-black border border-neutral-800 rounded-2xl p-5 mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl"></div>
        
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Available Balance</span>
          <span className="text-[10px] text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Secure wallet</span>
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-4xl font-black text-white tracking-tight">{currentUser?.points ?? 0}</span>
          <span className="text-amber-500 text-sm font-black uppercase tracking-widest">Points</span>
        </div>

        {/* Action Button - Earn Points */}
        <button
          id="btn-trigger-ad"
          onClick={handleStartAd}
          disabled={earning || activeAd?.active}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-extrabold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-[0_6px_20px_rgba(255,165,0,0.15)] hover:shadow-[0_6px_24px_rgba(255,165,0,0.25)]"
        >
          <Play className="w-4 h-4 fill-black" />
          Watch Ad & Earn {settings.adWatchReward} Points
        </button>

        {adSuccess && (
          <div className="mt-3.5 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400 text-xs font-bold animate-fade-in">
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
            <span>{adSuccess}</span>
          </div>
        )}
      </div>

      {/* Active Ad Container (Simulated Lightbox Portal) */}
      {activeAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#111111] border border-amber-500/40 rounded-3xl overflow-hidden shadow-2xl relative p-5">
            {/* Header / Countdown */}
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full animate-pulse">
                Sponsor Content
              </span>
              <div className="flex items-center gap-1">
                <span className="text-neutral-400 text-xs font-bold">Reward in:</span>
                <span className="font-mono text-xs font-black text-rose-400 bg-rose-500/10 px-2.5 py-0.5 border border-rose-500/30 rounded">
                  {activeAd.secondsRemaining}s
                </span>
              </div>
            </div>

            {/* Simulated Banner Canvas */}
            <div className="relative aspect-square w-full bg-black rounded-2xl overflow-hidden mb-4 border border-neutral-800">
              <img 
                src={activeAd.image} 
                alt="Advertisement Banner" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                <h3 className="text-sm font-extrabold text-white tracking-tight mb-1">
                  {activeAd.title}
                </h3>
                <p className="text-[10px] text-neutral-300">
                  Tap to subscribe and explore viral mini-apps in Telegram instantly!
                </p>
              </div>
            </div>

            {/* Actions progress */}
            <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden mb-5">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                style={{ width: `${((settings.adWatchTimer - activeAd.secondsRemaining) / settings.adWatchTimer) * 100}%` }}
              ></div>
            </div>

            {/* Force Skip controls */}
            <div className="flex gap-2.5">
              <button 
                id="skip-ad-btn"
                onClick={handleCancelAd}
                className="flex-1 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white font-bold py-2.5 rounded-xl text-xs transition-colors"
              >
                Close & Skip Reward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Point history list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <ListPlus className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-extrabold text-white">Point History Log</h3>
          </div>
          <button 
            id="refresh-history-btn"
            onClick={fetchHistory}
            className="p-1 px-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all text-[11px] font-bold flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </button>
        </div>

        {loadingHistory ? (
          <div className="py-12 flex justify-center text-neutral-400 text-xs font-semibold gap-1.5">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
            Recalculating ledger...
          </div>
        ) : history.length === 0 ? (
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl py-8 text-center text-neutral-500 text-xs font-medium">
            No point logs recorded yet. Watch ads or invite users to get started!
          </div>
        ) : (
          <div className="space-y-2.5 overflow-hidden">
            {history.map((log) => (
              <div 
                key={log.id} 
                className="bg-[#111111] border border-neutral-800/60 rounded-xl p-3 flex justify-between items-center hover:border-neutral-700 transition"
              >
                <div className="overflow-hidden">
                  <p className="text-xs text-white font-semibold truncate leading-tight mb-0.5">
                    {log.description}
                  </p>
                  <span className="text-[9px] text-neutral-500 font-medium">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>

                <span 
                  className={`text-xs font-black font-mono shrink-0 ml-4 px-2.5 py-0.5 rounded ${
                    log.points > 0 
                      ? 'text-green-400 bg-green-500/10 border border-green-500/20' 
                      : 'text-red-400 bg-red-500/10 border border-red-500/20'
                  }`}
                >
                  {log.points > 0 ? `+${log.points}` : log.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
