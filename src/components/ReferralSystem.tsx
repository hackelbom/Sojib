import { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Copy, Share2, Users, Gift, Star, CheckCircle, Award } from 'lucide-react';

interface ReferralSystemProps {
  currentUser: User | null;
  settings: SystemSettings;
}

export function ReferralSystem({ currentUser, settings }: ReferralSystemProps) {
  const [copied, setCopied] = useState(false);
  const [referralsList, setReferralsList] = useState<any[]>([]);
  const [loadingRef, setLoadingRef] = useState(false);

  // Generate Referral App Link
  const refCode = currentUser?.referralCode || 'guest';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://t.me/ViralVideoBot/app';
  const referralLink = `${currentOrigin}?ref=${refCode}`;

  useEffect(() => {
    if (!currentUser) return;

    const fetchReferralDocs = async () => {
      setLoadingRef(true);
      try {
        const q = query(
          collection(db, 'referrals'),
          where('referrerId', '==', currentUser.id)
        );
        const snap = await getDocs(q);
        const list: any[] = [];
        
        // We can query user details of referred users
        const referredIds: string[] = [];
        snap.forEach(doc => {
          referredIds.push(doc.data().referredId);
        });

        if (referredIds.length > 0) {
          // Fetch referred user's names in bulk
          const usersQ = query(collection(db, 'users'), where('__name__', 'in', referredIds.slice(0, 10)));
          const usersSnap = await getDocs(usersQ);
          usersSnap.forEach(userDoc => {
            list.push({
              id: userDoc.id,
              displayName: userDoc.data().displayName || 'Telegram User',
              points: userDoc.data().points || 0,
              createdAt: userDoc.data().createdAt
            });
          });
        }
        setReferralsList(list);
      } catch (e) {
        console.error("Error fetching referrals metadata:", e);
      } finally {
        setLoadingRef(false);
      }
    };

    fetchReferralDocs();
  }, [currentUser]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareSystem = () => {
    const shareText = `🔥 Watch viral premium videos and earn points instantly on Telegram! Use my link to join and get $+ ${settings.joinBonus} points bonus: ${referralLink}`;
    if (navigator.share) {
      navigator.share({
        title: 'Join Viral Sharing Video App',
        text: shareText,
        url: referralLink,
      }).catch(err => console.log(err));
    } else {
      // Direct redirect URL sharing fallback or custom TG dialog link
      const encodedText = encodeURIComponent(shareText);
      const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodedText}`;
      window.open(telegramShareUrl, '_blank');
    }
  };

  return (
    <div className="w-full pb-20 px-4 animate-fade-in" id="referral-system-section">
      {/* Aesthetic Banner */}
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="relative mb-3">
          <div className="absolute inset-0 bg-yellow-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
          <div className="bg-[#111111] border border-yellow-500/30 p-4 rounded-3xl relative">
            <Users className="w-10 h-10 text-yellow-400" />
          </div>
        </div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">Referral & Rewards</h2>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm">
          Invite friends to unlock premium sharing links. Get rewarded instantly when they sign up!
        </p>
      </div>

      {/* Rewards details panels */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-start gap-2.5">
          <Gift className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] uppercase font-bold text-neutral-500">Join Bonus</span>
            <span className="text-base font-black text-white block mt-0.5">+{settings.joinBonus} Points</span>
            <p className="text-[9px] text-neutral-400 leading-normal mt-0.5">For new users joining via invite</p>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-start gap-2.5">
          <Award className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] uppercase font-bold text-neutral-500">Referral Reward</span>
            <span className="text-base font-black text-white block mt-0.5">+{settings.referralReward} Points</span>
            <p className="text-[9px] text-neutral-400 leading-normal mt-0.5">When your invited friend signs up</p>
          </div>
        </div>
      </div>

      {/* Referral Link Copy and Share Widget */}
      <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 mb-6 relative">
        <h3 className="text-sm font-bold text-white mb-3">Your Unique Referral Link</h3>
        
        <div className="flex gap-2 mb-4 bg-black p-2 rounded-xl border border-neutral-800 items-center">
          <span className="text-xs text-neutral-400 truncate grow px-1 font-mono">
            {referralLink}
          </span>
          <button
            id="btn-copy-ref-link"
            onClick={handleCopyLink}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg hover:text-white transition shrink-0"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex gap-2.5">
          <button
            id="btn-share-ref"
            onClick={handleShareSystem}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-black py-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(255,165,0,0.15)]"
          >
            <Share2 className="w-4 h-4" />
            Share With Friends (Telegram)
          </button>
          
          <button
            id="btn-copy-action-alt"
            onClick={handleCopyLink}
            className="px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 font-bold py-3 rounded-xl transition text-xs"
          >
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* Total Referred list overview */}
      <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Total Invited Friends</span>
          <span className="text-sm font-extrabold text-amber-500 bg-amber-500/10 px-3 py-0.5 rounded-full border border-amber-500/20">
            {currentUser?.referralCount || 0} Members
          </span>
        </div>

        {loadingRef ? (
          <p className="text-center py-6 text-xs text-neutral-400">Loading referral list...</p>
        ) : referralsList.length === 0 ? (
          <div className="text-center py-6 text-xs text-neutral-500 font-medium">
            No referral users joined yet. Direct share your invitation links!
          </div>
        ) : (
          <div className="space-y-3">
            {referralsList.map((user, index) => (
              <div key={user.id || index} className="flex items-center justify-between text-xs py-1 border-b border-neutral-900">
                <span className="text-white font-medium">{user.displayName}</span>
                <span className="text-neutral-500 font-mono text-[10px]">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active Member'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
