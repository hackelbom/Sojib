import { Notice } from '../types';
import { Info, AlertTriangle, Sparkles, RefreshCw, Pin, ChevronRight } from 'lucide-react';

interface NoticeBarProps {
  notices: Notice[];
  onSelectNotice: (notice: Notice) => void;
}

export function NoticeBar({ notices, onSelectNotice }: NoticeBarProps) {
  // Filter active notices
  const now = new Date().toISOString();
  const activeNotices = notices.filter(n => {
    const pub = n.publishDate ? new Date(n.publishDate).toISOString() : '';
    const exp = n.expiryDate ? new Date(n.expiryDate).toISOString() : '';
    return (!pub || pub <= now) && (!exp || exp >= now);
  });

  if (activeNotices.length === 0) return null;

  // Find pinned or most important notices to display as marquee
  const pinnedNotices = activeNotices.filter(n => n.isPinned);
  const marqueeNotices = activeNotices.filter(n => !n.isPinned);
  const displayNotices = pinnedNotices.length > 0 ? pinnedNotices : marqueeNotices;

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'warning':
        return {
          bg: 'bg-red-500/10 border-red-500/30',
          text: 'text-red-400',
          accent: 'bg-red-500',
          icon: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        };
      case 'update':
        return {
          bg: 'bg-green-500/10 border-green-500/30',
          text: 'text-green-400',
          accent: 'bg-green-500',
          icon: <RefreshCw className="w-4 h-4 text-green-400 shrink-0" />
        };
      case 'promotion':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30',
          text: 'text-amber-400',
          accent: 'bg-amber-500',
          icon: <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/30',
          text: 'text-blue-400',
          accent: 'bg-blue-500',
          icon: <Info className="w-4 h-4 text-blue-400 shrink-0" />
        };
    }
  };

  const primaryNotice = displayNotices[0];
  const styles = getCategoryStyles(primaryNotice.category);

  return (
    <div 
      id="top-notice-bar"
      className={`relative w-full border-b overflow-hidden flex items-center px-4 py-2 bg-gradient-to-r from-black via-zinc-950 to-black backdrop-blur-md transition-all duration-300 ${styles.bg}`}
    >
      {/* Category Tag / Status Badge */}
      <div className="flex items-center gap-1.5 shrink-0 z-10 mr-3">
        {styles.icon}
        <span className={`text-[10px] font-bold tracking-wider uppercase ${styles.text}`}>
          {primaryNotice.category}
        </span>
        {primaryNotice.isPinned && (
          <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0 fill-amber-500/20 rotate-45" />
        )}
      </div>

      {/* Marquee Body */}
      <div 
        onClick={() => onSelectNotice(primaryNotice)}
        className="flex-1 overflow-hidden relative cursor-pointer group"
      >
        <div className="whitespace-nowrap animate-[marquee_25s_linear_infinite] hover:[animation-play-state:paused] flex gap-8 py-0.5">
          {displayNotices.map((n, idx) => (
            <span key={n.id || idx} className="text-xs text-white/90 font-medium hover:text-amber-400 transition-colors duration-200">
              {n.title}: <span className="opacity-75">{n.content}</span>
              {n.link && (
                <span className="ml-1 text-amber-500 underline inline-flex items-center gap-0.5">
                  [Read More <ChevronRight className="w-3 h-3 inline" />]
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Action Button */}
      {primaryNotice.link && (
        <a 
          href={primaryNotice.link} 
          target="_blank" 
          referrerPolicy="no-referrer"
          id={`notice-link-${primaryNotice.id}`}
          className="ml-3 text-xs text-amber-500 hover:text-amber-400 transition-colors shrink-0 font-semibold flex items-center gap-0.5 z-10"
        >
          Open
          <ChevronRight className="w-3.5 h-3.5" />
        </a>
      )}

      {/* Tailwind Marquee Keyframe Injector */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(80%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
