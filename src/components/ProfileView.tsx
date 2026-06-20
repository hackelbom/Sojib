import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Coins, UserCheck, Star, Sparkles, BookOpen, ChevronRight, Award, LogOut, Check, Shield } from 'lucide-react';

interface ProfileViewProps {
  currentUser: User | null;
  onLogout: () => void;
  onAdminGranted?: () => void;
}

export function ProfileView({ currentUser, onLogout, onAdminGranted }: ProfileViewProps) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({
    earnedFromAds: 0,
    spentOnUnlocks: 0,
    earnedFromReferrals: 0
  });

  useEffect(() => {
    if (!currentUser) return;

    const fetchHistoryStats = async () => {
      try {
        const q = query(collection(db, 'pointHistory'), where('userId', '==', currentUser.id));
        const snap = await getDocs(q);
        
        let adsTotal = 0;
        let spendTotal = 0;
        let refTotal = 0;

        snap.forEach(doc => {
          const data = doc.data();
          if (data.type === 'earn_ad') {
            adsTotal += data.points;
          } else if (data.type === 'spend_unlock') {
            spendTotal += Math.abs(data.points);
          } else if (data.type === 'referral_bonus') {
            refTotal += data.points;
          }
        });

        setStats({
          earnedFromAds: adsTotal,
          spentOnUnlocks: spendTotal,
          earnedFromReferrals: refTotal
        });
      } catch (e) {
        console.error("Error reading points summary logs:", e);
      }
    };
    fetchHistoryStats();
  }, [currentUser]);

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAdminError('');
    setAdminSuccess('');
    setIsSubmitting(true);

    const cleanPasscode = adminPasscode.trim();

    // Check if the provided passcode is valid or matches token segments/patterns
    const isValid = 
      cleanPasscode === '8539908033:AAG90fGrLbi2KdM9qDU4xq4u482nK-3ZwMs' || 
      cleanPasscode === 'admin123' || 
      cleanPasscode === '8539908033';

    if (isValid) {
      try {
        const userDocRef = doc(db, 'users', currentUser.id);
        await updateDoc(userDocRef, { isAdmin: true });
        setAdminSuccess('Congratulations! Admin privileges granted successfully. Switch to the bottom ADMIN tab.');
        setAdminPasscode('');
        if (onAdminGranted) {
          onAdminGranted();
        }
      } catch (err: any) {
        console.error(err);
        setAdminError(`Database write failure: ${err.message || 'Verification Error'}`);
      }
    } else {
      setAdminError('Incorrect passcode or Telegram Bot Token. Please verify and try again.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full pb-20 px-4 animate-fade-in" id="profile-view-section">
      {/* Visual Avatar Card layout */}
      <div className="bg-gradient-to-r from-[#111111] to-neutral-900 border border-neutral-800 rounded-3xl p-6 mb-6 shadow-xl relative overflow-hidden flex items-center gap-4 mt-4">
        <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center text-black text-2xl font-black shrink-0 relative shadow-[0_0_15px_rgba(255,165,0,0.2)]">
          {currentUser?.displayName?.slice(0, 1).toUpperCase() || 'U'}
          <div className="absolute -bottom-1 -right-1 bg-neutral-950 p-1 border border-neutral-800 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
          </div>
        </div>
        
        <div className="overflow-hidden grow">
          <h3 className="text-base font-extrabold text-white truncate leading-snug">
            {currentUser?.displayName || 'Telegram Visitor'}
          </h3>
          <p className="text-zinc-500 text-xs font-semibold leading-none mt-1">
            @{currentUser?.username || 'guest_user'}
          </p>
          {currentUser?.isAdmin && (
            <span className="inline-block mt-2 bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
              ADMIN MODE ACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Points Ledger</span>
          </div>
          <span className="text-xl font-black text-white">{currentUser?.points || 0}</span>
          <span className="text-zinc-500 text-[10px] block font-semibold mt-0.5">Accrued credit</span>
        </div>

        <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
            <UserCheck className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Referrals</span>
          </div>
          <span className="text-xl font-black text-white">{currentUser?.referralCount || 0}</span>
          <span className="text-zinc-500 text-[10px] block font-semibold mt-0.5">Referred members</span>
        </div>
      </div>

      {/* Reward Summary ledger section */}
      <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 mb-6">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3.5 border-b border-neutral-850 pb-2">
          Reward Summary Breakdown
        </h3>

        <div className="space-y-3.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400 font-medium">Earned from Sponsor Ads</span>
            <span className="text-green-400 font-extrabold font-mono hover:underline cursor-help">
              +{stats.earnedFromAds} pts
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400 font-medium">Earned from Referrals</span>
            <span className="text-green-400 font-extrabold font-mono hover:underline cursor-help">
              +{stats.earnedFromReferrals} pts
            </span>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-neutral-900 pt-3.5">
            <span className="text-neutral-400 font-medium font-semibold">Spent unlocking Videos</span>
            <span className="text-red-400 font-extrabold font-mono">
              -{stats.spentOnUnlocks} pts
            </span>
          </div>
        </div>
      </div>

      {/* Admin Authentication Login card */}
      <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 mb-6" id="admin-login-module">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-2 border-b border-neutral-850 pb-2">
          <Shield className="w-4 h-4 text-amber-500" />
          Admin Portal Authentication
        </h3>

        {!currentUser?.isAdmin ? (
          <form onSubmit={handleAdminVerify} className="space-y-3">
            <p className="text-[11px] text-zinc-400 leading-normal font-medium">
              To login to the Admin Panel, please enter your Telegram Bot Token or Admin secret passcode below:
            </p>
            
            <div className="space-y-1">
              <input 
                type="password"
                placeholder="Telegram Bot Token or Admin Code..."
                value={adminPasscode}
                onChange={(e) => {
                  setAdminPasscode(e.target.value);
                  setAdminError('');
                  setAdminSuccess('');
                }}
                className="w-full bg-black border border-neutral-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white outline-hidden placeholder-neutral-600 transition text-left"
                required
              />
            </div>

            {adminError && <p className="text-[10px] text-red-550 text-red-400 font-bold leading-normal">{adminError}</p>}
            {adminSuccess && <p className="text-[10px] text-green-400 font-bold leading-normal">{adminSuccess}</p>}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-black font-extrabold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(245,158,11,0.15)] cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              {isSubmitting ? 'Verifying Credentials...' : 'Authenticate Admin Access'}
            </button>
          </form>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-green-400 font-extrabold bg-green-500/5 border border-green-500/20 p-3 rounded-xl justify-start">
              <Check className="w-4 h-4 shrink-0" />
              <span>You are authenticated as an Administrator!</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-normal">
              You can now access video databases, user accounts, system banners, and reward variables via the <b>Admin</b> tab in the bottom navigation.
            </p>
          </div>
        )}
      </div>

      {/* Dynamic Action menu lists */}
      <div className="space-y-2">
        <button 
          id="trigger-guide-btn"
          onClick={() => setShowTutorial(true)}
          className="w-full bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between text-left transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-white block">Platform Tutorial Guide</span>
              <span className="text-[11px] text-neutral-500">How to earn points, locks and more</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-500" />
        </button>

        {/* Optional Auth Out */}
        <button 
          id="trigger-audit-out"
          onClick={onLogout}
          className="w-full bg-[#111111] hover:bg-red-500/5 hover:border-red-500/20 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between text-left transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-white block">Reset System Account</span>
              <span className="text-[11px] text-neutral-500">Log out or reset guest profiles</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-500" />
        </button>
      </div>

      {/* Aesthetic Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative p-6">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2 tracking-tight">
              <Award className="w-5 h-5 text-amber-500" />
              How to Get Started
            </h3>

            <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-505 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-extrabold text-white mb-0.5">Earn Free Points</h4>
                  <p className="text-[11px] text-neutral-400 leading-normal">
                    Navigate to the <b>Points</b> tab and complete Sponsor Ads. Each complete watch instantly deposits rewards into your available wallet!
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-505 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-extrabold text-white mb-0.5">Unlock Premium Videos</h4>
                  <p className="text-[11px] text-neutral-400 leading-normal">
                    Browse the <b>Home Feed</b>. Spend points on locked videos to reveal the secret direct linkages provided by the content administrator.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-505 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-extrabold text-white mb-0.5">Invite Friends & Viral Gain</h4>
                  <p className="text-[11px] text-neutral-400 leading-normal">
                    Generate unique <b>Referral Links</b>. For each friend joining the mini app, earn an instant bonus while your invited friend gets rewards too.
                  </p>
                </div>
              </div>
            </div>

            <button
              id="close-tutorial-action"
              onClick={() => setShowTutorial(false)}
              className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-3 rounded-xl transition text-xs"
            >
              Understand & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
