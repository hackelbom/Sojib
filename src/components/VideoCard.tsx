import React from 'react';
import { Video } from '../types';
import { Eye, Heart, Lock, Unlock, Share2 } from 'lucide-react';

interface VideoCardProps {
  key?: any;
  video: Video;
  isUnlocked: boolean;
  onSelect: (video: Video) => void;
  onShare: (video: Video, e: React.MouseEvent) => void;
}

export function VideoCard({ video, isUnlocked, onSelect, onShare }: VideoCardProps) {
  const showLockedOverlay = video.isLocked && !isUnlocked;

  const formattedViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}k`;
    return views.toString();
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch (e) {
      return 'Recently';
    }
  };

  return (
    <div 
      id={`video-card-${video.id}`}
      onClick={() => onSelect(video)}
      className="group relative bg-[#111111] border border-neutral-800 hover:border-amber-500/30 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-md hover:shadow-[0_8px_20px_rgba(255,165,0,0.05)]"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video w-full bg-neutral-900 overflow-hidden">
        <img 
          src={video.thumbnailUrl || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60"} 
          alt={video.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Video Duration Badge */}
        <span className="absolute bottom-2.5 right-2.5 bg-black/80 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs z-10">
          {video.duration || '0:00'}
        </span>

        {/* Category Tag */}
        {video.category && (
          <span className="absolute top-2.5 left-2.5 bg-black/60 border border-neutral-700/50 text-neutral-300 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded backdrop-blur-xs z-10">
            {video.category}
          </span>
        )}

        {/* Locked / Premium Overlay */}
        {video.isLocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all group-hover:bg-black/30 z-10">
            {isUnlocked ? (
              <span className="bg-green-500/90 text-black px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-green-500/25">
                <Unlock className="w-3.5 h-3.5 fill-black" />
                Unlocked
              </span>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="bg-amber-500 text-black p-2 rounded-full shadow-lg shadow-amber-500/30 font-bold">
                  <Lock className="w-4 h-4 fill-black" />
                </div>
                <span className="bg-black/90 text-amber-400 border border-amber-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1.5 backdrop-blur-sm">
                  {video.requiredPoints} Points
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Details Container */}
      <div className="p-3.5 flex flex-col justify-between">
        <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug tracking-tight mb-2 group-hover:text-amber-400 transition-colors duration-200">
          {video.title}
        </h4>

        <div className="flex items-center justify-between mt-auto">
          {/* Metadata */}
          <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-medium">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {formattedViews(video.views)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" />
              {formattedViews(video.likes)}
            </span>
            <span className="text-neutral-500">
              {getRelativeTime(video.createdAt)}
            </span>
          </div>

          {/* Share Button (Stops propagation to avoid opening details modal directly) */}
          <button 
            id={`share-btn-${video.id}`}
            onClick={(e) => onShare(video, e)}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-black text-neutral-400 transition-all duration-200"
            title="Share with friends"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
