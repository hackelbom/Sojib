import { Notice } from '../types';
import { X, ExternalLink, Info, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PopupNoticeProps {
  notices: Notice[];
}

export function PopupNotice({ notices }: PopupNoticeProps) {
  const [activePopup, setActivePopup] = useState<Notice | null>(null);

  useEffect(() => {
    const popupNotices = notices.filter(n => {
      if (!n.isPopup) return false;
      const now = new Date().toISOString();
      const pub = n.publishDate ? new Date(n.publishDate).toISOString() : '';
      const exp = n.expiryDate ? new Date(n.expiryDate).toISOString() : '';
      return (!pub || pub <= now) && (!exp || exp >= now);
    });

    if (popupNotices.length > 0) {
      // Find one that isn't dismissed in localStorage yet
      const dismissedList = JSON.parse(localStorage.getItem('dismissed_notices') || '[]');
      const unreadPopup = popupNotices.find(n => !dismissedList.includes(n.id));

      if (unreadPopup) {
        setActivePopup(unreadPopup);
      }
    }
  }, [notices]);

  if (!activePopup) return null;

  const handleDismiss = () => {
    const dismissedList = JSON.parse(localStorage.getItem('dismissed_notices') || '[]');
    dismissedList.push(activePopup.id);
    localStorage.setItem('dismissed_notices', JSON.stringify(dismissedList));
    setActivePopup(null);
  };

  const getPopupAccent = (category: string) => {
    switch (category) {
      case 'warning':
        return {
          title: 'Emergency Warning',
          border: 'border-red-500/50',
          glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
          badge: 'bg-red-500/20 text-red-400',
          icon: <AlertTriangle className="w-5 h-5 text-red-400" />
        };
      case 'update':
        return {
          title: 'System Update',
          border: 'border-green-500/50',
          glow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]',
          badge: 'bg-green-500/20 text-green-400',
          icon: <RefreshCw className="w-5 h-5 text-green-400" />
        };
      case 'promotion':
        return {
          title: 'Special Promotion',
          border: 'border-amber-500/50',
          glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
          badge: 'bg-amber-500/20 text-amber-400',
          icon: <Sparkles className="w-5 h-5 text-amber-400" />
        };
      case 'info':
      default:
        return {
          title: 'Information Board',
          border: 'border-blue-500/50',
          glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
          badge: 'bg-blue-500/20 text-blue-400',
          icon: <Info className="w-5 h-5 text-blue-400" />
        };
    }
  };

  const accent = getPopupAccent(activePopup.category);

  return (
    <div id="popup-notice-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        id="popup-notice-container"
        className={`w-full max-w-sm bg-neutral-900 border ${accent.border} ${accent.glow} rounded-2xl overflow-hidden shadow-2xl relative transition-all duration-300 transform scale-100 p-6`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {accent.icon}
            <span className={`text-xs font-bold uppercase tracking-wider rounded px-2.5 py-0.5 ${accent.badge}`}>
              {activePopup.category}
            </span>
          </div>
          <button 
            id="dismiss-popup-btn"
            onClick={handleDismiss}
            className="text-neutral-400 hover:text-white transition-colors p-1 hover:bg-neutral-800 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Body */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
            {activePopup.title}
          </h3>
          <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
            {activePopup.content}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {activePopup.link && (
            <a
              id="popup-action-link"
              href={activePopup.link}
              target="_blank"
              referrerPolicy="no-referrer"
              className="flex-1 text-center bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm py-2.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(245,158,11,0.25)]"
            >
              Learn More
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            id="popup-close-btn"
            onClick={handleDismiss}
            className={`py-2.5 px-4 text-sm font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-all duration-200 ${activePopup.link ? 'basis-1/3' : 'w-full'}`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
