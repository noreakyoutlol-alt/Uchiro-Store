import React, { useRef, useState } from 'react';
import {
  Upload,
  X,
  ArrowLeft,
  ArrowRight,
  Video,
  Image as ImageIcon,
  Check,
  Eye,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { ProductMedia } from '../../types';

interface MediaManagerProps {
  media: ProductMedia[];
  videoUrl: string;
  onChangeMedia: (newMedia: ProductMedia[]) => void;
  onChangeVideoUrl: (url: string) => void;
}

export const MediaManager: React.FC<MediaManagerProps> = ({
  media,
  videoUrl,
  onChangeMedia,
  onChangeVideoUrl,
}) => {
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const fileInputRef3 = useRef<HTMLInputElement>(null);
  const fileInputRefs = [fileInputRef1, fileInputRef2, fileInputRef3];

  const [activeSlotUrlInput, setActiveSlotUrlInput] = useState<number | null>(null);
  const [urlInputValue, setUrlInputValue] = useState('');

  // 3 fixed image slots (Slot 0 = Image 1/Primary, Slot 1 = Image 2, Slot 2 = Image 3)
  const slotImages: (ProductMedia | undefined)[] = [
    media[0],
    media[1],
    media[2],
  ];

  const handleFileUpload = (slotIndex: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP, GIF)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const resultUrl = e.target?.result as string;
      if (resultUrl) {
        updateSlotImage(slotIndex, resultUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateSlotImage = (slotIndex: number, url: string) => {
    const newMediaList = [...media];
    const newMediaItem: ProductMedia = {
      id: newMediaList[slotIndex]?.id || `media-${Date.now()}-${slotIndex}`,
      url,
      alt_text: `Product Image ${slotIndex + 1}`,
      is_primary: slotIndex === 0,
      sort_order: slotIndex + 1,
    };

    if (slotIndex < newMediaList.length) {
      newMediaList[slotIndex] = newMediaItem;
    } else {
      // Pad if previous slots were empty
      while (newMediaList.length < slotIndex) {
        newMediaList.push({
          id: `media-${Date.now()}-${newMediaList.length}`,
          url: '',
          alt_text: `Product Image ${newMediaList.length + 1}`,
          is_primary: newMediaList.length === 0,
          sort_order: newMediaList.length + 1,
        });
      }
      newMediaList.push(newMediaItem);
    }

    // Filter out completely empty items and maintain is_primary on first item
    const cleaned = newMediaList.filter((m) => m && m.url.trim().length > 0).map((m, idx) => ({
      ...m,
      is_primary: idx === 0,
      sort_order: idx + 1,
    }));

    onChangeMedia(cleaned);
    setActiveSlotUrlInput(null);
    setUrlInputValue('');
  };

  const removeSlotImage = (slotIndex: number) => {
    const newMediaList = media.filter((_, idx) => idx !== slotIndex).map((m, idx) => ({
      ...m,
      is_primary: idx === 0,
      sort_order: idx + 1,
    }));
    onChangeMedia(newMediaList);
  };

  const moveSlotImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= 3) return;
    if (!media[fromIndex]) return;

    const newMediaList = [...media];
    // Ensure array has enough elements
    while (newMediaList.length <= Math.max(fromIndex, toIndex)) {
      newMediaList.push({
        id: `media-temp-${Date.now()}`,
        url: '',
        alt_text: '',
        is_primary: false,
        sort_order: newMediaList.length + 1,
      });
    }

    const temp = newMediaList[fromIndex];
    newMediaList[fromIndex] = newMediaList[toIndex];
    newMediaList[toIndex] = temp;

    const cleaned = newMediaList.filter((m) => m && m.url && m.url.trim().length > 0).map((m, idx) => ({
      ...m,
      is_primary: idx === 0,
      sort_order: idx + 1,
    }));

    onChangeMedia(cleaned);
  };

  return (
    <div className="space-y-4">
      {/* 3 IMAGE SLOTS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#FFD166]" />
            <span>Product Images (Image 1, Image 2, Image 3)</span>
          </label>
          <span className="text-[10px] text-slate-400">
            Image 1 is Primary Thumbnail
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((slotIdx) => {
            const currentItem = slotImages[slotIdx];
            const hasImage = Boolean(currentItem && currentItem.url.trim().length > 0);
            const isUrlInputOpen = activeSlotUrlInput === slotIdx;

            return (
              <div
                key={slotIdx}
                className={`relative rounded-xl border p-2.5 flex flex-col justify-between transition-all ${
                  slotIdx === 0
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-black/30 border-white/10'
                }`}
              >
                {/* Slot Header */}
                <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold">
                  <span className={slotIdx === 0 ? 'text-[#FFD166]' : 'text-slate-400'}>
                    Image {slotIdx + 1} {slotIdx === 0 && '★ Primary'}
                  </span>
                  {hasImage && (
                    <div className="flex items-center gap-1">
                      {slotIdx > 0 && (
                        <button
                          type="button"
                          onClick={() => moveSlotImage(slotIdx, slotIdx - 1)}
                          title="Move left"
                          className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                        >
                          <ArrowLeft className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {slotIdx < 2 && slotImages[slotIdx + 1] && (
                        <button
                          type="button"
                          onClick={() => moveSlotImage(slotIdx, slotIdx + 1)}
                          title="Move right"
                          className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                        >
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSlotImage(slotIdx)}
                        title="Remove image"
                        className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Slot Content */}
                {hasImage ? (
                  <div className="space-y-2">
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black/60 border border-white/10 group">
                      <img
                        src={currentItem!.url}
                        alt={`Preview slot ${slotIdx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRefs[slotIdx].current?.click()}
                          className="px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Replace
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 truncate max-w-[120px]">
                        {currentItem!.url.startsWith('data:')
                          ? 'Uploaded Image File'
                          : currentItem!.url}
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRefs[slotIdx].current?.click()}
                        className="text-[#FFD166] hover:underline font-bold"
                      >
                        Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 border border-dashed border-white/15 rounded-lg bg-black/20 text-center gap-1.5">
                    <ImageIcon className="w-6 h-6 text-slate-500" />
                    <p className="text-[10px] text-slate-400 font-medium">Slot Empty</p>

                    {isUrlInputOpen ? (
                      <div className="w-full px-2 space-y-1.5 mt-1">
                        <input
                          type="text"
                          value={urlInputValue}
                          onChange={(e) => setUrlInputValue(e.target.value)}
                          placeholder="Paste https:// image URL"
                          className="w-full px-2 py-1 rounded bg-black/60 border border-white/20 text-white text-[10px]"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (urlInputValue.trim()) {
                                updateSlotImage(slotIdx, urlInputValue.trim());
                              }
                            }}
                            className="flex-1 py-1 rounded bg-indigo-600 text-white text-[10px] font-bold"
                          >
                            Set URL
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSlotUrlInput(null);
                              setUrlInputValue('');
                            }}
                            className="px-2 py-1 rounded bg-white/10 text-slate-400 text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRefs[slotIdx].current?.click()}
                          className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold flex items-center gap-1 transition-all"
                        >
                          <Upload className="w-3 h-3" /> Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSlotUrlInput(slotIdx);
                            setUrlInputValue('');
                          }}
                          className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 text-[10px] font-bold"
                        >
                          Paste URL
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Hidden File Input for this slot */}
                <input
                  ref={fileInputRefs[slotIdx]}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(slotIdx, file);
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* VIDEO SLOT */}
      <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-rose-400" />
            <span>Product Showcase Video (Optional)</span>
          </label>
          {videoUrl && (
            <button
              type="button"
              onClick={() => onChangeVideoUrl('')}
              className="text-[10px] text-rose-400 hover:underline font-bold"
            >
              Remove Video
            </button>
          )}
        </div>

        <input
          type="text"
          value={videoUrl || ''}
          onChange={(e) => onChangeVideoUrl(e.target.value)}
          placeholder="e.g. https://www.youtube.com/embed/... or direct video URL"
          className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />

        {videoUrl && (
          <div className="mt-2 aspect-video w-full max-w-sm rounded-lg overflow-hidden bg-black/80 border border-white/10">
            <iframe
              src={videoUrl}
              title="Video Preview"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </div>
    </div>
  );
};
