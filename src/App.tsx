import React, { useState, useEffect } from 'react';
import { db, auth, testConnection } from './firebase';
import { signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, query, getDocs, doc, getDoc, setDoc, updateDoc, increment, limit 
} from 'firebase/firestore';
import { User, Video, Notice, SystemSettings } from './types';

// Components
import { NoticeBar } from './components/NoticeBar';
import { PopupNotice } from './components/PopupNotice';
import { VideoCard } from './components/VideoCard';
import { VideoDetailsModal } from './components/VideoDetailsModal';
import { PointsSection } from './components/PointsSection';
import { ReferralSystem } from './components/ReferralSystem';
import { ProfileView } from './components/ProfileView';
import { AdminPanel } from './components/AdminPanel';

// Icons
import { Play, Coins, Users, User as UserIcon, Shield, Search, Sparkles, Flame, Grid, Tv2, Share2, Clipboard, Globe } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unlockedVideoIds, setUnlockedVideoIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    joinBonus: 20,
    referralReward: 30,
    adWatchReward: 15,
    adWatchTimer: 8
  });

  // Feeds state
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'earn' | 'referral' | 'profile' | 'admin'>('home');
  const [feedFilter, setFeedFilter] = useState<'latest' | 'trending'>('latest');

  // Interactive selectors
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharingVideo, setSharingVideo] = useState<Video | null>(null);

  // Initialize TG WebApp and Firebase connection validation
  useEffect(() => {
    // 1. Initial WebApp settings if triggered inside Telegram UI
    try {
      const WebApp = (window as any).Telegram?.WebApp;
      if (WebApp) {
        WebApp.ready();
        WebApp.expand();
        WebApp.setHeaderColor('#000000');
        WebApp.setBackgroundColor('#000000');
      }
    } catch (e) {
      console.warn("Telegram WebApp properties parsing skipped", e);
    }

    // 2. Test Firestore Connection as required
    testConnection();

    // 3. Initiate Auth listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser.uid);
      } else {
        // Automatically sign in anonymously for direct iframe previews
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Auth initialization failed", e);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch or Register user
  const fetchUserProfile = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);

      let userProfile: User;

      if (userSnap.exists()) {
        const udata = userSnap.data();
        userProfile = { 
          id: uid, 
          telegramId: udata.telegramId || uid,
          username: udata.username || '',
          displayName: udata.displayName || '',
          points: udata.points || 0,
          referralCode: udata.referralCode || '',
          referredBy: udata.referredBy || '',
          referralCount: udata.referralCount || 0,
          createdAt: udata.createdAt || '',
          updatedAt: udata.updatedAt || '',
          isAdmin: udata.isAdmin === true
        } as User;
      } else {
        // Registering a brand new User profile!
        const randNum = Math.floor(100 + Math.random() * 900);
        let tgUsername = `visitor_${randNum}`;
        let tgDisplayName = `Telegram Visitor`;

        // Check for official Telegram WebApp sandbox details
        try {
          const tgUserObj = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
          if (tgUserObj) {
            if (tgUserObj.username) tgUsername = tgUserObj.username;
            if (tgUserObj.first_name) {
              tgDisplayName = tgUserObj.first_name;
              if (tgUserObj.last_name) tgDisplayName += ` ${tgUserObj.last_name}`;
            }
          }
        } catch (e) {
          console.log("No native TG context present. Setting visitor defaults.");
        }

        // Parse referral queries (from URL: ?ref=CODE, or Telegram start parameters)
        let refCodeFromUrl = '';
        try {
          const params = new URLSearchParams(window.location.search);
          refCodeFromUrl = params.get('ref') || '';
          
          const tgStartParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
          if (tgStartParam) {
            refCodeFromUrl = tgStartParam;
          }
        } catch (e) {
          console.log(e);
        }

        // New Profile payload definitions
        const userRefCode = `video_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const startingPoints = settings.joinBonus || 20;

        userProfile = {
          id: uid,
          telegramId: uid,
          username: tgUsername,
          displayName: tgDisplayName,
          points: startingPoints,
          referralCode: userRefCode,
          referralCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isAdmin: uid === "mI6Qbyh9W3U4bK0O4Qn0M5z7p6z1" || tgUsername.toLowerCase().includes('admin') // Check for direct Admin override keys
        };

        // Handle referral link allocations
        if (refCodeFromUrl && refCodeFromUrl !== userRefCode) {
          userProfile.referredBy = refCodeFromUrl;
          await processReferral(refCodeFromUrl, uid, tgDisplayName);
        }

        // Create document in Firestore
        await setDoc(userDocRef, userProfile);

        // Register initial History Log for Join bonus
        const historyId = `join_${Date.now()}`;
        await setDoc(doc(db, 'pointHistory', `${uid}_${historyId}`), {
          userId: uid,
          type: 'referral_bonus',
          points: startingPoints,
          description: "Registered successfully! Received profile join bonus points.",
          createdAt: new Date().toISOString()
        });
      }

      setCurrentUser(userProfile);
      
      // Load unlocking assets and global feed
      await loadUserUnlocks(uid);
      await loadFeeds();
    } catch (e) {
      console.error("Error setting up user profile details", e);
    } finally {
      setLoading(false);
    }
  };

  // Logic processing referral bonus points
  const processReferral = async (refCode: string, newUserId: string, newUserDisplayName: string) => {
    try {
      const q = query(collection(db, 'users'), limit(100)); // scan users to find owner
      const snap = await getDocs(q);
      let referrerDocId = '';
      let referrerCurrentPoints = 0;

      snap.forEach((doc) => {
        if (doc.data().referralCode === refCode) {
          referrerDocId = doc.id;
          referrerCurrentPoints = doc.data().points || 0;
        }
      });

      if (referrerDocId) {
        const bonusReward = settings.referralReward || 30;
        
        // 1. Credit Referrer Points + Increment Referral Counts
        const referrerRef = doc(db, 'users', referrerDocId);
        await updateDoc(referrerRef, {
          points: increment(bonusReward),
          referralCount: increment(1)
        });

        // 2. Set log in referrer's History
        const referHistoryId = `ref_earn_${Date.now()}`;
        await setDoc(doc(db, 'pointHistory', `${referrerDocId}_${referHistoryId}`), {
          userId: referrerDocId,
          type: 'referral_bonus',
          points: bonusReward,
          description: `Referred friend registered: "${newUserDisplayName}"`,
          createdAt: new Date().toISOString()
        });

        // 3. Connect logs in unified referral tracking index
        const trackingId = `${referrerDocId}_${newUserId}`;
        await setDoc(doc(db, 'referrals', trackingId), {
          id: trackingId,
          referrerId: referrerDocId,
          referredId: newUserId,
          pointsAwarded: bonusReward,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error("Referral processing system failure", e);
    }
  };

  // Load Unlocks keys
  const loadUserUnlocks = async (uid: string) => {
    try {
      const q = query(collection(db, 'unlockedVideos'), limit(500));
      const snap = await getDocs(q);
      const unlockedIds: string[] = [];
      
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.userId === uid) {
          const expiresTime = new Date(data.expiresAt).getTime();
          const nowTime = new Date().getTime();
          if (expiresTime > nowTime) {
            unlockedIds.push(data.videoId);
          }
        }
      });

      setUnlockedVideoIds(unlockedIds);
    } catch (e) {
      console.error(e);
    }
  };

  // Load global video and notices system with automated seeder is empty
  const loadFeeds = async () => {
    try {
      // 1. Get System Settings Config
      const setSnap = await getDoc(doc(db, 'system', 'settings'));
      if (setSnap.exists()) {
        setSettings({
          joinBonus: setSnap.data().joinBonus ?? 20,
          referralReward: setSnap.data().referralReward ?? 30,
          adWatchReward: setSnap.data().adWatchReward ?? 15,
          adWatchTimer: setSnap.data().adWatchTimer ?? 8
        });
      }

      // 2. Get notices
      const noticesSnap = await getDocs(collection(db, 'notices'));
      const activeNotices: Notice[] = [];
      noticesSnap.forEach(d => {
        activeNotices.push({ id: d.id, ...d.data() } as Notice);
      });

      // 3. Get videos
      const videosSnap = await getDocs(collection(db, 'videos'));
      const activeVideos: Video[] = [];
      videosSnap.forEach(d => {
        activeVideos.push({ id: d.id, ...d.data() } as Video);
      });

      // Seeding initial contents if database has completely fresh launch
      if (activeVideos.length === 0) {
        console.log("Seeding starting templates...");
        await seedDefaultContents();
        return; // Seed will trigger reload
      }

      setNotices(activeNotices);
      setVideos(activeVideos);
    } catch (e) {
      console.error("Feed extraction failed", e);
    }
  };

  // Automated Database Seeder matching specifications
  const seedDefaultContents = async () => {
    try {
      // Create initial notices
      const defaultNotices = [
        {
          id: 'notice_1',
          title: 'Welcome to Viral Shares App',
          content: 'আনন্দের খবর! এখন ভিডিও শেয়ার করে ও স্পন্সর্ড টিউটোরিয়াল এড দেখে পয়েন্ট আর্ন করতে পারবেন। পয়েন্ট দিয়ে প্রিমিয়াম ভিডিও আনলক করুন!',
          category: 'promotion',
          isPinned: true,
          link: 'https://images.unsplash.com',
          isPopup: true,
          publishDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          createdAt: new Date().toISOString()
        },
        {
          id: 'notice_2',
          title: 'System Server Updates Complete',
          content: 'আমাদের Mini App সার্ভার আপগ্রেড সম্পন্ন হয়েছে। এখন ভিডিও স্ট্রিমিং ও পয়েন্ট আর্ন কাউন্টার আরও ফাস্ট লোড হবে।',
          category: 'update',
          isPinned: false,
          link: '',
          isPopup: false,
          publishDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          createdAt: new Date().toISOString()
        }
      ];

      for (const n of defaultNotices) {
        await setDoc(doc(db, 'notices', n.id), n);
      }

      // Create initial videos
      const defaultVideos = [
        {
          id: 'video_1',
          title: '🔥 Telegram Tap-to-Earn Crypto Mini App Development Tutorial',
          thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
          videoUrl: 'https://www.youtube.com/watch?v=M9-Z0vWfLNo',
          duration: '12:45',
          views: 1420,
          likes: 382,
          isLocked: false,
          requiredPoints: 0,
          category: 'Trending',
          externalUnlockLink: '',
          reLockDurationMinutes: 10,
          createdAt: new Date().toISOString()
        },
        {
          id: 'video_2',
          title: '💎 Premium Premium Viral Strategy - Get 100k Users (Locked Pack)',
          thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          duration: '07:15',
          views: 932,
          likes: 240,
          isLocked: true,
          requiredPoints: 40,
          category: 'Trending',
          externalUnlockLink: 'https://www.google.com',
          reLockDurationMinutes: 12,
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'video_3',
          title: '🎮 Best Mini App Games Inside Telegram - Top Pick & Gameplay',
          thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=60',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          duration: '04:30',
          views: 450,
          likes: 95,
          isLocked: false,
          requiredPoints: 0,
          category: 'Gaming',
          externalUnlockLink: '',
          reLockDurationMinutes: 10,
          createdAt: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: 'video_4',
          title: '🚀 Secret Viral Video Sharing Algorithm Exposed by Elite Marketer',
          thumbnailUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=500&auto=format&fit=crop&q=60',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          duration: '15:20',
          views: 2045,
          likes: 814,
          isLocked: true,
          requiredPoints: 60,
          category: 'Music',
          externalUnlockLink: 'https://t.me/ShopBot',
          reLockDurationMinutes: 8,
          createdAt: new Date(Date.now() - 10800000).toISOString()
        }
      ];

      for (const v of defaultVideos) {
        await setDoc(doc(db, 'videos', v.id), v);
      }

      await loadFeeds();
    } catch (e) {
      console.error("Seeding initial resources failed", e);
    }
  };

  // Video Unlock callback success
  const handleVideoUnlockedSuccess = (videoId: string, updatedPoints: number) => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        points: updatedPoints
      });
    }
    setUnlockedVideoIds([...unlockedVideoIds, videoId]);
    loadFeeds(); // refresh feed counts
  };

  // Profile Log out / Account Reset action
  const handleResetAuth = async () => {
    if (confirm("Reset account and load standard visitor profile?")) {
      try {
        await signOut(auth);
        setCurrentUser(null);
        setLoading(true);
        // Resign anonymously
        await signInAnonymously(auth);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Video Link Share generator
  const handleShareVideo = (video: Video, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSharingVideo(video);
  };

  const executeShareCopy = () => {
    if (!sharingVideo) return;
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://t.me/ViralVideoBot/app';
    const videoRefCode = currentUser?.referralCode || 'guest';
    
    const playShareLink = `${currentOrigin}?ref=${videoRefCode}&open_video=${sharingVideo.id}`;
    const copyText = `🔥 Watch: "${sharingVideo.title}" (${sharingVideo.duration}). Join to earn points and claim premium links: ${playShareLink}`;
    
    navigator.clipboard.writeText(copyText);
    alert("Share message copied to clipboard! Share it with friends to earn points!");
    setSharingVideo(null);
  };

  // Direct Sharing Fallbacks (Stops iframe blocks)
  const executeShareDirect = () => {
    if (!sharingVideo) return;
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://t.me/ViralVideoBot/app';
    const videoRefCode = currentUser?.referralCode || 'guest';
    const playShareLink = `${currentOrigin}?ref=${videoRefCode}&open_video=${sharingVideo.id}`;

    const shareText = `🔥 Watch "${sharingVideo.title}" (${sharingVideo.duration}) on Telegram: ${playShareLink}`;
    const encodedText = encodeURIComponent(shareText);
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(playShareLink)}&text=${encodedText}`;
    
    window.open(telegramShareUrl, '_blank');
    setSharingVideo(null);
  };

  // Main UI components filter metrics
  const filteredVideos = videos.filter(v => {
    const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    if (feedFilter === 'trending') {
      return (b.views || 0) - (a.views || 0);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6" id="applet-loading">
        <div className="relative mb-4">
          <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <Coins className="w-6 h-6 text-amber-500 absolute inset-0 m-auto animate-pulse" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-amber-500">Loading Applet Modules</h2>
        <p className="text-xs text-neutral-500 mt-2 font-semibold">Connecting securely to cloud servers...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden flex flex-col relative pb-16" id="main-app-container">
      {/* Top Notice systems */}
      <NoticeBar notices={notices} onSelectNotice={(n) => alert(`${n.title}: ${n.content}`)} />
      <PopupNotice notices={notices} />

      {/* Global Header */}
      <header className="px-4 py-4 flex items-center justify-between border-b border-neutral-900 bg-black/80 backdrop-blur-md sticky top-0 z-40">
        <div>
          <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
            <span className="text-amber-500">TG</span> Mini Video Share
          </h1>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mt-1">
            Viral Earning Portal
          </span>
        </div>

        {/* User Stats in Header */}
        <div className="flex items-center gap-1.5 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-2xl">
          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-xs font-black text-white tracking-tight font-mono">
            {currentUser?.points || 0}
          </span>
        </div>
      </header>

      {/* Sub content panels */}
      <main className="flex-1 max-w-lg mx-auto w-full">
        {/* Tab 1: HOME FEED */}
        {activeTab === 'home' && (
          <div className="px-4 py-4 animate-fade-in" id="home-feed-section">
            
            {/* Search Option */}
            <div className="relative flex items-center bg-[#111111] border border-neutral-800 rounded-2xl px-3.5 py-1.5 mb-4 focus-withins:border-amber-500/40 focus-within:ring-1 focus-within:ring-amber-500/10">
              <Search className="w-4 h-4 text-neutral-500 shrink-0" />
              <input 
                type="text" 
                placeholder="Search viral videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="grow bg-transparent border-0 outline-hidden text-xs text-white p-2 text-ellipsis text-left"
              />
            </div>

            {/* All and Trending tabs Selector */}
            <div className="flex gap-2 mb-4 border-b border-neutral-900 pb-3">
              <button
                id="feed-filter-latest"
                onClick={() => setFeedFilter('latest')}
                className={`text-xs font-bold py-1.5 px-4 rounded-xl transition ${
                  feedFilter === 'latest' 
                    ? 'bg-amber-500 text-black shadow-md' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Latest Feeds
              </button>
              <button
                id="feed-filter-trending"
                onClick={() => setFeedFilter('trending')}
                className={`text-xs font-bold py-1.5 px-4 rounded-xl transition flex items-center gap-1 ${
                  feedFilter === 'trending' 
                    ? 'bg-amber-500 text-black shadow-md' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-orange-600 fill-orange-600" />
                Trending
              </button>
            </div>

            {/* Category Filter lists */}
            <div className="flex gap-1.5 overflow-x-auto pb-4 mb-3 scrollbar-none">
              {['All', 'Trending', 'Anime', 'Fails', 'Gaming', 'Music'].map((cat) => (
                <button
                  key={cat}
                  id={`cat-filter-btn-${cat}`}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shrink-0 border transition-all duration-150 ${
                    selectedCategory === cat
                      ? 'bg-white border-white text-black font-extrabold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Video Cards Grid */}
            {sortedVideos.length === 0 ? (
              <div className="py-16 text-center text-neutral-500 text-xs font-medium">
                No videos match your select criteria. Search for other terms!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-12">
                {sortedVideos.map((vid) => (
                  <VideoCard 
                    key={vid.id} 
                    video={vid} 
                    isUnlocked={unlockedVideoIds.includes(vid.id)}
                    onSelect={(v) => setSelectedVideo(v)}
                    onShare={(v, e) => handleShareVideo(v, e)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: EARN SECTION */}
        {activeTab === 'earn' && (
          <PointsSection 
            currentUser={currentUser} 
            onPointsUpdated={(pts) => {
              if (currentUser) {
                setCurrentUser({ ...currentUser, points: pts });
              }
            }}
            settings={settings}
          />
        )}

        {/* Tab 3: REFERRALS */}
        {activeTab === 'referral' && (
          <ReferralSystem 
            currentUser={currentUser}
            settings={settings}
          />
        )}

        {/* Tab 4: PROFILE */}
        {activeTab === 'profile' && (
          <ProfileView 
            currentUser={currentUser}
            onLogout={handleResetAuth}
            onAdminGranted={() => {
              if (currentUser) {
                setCurrentUser({ ...currentUser, isAdmin: true });
              }
            }}
          />
        )}

        {/* Tab 5: ADMIN MANAGEMENT (IF ALLOWED) */}
        {activeTab === 'admin' && currentUser?.isAdmin && (
          <AdminPanel 
            currentUser={currentUser}
            videos={videos}
            notices={notices}
            settings={settings}
            onRefreshData={loadFeeds}
            onUpdateSettings={() => loadFeeds()}
          />
        )}
      </main>

      {/* Video Detail overlay modal */}
      {selectedVideo && (
        <VideoDetailsModal 
          video={selectedVideo}
          currentUser={currentUser}
          isUnlocked={unlockedVideoIds.includes(selectedVideo.id)}
          onClose={() => setSelectedVideo(null)}
          onUnlockedSuccess={handleVideoUnlockedSuccess}
          onShare={(v) => handleShareVideo(v)}
        />
      )}

      {/* Share Actions Modal */}
      {sharingVideo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#111111] border border-neutral-800 rounded-t-3xl p-6 space-y-4 shadow-2xl relative translate-y-0 transition-transform duration-300">
            <h3 className="text-sm font-black text-white text-center pb-2 border-b border-neutral-900">Share Premium Video</h3>
            
            <p className="text-[11px] text-neutral-400 text-center leading-normal">
              Accumulate commission points! Share this viral video and reward yourself with referral multipliers when friends join the portal.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                id="do-share-direct"
                onClick={executeShareDirect}
                className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                Telegram Direct
              </button>
              <button 
                id="do-share-copy"
                onClick={executeShareCopy}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5 border border-neutral-850"
              >
                <Clipboard className="w-4 h-4 font-bold" />
                Copy Text Link
              </button>
            </div>

            <button 
              id="cancel-share-btn"
              onClick={() => setSharingVideo(null)}
              className="w-full py-3 text-neutral-400 hover:text-white font-bold text-xs hover:bg-neutral-850 rounded-xl transition"
            >
              Cancel sharing
            </button>
          </div>
        </div>
      )}

      {/* Bottom Sticky Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-neutral-900 backdrop-blur-md z-30 flex justify-around py-2.5 px-4 max-w-lg mx-auto" id="sticky-bottom-nav">
        <button
          id="nav-btn-home"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${activeTab === 'home' ? 'text-amber-500' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          <Tv2 className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider leading-none">Home</span>
        </button>

        <button
          id="nav-btn-earn"
          onClick={() => setActiveTab('earn')}
          className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${activeTab === 'earn' ? 'text-amber-500' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          <Coins className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider leading-none">Earning</span>
        </button>

        <button
          id="nav-btn-refer"
          onClick={() => setActiveTab('referral')}
          className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${activeTab === 'referral' ? 'text-amber-500' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          <Users className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider leading-none">Referral</span>
        </button>

        <button
          id="nav-btn-profile"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${activeTab === 'profile' ? 'text-amber-500' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          <UserIcon className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider leading-none">Profile</span>
        </button>

        {currentUser?.isAdmin && (
          <button
            id="nav-btn-admin"
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${activeTab === 'admin' ? 'text-amber-500' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Shield className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wider leading-none">Admin</span>
          </button>
        )}
      </nav>

      {/* Injected animations & Marquee variables */}
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
