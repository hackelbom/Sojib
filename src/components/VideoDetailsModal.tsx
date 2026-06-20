import { useState, useEffect } from 'react';
import { Video, User } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, getDoc, increment } from 'firebase/firestore';
import { X, Lock, Unlock, Eye, Heart, ExternalLink, RefreshCw, AlertCircle, PlayCircle, Clock } from 'lucide-react';

interface VideoDetailsModalProps {
  video: Video;
  currentUser: User | null;
  isUnlocked: boolean;
  onClose: () => void;
  onUnlockedSuccess: (videoId: string, updatedPoints: number) => void;
  onShare: (video: Video) => void;
}

export function VideoDetailsModal({ 
  video, 
  currentUser, 
  isUnlocked, 
  onClose, 
  onUnlockedSuccess,
  onShare
}: VideoDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);

  // Check unique view on load
  useEffect(() => {
    if (!video || !currentUser) return;

    const trackViewAndIncrement = async () => {
      const viewKey = `viewed_${currentUser.id}_${video.id}`;
      const alreadyViewed = localStorage.getItem(viewKey);
      
      if (!alreadyViewed) {
        try {
          const videoRef = doc(db, 'videos', video.id);
          await updateDoc(videoRef, {
            views: increment(1)
          });
          localStorage.setItem(viewKey, 'true');
        } catch (e) {
          console.error("View tracking failed", e);
        }
      }
    };
    trackViewAndIncrement();
  }, [video, currentUser]);

  // Handle countdown for unlocked premium videos
  useEffect(() => {
    if (!isUnlocked || !video.isLocked || !currentUser) return;

    const fetchTimer = async () => {
      try {
        const unlockRef = doc(db, 'unlockedVideos', `${currentUser.id}_${video.id}`);
        const snap = await getDoc(unlockRef);
        if (snap.exists()) {
          const expiresAtStr = snap.data().expiresAt;
          const expiryTime = new Date(expiresAtStr).getTime();
          
          const interval = setInterval(() => {
            const now = new Date().getTime();
            const diff = expiryTime - now;
            
            if (diff <= 0) {
              clearInterval(interval);
              setTimeRemaining('EXPIRED');
              setSecondsLeft(0);
              // Trigger reload or close
            } else {
              const mins = Math.floor(diff / 60000);
              const secs = Math.floor((diff % 60000) / 1000);
              setTimeRemaining(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
              setSecondsLeft(Math.floor(diff / 1000));
            }
          }, 1000);

          return () => clearInterval(interval);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchTimer();
  }, [isUnlocked, video, currentUser]);

  const handleUnlock = async () => {
    if (!currentUser) {
      setError('Please sign in to unlock this video.');
      return;
    }

    if (currentUser.points < video.requiredPoints) {
      setError(`Insufficient points. You need ${video.requiredPoints - currentUser.points} more points.`);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const userId = currentUser.id;
      const videoId = video.id;
      const pointsToDeduct = video.requiredPoints;
      
      // Calculate remaining points
      const remainingPoints = currentUser.points - pointsToDeduct;

      // 1. Deduct points in Firestore for the user
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        points: remainingPoints
      });

      // 2. Create lock expiration tracker
      const unlockDurationMins = video.reLockDurationMinutes || 10;
      const unlockedAt = new Date();
      const expiresAt = new Date(unlockedAt.getTime() + unlockDurationMins * 60 * 1000);

      const unlockRef = doc(db, 'unlockedVideos', `${userId}_${videoId}`);
      await setDoc(unlockRef, {
        userId,
        videoId,
        unlockedAt: unlockedAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      // 3. Create Point History log entry
      const historyRef = doc(db, 'pointHistory', `${userId}_unlock_${Date.now()}`);
      await setDoc(historyRef, {
        userId,
        type: 'spend_unlock',
        points: -pointsToDeduct,
        description: `Unlocked premium video: "${video.title}"`,
        createdAt: unlockedAt.toISOString()
      });

      setSuccess('Video successfully unlocked!');
      onUnlockedSuccess(videoId, remainingPoints);

      // Auto-open external URL linked by administrator
      if (video.externalUnlockLink) {
        setTimeout(() => {
          window.open(video.externalUnlockLink, '_blank', 'noreferrer,noopener');
        }, 1500);
      }
    } catch (e: any) {
      setError(e.message || 'Unlock failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (liked) return;
    try {
      const videoRef = doc(db, 'videos', video.id);
      await updateDoc(videoRef, {
        likes: increment(1)
      });
      setLiked(true);
      setLikeCount(prev => prev + 1);
    } catch (e) {
      console.error(e);
    }
  };

  // Convert points to percentage for progress metrics
  const totalPointsNeeded = video.requiredPoints;
  const userCurrentPoints = currentUser?.points || 0;
  const progressPercent = Math.min(100, Math.round((userCurrentPoints / totalPointsNeeded) * 100));

  const totalCountdownSeconds = (video.reLockDurationMinutes || 10) * 60;
  const countdownProgressPercent = Math.min(100, Math.round((secondsLeft / totalCountdownSeconds) * 100));

  return (
    <div id="video-details-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div 
        id="video-details-container"
        className="w-full max-w-lg bg-[#111111] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative my-8"
      >
        {/* Top Header Controls */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <button 
            id="close-details-btn"
            onClick={onClose}
            className="p-2 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-all border border-neutral-700/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas or Thumbnail lock */}
        <div className="relative aspect-video w-full bg-black">
          {(!video.isLocked || isUnlocked) && timeRemaining !== 'EXPIRED' ? (
            // Full Video Player Area
            <div className="w-full h-full relative group">
              {video.videoUrl.includes('youtube.com') || video.videoUrl.includes('youtu.be') ? (
                <iframe 
                  id="youtube-player"
                  src={video.videoUrl.replace('watch?v=', 'embed/')} 
                  title={video.title} 
                  className="w-full h-full outline-hidden border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                ></iframe>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
                  <PlayCircle className="w-16 h-16 text-amber-500 mb-2 animate-pulse cursor-pointer" />
                  <p className="text-white font-semibold text-sm mb-1">Direct External Media File</p>
                  <a 
                    href={video.videoUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    id="video-url-launch"
                    className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Open Content Link
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            // Thumbnail with Lock Indicator Overlay
            <div className="relative w-full h-full">
              <img 
                src={video.thumbnailUrl || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60"} 
                alt={video.title}
                className="w-full h-full object-cover brightness-50"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <div className="bg-amber-500 text-black p-3.5 rounded-full shadow-lg shadow-amber-500/30 mb-3 animate-bounce">
                  <Lock className="w-6 h-6 fill-black" />
                </div>
                <p className="text-amber-400 font-black tracking-wider uppercase text-xs mb-1">PREMIUM CONTENT LOCKED</p>
                <p className="text-neutral-300 text-xs text-center max-w-xs leading-normal">
                  Unlock this content using your points to view and access premium purchase links.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info & Core Body Grid */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {/* Categories & Stats Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              {video.category || 'General'}
            </span>
            
            <div className="flex items-center gap-4 text-xs font-semibold text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-neutral-500" />
                {video.views} Views
              </span>
              <button 
                id="like-action-btn"
                onClick={handleLike}
                disabled={liked}
                className={`flex items-center gap-1.5 transition-colors ${liked ? 'text-rose-500' : 'text-neutral-400 hover:text-white'}`}
              >
                <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500' : ''}`} />
                {likeCount} Likes
              </button>
              <span className="text-zinc-500 font-mono">
                {video.duration}
              </span>
            </div>
          </div>

          <h2 className="text-lg font-extrabold text-white leading-snug tracking-tight mb-4">
            {video.title}
          </h2>

          {/* Action alerts */}
          {error && (
            <div className="p-3.5 mb-4 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 mb-4 bg-green-950/40 border border-green-500/30 rounded-xl flex items-start gap-2 text-green-300 text-xs">
              <Unlock className="w-4 h-4 shrink-0 mt-0.5 text-green-400 fill-green-400/20" />
              <span>{success}</span>
            </div>
          )}

          {/* Locked vs. Unlocked Unlock System Panel */}
          {video.isLocked ? (
            <div className="border border-neutral-800 rounded-2xl p-4 bg-black/40 mb-4">
              {!isUnlocked || timeRemaining === 'EXPIRED' ? (
                // Unlock Requirements Screen
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">Unlock Requirements</h3>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                    <div className="bg-[#111111] p-2.5 rounded-xl border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-semibold">Need Points</span>
                      <span className="text-base font-black text-amber-500">{video.requiredPoints}</span>
                    </div>
                    <div className="bg-[#111111] p-2.5 rounded-xl border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-semibold">Your Balance</span>
                      <span className="text-base font-black text-white">{currentUser?.points || 0}</span>
                    </div>
                    <div className="bg-[#111111] p-2.5 rounded-xl border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block font-semibold">Remaining</span>
                      <span className={`text-base font-black ${currentUser && currentUser.points >= video.requiredPoints ? 'text-green-400' : 'text-neutral-500'}`}>
                        {currentUser ? Math.max(0, currentUser.points - video.requiredPoints) : 0}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar & Status label */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-[11px] font-bold mb-1">
                      <span className="text-neutral-400">Point unlock metrics</span>
                      <span className="text-amber-500">{progressPercent}% Ready</span>
                    </div>
                    <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${progressPercent >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <button
                    id="trigger-unlock-action"
                    onClick={handleUnlock}
                    disabled={loading || !currentUser || currentUser.points < video.requiredPoints}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-black py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-[0_4px_12px_rgba(245,158,11,0.25)]"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Unlocking...
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        Unlock Video with {video.requiredPoints} Points
                      </>
                    )}
                  </button>
                  {!currentUser && (
                    <p className="text-[10px] text-neutral-500 text-center mt-2 font-medium">
                      Note: You must log in or open the TG applet to earn points.
                    </p>
                  )}
                </div>
              ) : (
                // Active Unlock State / Access countdown + Admin Link Launcher
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-400">Access Expiry Timer</span>
                    </div>
                    <span className="font-mono text-sm font-black text-rose-400 px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-md">
                      {timeRemaining || 'Loading...'}
                    </span>
                  </div>

                  {/* Countdown Progress bar */}
                  <div className="mb-4">
                    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                        style={{ width: `${countdownProgressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Direct Secret Link configuration */}
                  {video.externalUnlockLink && (
                    <div className="mt-4 p-3.5 bg-neutral-900 border border-amber-500/20 rounded-xl flex flex-col justify-between items-start gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-white mb-0.5">Admin Premium Content Link</h4>
                        <p className="text-[11px] text-neutral-400 leading-normal">
                          This specialized purchase and sharing destination has been enabled for you by the admin.
                        </p>
                      </div>
                      <a
                        id="external-purchase-link"
                        href={video.externalUnlockLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full text-center bg-green-500 hover:bg-green-600 text-black font-extrabold text-xs py-2.5 px-4 rounded-lg transition-all duration-150 flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(34,197,94,0.2)]"
                      >
                        Visit Premium Source Link
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* Tutorial description or context */}
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 mt-2">
            <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-widest mb-1.5">App Instructions</h4>
            <ul className="text-[11px] text-neutral-400 space-y-1 list-disc list-inside">
              <li>Earn free points by viewing ads under the points tab.</li>
              <li>Spend points to view premium locked videos from the feed.</li>
              <li>Unlock expires after {video.reLockDurationMinutes || 10} minutes. Afterwards, you can unlock again.</li>
              <li>Share viral links with friends to earn generous bonus levels!</li>
            </ul>
          </div>
        </div>

        {/* Global Action Footer */}
        <div className="p-4 border-t border-neutral-800/60 bg-black/40 flex gap-2">
          <button 
            id="share-details-btn"
            onClick={() => onShare(video)}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5"
          >
            Share Video link
          </button>
          <button 
            id="back-feed-btn"
            onClick={onClose}
            className="px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white font-semibold text-xs py-2.5 rounded-xl transition-all duration-150"
          >
            Back to Feed
          </button>
        </div>
      </div>
    </div>
  );
}
