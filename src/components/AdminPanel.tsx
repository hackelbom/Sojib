import React, { useState, useEffect } from 'react';
import { Video, Notice, User, SystemSettings } from '../types';
import { db } from '../firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { 
  BarChart, Video as VideoIcon, ScrollText, Users, Settings as SettingsIcon, 
  Plus, Trash2, ShieldCheck, Edit, Save, Lock, ArrowUpRight, Search, Sparkles
} from 'lucide-react';

interface AdminPanelProps {
  currentUser: User | null;
  videos: Video[];
  notices: Notice[];
  settings: SystemSettings;
  onRefreshData: () => void;
  onUpdateSettings: (newSettings: SystemSettings) => void;
}

type TabType = 'analytics' | 'videos' | 'notices' | 'users' | 'settings';

export function AdminPanel({ 
  currentUser, 
  videos, 
  notices, 
  settings, 
  onRefreshData,
  onUpdateSettings 
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  // Form states - Video Upload
  const [videoForm, setVideoForm] = useState({
    title: '',
    thumbnailUrl: '',
    videoUrl: '',
    duration: '03:45',
    category: 'Trending',
    isLocked: true,
    requiredPoints: 50,
    externalUnlockLink: '',
    reLockDurationMinutes: 10
  });

  // Form states - Notice Board
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    category: 'info' as 'info' | 'update' | 'warning' | 'promotion',
    isPinned: false,
    link: '',
    isPopup: false,
    publishDate: new Date().toISOString().slice(0, 16),
    expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)
  });

  // Categories list
  const [categories, setCategories] = useState<string[]>(['All', 'Trending', 'Anime', 'Fails', 'Gaming', 'Music']);
  const [newCategory, setNewCategory] = useState('');

  // Reward Config Settings local state
  const [localSettings, setLocalSettings] = useState<SystemSettings>({ ...settings });

  useEffect(() => {
    setLocalSettings({ ...settings });
  }, [settings]);

  // Load all users for User management
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const list: User[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as User);
      });
      setUsersList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  // Analytics Computation
  const stats = {
    totalVideos: videos.length,
    activeNotices: notices.length,
    totalViews: videos.reduce((acc, v) => acc + (v.views || 0), 0),
    totalLikes: videos.reduce((acc, v) => acc + (v.likes || 0), 0),
    totalUsers: usersList.length || videos.length + 3, // placeholder fallback if users list hasn't finished loading
    premiumCount: videos.filter(v => v.isLocked).length
  };

  // Video Management trigger
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoForm.title || !videoForm.videoUrl) {
      alert("Please fill in the title and video source link.");
      return;
    }

    try {
      const docId = `video_${Date.now()}`;
      await setDoc(doc(db, 'videos', docId), {
        id: docId,
        title: videoForm.title,
        thumbnailUrl: videoForm.thumbnailUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
        videoUrl: videoForm.videoUrl,
        duration: videoForm.duration,
        views: 0,
        likes: 0,
        isLocked: videoForm.isLocked,
        requiredPoints: Number(videoForm.requiredPoints),
        category: videoForm.category,
        externalUnlockLink: videoForm.externalUnlockLink,
        reLockDurationMinutes: Number(videoForm.reLockDurationMinutes),
        createdAt: new Date().toISOString()
      });

      alert("Video upload successful!");
      setVideoForm({
        title: '',
        thumbnailUrl: '',
        videoUrl: '',
        duration: '03:45',
        category: 'Trending',
        isLocked: true,
        requiredPoints: 50,
        externalUnlockLink: '',
        reLockDurationMinutes: 10
      });
      onRefreshData();
    } catch (err) {
      console.error(err);
      alert("Database write error.");
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to remove this video permanently?")) return;
    try {
      await deleteDoc(doc(db, 'videos', videoId));
      onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  // Category Management
  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim())) {
      alert("Category already exists.");
      return;
    }
    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
  };

  // Notice Board Operations
  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.title || !noticeForm.content) {
      alert("Notice title and announcements must be written.");
      return;
    }

    try {
      const docId = `notice_${Date.now()}`;
      await setDoc(doc(db, 'notices', docId), {
        id: docId,
        title: noticeForm.title,
        content: noticeForm.content,
        category: noticeForm.category,
        isPinned: noticeForm.isPinned,
        link: noticeForm.link || '',
        isPopup: noticeForm.isPopup,
        publishDate: new Date(noticeForm.publishDate).toISOString(),
        expiryDate: new Date(noticeForm.expiryDate).toISOString(),
        createdAt: new Date().toISOString()
      });

      alert("Announcement notice published successfully!");
      setNoticeForm({
        title: '',
        content: '',
        category: 'info',
        isPinned: false,
        link: '',
        isPopup: false,
        publishDate: new Date().toISOString().slice(0, 16),
        expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)
      });
      onRefreshData();
    } catch (e) {
      console.error(e);
      alert("Failed storing notice detail.");
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm("Remove this Notice?")) return;
    try {
      await deleteDoc(doc(db, 'notices', noticeId));
      onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  // User manual points calibration adjustment
  const handleAdjustPoints = async (user: User, amount: number) => {
    const actType = amount > 0 ? 'added' : 'deducted';
    if (!confirm(`Are you sure you want to adjust raw scores? ${amount > 0 ? '+' : ''}${amount} pts will be ${actType} for @${user.username || 'user'}`)) return;

    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        points: increment(amount)
      });

      // Log point modifications
      const hId = `adjust_${Date.now()}`;
      await setDoc(doc(db, 'pointHistory', `${user.id}_${hId}`), {
        userId: user.id,
        type: 'admin_adjust',
        points: amount,
        description: `Admin points control adjustment: ${amount > 0 ? '+' : ''}${amount} points applied.`,
        createdAt: new Date().toISOString()
      });

      alert("Points adjustment committed!");
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  // Global Settings Controls
  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'system', 'settings'), {
        joinBonus: Number(localSettings.joinBonus),
        referralReward: Number(localSettings.referralReward),
        adWatchTimer: Number(localSettings.adWatchTimer),
        adWatchReward: Number(localSettings.adWatchReward)
      });
      alert("Global reward configuration saved successfully!");
      onUpdateSettings(localSettings);
    } catch (e) {
      console.error(e);
      alert("Error saving settings.");
    }
  };

  // Filtered User search
  const filteredUsers = usersList.filter(u => 
    (u.displayName || '').toLowerCase().includes(searchUser.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(searchUser.toLowerCase()) ||
    (u.telegramId || u.id || '').includes(searchUser)
  );

  return (
    <div className="w-full pb-24 px-4 animate-fade-in" id="admin-panel-section">
      {/* Visual Header */}
      <div className="flex items-center gap-3.5 mb-6 mt-4 border-b border-neutral-800 pb-4">
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 p-2 rounded-xl">
          <ShieldCheck className="w-6 h-6 shrink-0" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white leading-none">Console Management</h2>
          <span className="text-[11px] text-zinc-500 mt-1 block">Administrator control deck</span>
        </div>
      </div>

      {/* Admin Tab Selectors */}
      <div className="flex gap-1 overflow-x-auto pb-3.5 mb-4 border-b border-neutral-900 border-none scrollbar-none">
        {(['analytics', 'videos', 'notices', 'users', 'settings'] as TabType[]).map((tab) => (
          <button
            key={tab}
            id={`admin-tab-btn-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`text-xs font-bold capitalize px-4 py-2 rounded-xl transition-all ${
              activeTab === tab 
                ? 'bg-amber-500 text-black shadow-[0_4px_12px_rgba(245,158,11,0.2)]' 
                : 'bg-neutral-900 text-neutral-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Visual Tab Contents */}

      {/* 1. Analytics Hub Panel */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Total Videos</span>
              <span className="text-2xl font-black text-white block mt-1">{stats.totalVideos}</span>
            </div>
            <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Total Views</span>
              <span className="text-2xl font-black text-amber-500 block mt-1">{stats.totalViews}</span>
            </div>
            <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Total Likes</span>
              <span className="text-2xl font-black text-rose-400 block mt-1">{stats.totalLikes}</span>
            </div>
            <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Premium Locks</span>
              <span className="text-2xl font-black text-white block mt-1">{stats.premiumCount}</span>
            </div>
          </div>

          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Live System Records</h3>
            <div className="space-y-3.5 text-xs text-neutral-300">
              <div className="flex justify-between items-center">
                <span>Active Notices published</span>
                <span className="font-bold text-white">{stats.activeNotices}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Database users indexed</span>
                <span className="font-bold text-white">{stats.totalUsers}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Video uploader manager */}
      {activeTab === 'videos' && (
        <div className="space-y-6">
          {/* Uploader Form */}
          <form onSubmit={handleAddVideo} className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-500" />
              Upload New Video Video
            </h3>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Video Title</label>
              <input 
                type="text" 
                value={videoForm.title}
                onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500/50"
                placeholder="How to tap mini apps viral..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Duration</label>
                <input 
                  type="text" 
                  value={videoForm.duration}
                  onChange={(e) => setVideoForm({ ...videoForm, duration: e.target.value })}
                  className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500/50"
                  placeholder="03:45"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Category Filter</label>
                <select 
                  value={videoForm.category}
                  onChange={(e) => setVideoForm({...videoForm, category: e.target.value})}
                  className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden"
                >
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Thumbnail Source URL</label>
              <input 
                type="url" 
                value={videoForm.thumbnailUrl}
                onChange={(e) => setVideoForm({ ...videoForm, thumbnailUrl: e.target.value })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden"
                placeholder="https://images.unsplash.com/..."
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Video Source URL (Embed or Direct link)</label>
              <input 
                type="text" 
                value={videoForm.videoUrl}
                onChange={(e) => setVideoForm({ ...videoForm, videoUrl: e.target.value })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden"
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
            </div>

            {/* Lock Criteria Toggle Toggle */}
            <div className="bg-black/40 border border-neutral-850/60 rounded-xl p-3.5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-white">Enable Premium Locking</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={videoForm.isLocked}
                  onChange={(e) => setVideoForm({ ...videoForm, isLocked: e.target.checked })}
                  className="w-4 h-4 text-amber-500 rounded border-neutral-800 bg-black focus:ring-0"
                />
              </div>

              {videoForm.isLocked && (
                <div className="space-y-3 pt-2.5 border-t border-neutral-900 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Score cost to unlock</label>
                      <input 
                        type="number" 
                        value={videoForm.requiredPoints}
                        onChange={(e) => setVideoForm({ ...videoForm, requiredPoints: Number(e.target.value) })}
                        className="w-full bg-black border border-neutral-850 px-3.5 py-2 rounded-xl text-xs text-white focus:outline-hidden"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Relock Duration (m)</label>
                      <input 
                        type="number" 
                        value={videoForm.reLockDurationMinutes}
                        onChange={(e) => setVideoForm({ ...videoForm, reLockDurationMinutes: Number(e.target.value) })}
                        className="w-full bg-black border border-neutral-850 px-3.5 py-2 rounded-xl text-xs text-white focus:outline-hidden"
                        min="1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Admin Redirect Purchase URL Link</label>
                    <input 
                      type="url" 
                      value={videoForm.externalUnlockLink}
                      onChange={(e) => setVideoForm({ ...videoForm, externalUnlockLink: e.target.value })}
                      className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden"
                      placeholder="https://t.me/ShopBot..."
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-3 rounded-xl transition text-xs shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
            >
              Add Video to Applet Repository
            </button>
          </form>

          {/* Video List review */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Repository Listing</h3>
            {videos.length === 0 ? (
              <p className="text-neutral-500 text-xs text-center py-4">No uploaded videos.</p>
            ) : (
              videos.map((vid) => (
                <div key={vid.id} id={`admin-video-row-${vid.id}`} className="bg-[#111111] border border-neutral-800 rounded-xl p-3 flex justify-between items-center">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img 
                      src={vid.thumbnailUrl} 
                      alt="" 
                      className="w-12 h-10 object-cover rounded-lg shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-white truncate leading-none mb-1.5">{vid.title}</p>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded border border-neutral-800">
                        {vid.category}
                      </span>
                    </div>
                  </div>
                  <button 
                    id={`btn-del-video-${vid.id}`}
                    onClick={() => handleDeleteVideo(vid.id)}
                    className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition ml-3"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. Notice board ops */}
      {activeTab === 'notices' && (
        <div className="space-y-6">
          <form onSubmit={handleAddNotice} className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <ScrollText className="w-4 h-4 text-amber-500" />
              Publish Announcement Notice
            </h3>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Notice Title</label>
              <input 
                type="text" 
                value={noticeForm.title}
                onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500/50"
                placeholder="Maintenance warning notice..."
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Content description</label>
              <textarea 
                value={noticeForm.content}
                onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2 rounded-xl text-xs text-white focus:outline-hidden min-h-[80px]"
                placeholder="We are expanding system capacity..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Notice Category</label>
                <select 
                  value={noticeForm.category}
                  onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value as any })}
                  className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="update">Update (Green)</option>
                  <option value="warning">Warning (Red)</option>
                  <option value="promotion">Promotion (Yellow)</option>
                </select>
              </div>
              <div className="flex flex-col justify-end gap-1 pb-1">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={noticeForm.isPinned}
                    onChange={(e) => setNoticeForm({ ...noticeForm, isPinned: e.target.checked })}
                    className="w-4 h-4 text-amber-500 bg-black border-neutral-800 rounded"
                    id="checkbox-pinned"
                  />
                  <label htmlFor="checkbox-pinned" className="text-[10px] font-bold text-zinc-300 uppercase cursor-pointer">Pin Notice</label>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input 
                    type="checkbox" 
                    checked={noticeForm.isPopup}
                    onChange={(e) => setNoticeForm({ ...noticeForm, isPopup: e.target.checked })}
                    className="w-4 h-4 text-amber-500 bg-black border-neutral-800 rounded"
                    id="checkbox-popup"
                  />
                  <label htmlFor="checkbox-popup" className="text-[10px] font-bold text-zinc-300 uppercase cursor-pointer">Show as Modal Popup</label>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Attachment Link (Optional)</label>
              <input 
                type="url" 
                value={noticeForm.link}
                onChange={(e) => setNoticeForm({ ...noticeForm, link: e.target.value })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-hidden"
                placeholder="https://t.me/ChannelInfo"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-3 rounded-xl transition text-xs"
            >
              Broadcast Notice Board Content
            </button>
          </form>

          {/* Notices checklist */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Active Notice List</h3>
            {notices.length === 0 ? (
              <p className="text-neutral-500 text-xs text-center py-4">No active notices.</p>
            ) : (
              notices.map((n) => (
                <div key={n.id} id={`admin-notice-row-${n.id}`} className="bg-[#111111] border border-neutral-800 rounded-xl p-3 flex justify-between items-center hover:border-neutral-700 transition">
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate mb-1 leading-none">{n.title}</p>
                    <span className="text-[9px] text-zinc-400">{n.category.toUpperCase()} category</span>
                  </div>
                  <button 
                    id={`btn-del-notice-${n.id}`}
                    onClick={() => handleDeleteNotice(n.id)}
                    className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition ml-3"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. User profile adjustments */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative mb-3 flex items-center bg-black border border-neutral-850 rounded-xl px-3 py-1.5 focus-within:border-amber-500/40">
            <Search className="w-4 h-4 text-neutral-500 shrink-0" />
            <input 
              type="text" 
              placeholder="Search users by name, username or ID..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="grow bg-transparent border-none text-xs text-white outline-hidden p-2 text-ellipsis"
            />
          </div>

          {loadingUsers ? (
            <p className="text-neutral-400 text-xs text-center py-12">Querying workspace profiles...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-neutral-500 text-xs text-center py-6">No matching users indexed.</p>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} id={`admin-user-row-${user.id}`} className="bg-[#111111] border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h4 className="text-xs font-black text-white">{user.displayName || 'Visitor user'}</h4>
                      <span className="text-[10px] text-neutral-400">@{user.username || 'guest'}</span>
                    </div>
                    <span className="text-xs font-mono font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-lg">
                      {user.points || 0} pts
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-neutral-900 pt-2.5">
                    <button
                      id={`btn-add-pts-${user.id}`}
                      onClick={() => handleAdjustPoints(user, 100)}
                      className="bg-green-500/10 hover:bg-green-500/20 text-green-400 font-extrabold py-2 rounded-xl text-[10px] transition"
                    >
                      +100 Points
                    </button>
                    <button
                      id={`btn-del-pts-${user.id}`}
                      onClick={() => handleAdjustPoints(user, -50)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold py-2 rounded-xl text-[10px] transition"
                    >
                      -50 Points
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. System point configurations */}
      {activeTab === 'settings' && (
        <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <SettingsIcon className="w-4 h-4 text-amber-500" />
            Global Reward Payout Settings
          </h3>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">New User Join Bonus</label>
              <input 
                type="number" 
                value={localSettings.joinBonus}
                onChange={(e) => setLocalSettings({ ...localSettings, joinBonus: Number(e.target.value) })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2 rounded-xl text-xs text-white"
                min="0"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Referral Bonus Reward</label>
              <input 
                type="number" 
                value={localSettings.referralReward}
                onChange={(e) => setLocalSettings({ ...localSettings, referralReward: Number(e.target.value) })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2 rounded-xl text-xs text-white"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-neutral-900">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Ad watch Reward (pts)</label>
              <input 
                type="number" 
                value={localSettings.adWatchReward}
                onChange={(e) => setLocalSettings({ ...localSettings, adWatchReward: Number(e.target.value) })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2 rounded-xl text-xs text-white"
                min="1"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Ad Stream Timer (secs)</label>
              <input 
                type="number" 
                value={localSettings.adWatchTimer}
                onChange={(e) => setLocalSettings({ ...localSettings, adWatchTimer: Number(e.target.value) })}
                className="w-full bg-black border border-neutral-850 px-3.5 py-2 rounded-xl text-xs text-white"
                min="3"
              />
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-3 rounded-xl transition text-xs mt-3.5 shadow-[0_4px_12px_rgba(245,158,11,0.25)]"
          >
            Save App Settings Configuration
          </button>
        </div>
      )}
    </div>
  );
}
