import React, { useRef, useState } from 'react';
import {
  Upload,
  X,
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  Star,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { ProductMedia } from '../../types';
import { AdminAPI } from '../../services/api';

interface MediaManagerProps {
  /** The product's UUID — required for the upload endpoint and storage path scoping */
  productId: string;
  media: ProductMedia[];
  videoUrl: string;
  onChangeMedia: (newMedia: ProductMedia[]) => void;
  onChangeVideoUrl: (url: string) => void;
}

const MAX_IMAGES = 5;

const FALLBACK_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 200 150%22%3E%3Crect width%3D%22200%22 height%3D%22150%22 fill%3D%22%231a1a2e%22%2F%3E%3Ctext x%3D%22100%22 y%3D%2280%22 text-anchor%3D%22middle%22 fill%3D%22%23444%22 font-size%3D%2214%22%3ENo Image%3C%2Ftext%3E%3C%2Fsvg%3E';

function reindex(list: ProductMedia[]): ProductMedia[] {
  return list.map((m, idx) => ({
    ...m,
    is_primary: idx === 0,
    sort_order: idx + 1,
  }));
}

export const MediaManager: React.FC<MediaManagerProps> = ({
  productId,
  media,
  videoUrl,
  onChangeMedia,
  onChangeVideoUrl,
}) => {
  // Per-slot upload state
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // One file input ref per slot (up to 5)
  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // URL paste input state
  const [activeSlotUrlInput, setActiveSlotUrlInput] = useState<number | null>(null);
  const [urlInputValue, setUrlInputValue] = useState('');

  const handleFileChange = async (slotIndex: number, file: File) => {
    setUploadError(null);

    // Client-side pre-validation
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
      setUploadError('Unsupported file type. Please use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 5 MB per image.');
      return;
    }
    if (!productId || productId === 'new') {
      setUploadError('Save the product first before uploading images.');
      return;
    }

    setUploadingSlot(slotIndex);
    try {
      const result = await AdminAPI.uploadProductImage(file, productId, media.length);
      const newMedia = [...media];
      const newItem: ProductMedia = {
        id: newMedia[slotIndex]?.id || `media-${Date.now()}-${slotIndex}`,
        url: result.url,
        alt_text: `Product Image ${slotIndex + 1}`,
        is_primary: slotIndex === 0,
        sort_order: slotIndex + 1,
      };
      if (slotIndex < newMedia.length) {
        newMedia[slotIndex] = newItem;
      } else {
        newMedia.push(newItem);
      }
      onChangeMedia(reindex(newMedia.filter((m) => m.url.trim())));
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Upload failed. Please try again.';
      setUploadError(msg);
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemoveSlot = (slotIndex: number) => {
    const updated = media.filter((_, idx) => idx !== slotIndex);
    onChangeMedia(reindex(updated));
  };

  const handleMoveSlot = (from: number, to: number) => {
    if (to < 0 || to >= media.length) return;
    const updated = [...media];
    [updated[from], updated[to]] = [updated[to], updated[from]];
    onChangeMedia(reindex(updated));
  };

  const handleSetUrl = (slotIndex: number) => {
    const url = urlInputValue.trim();
    if (!url) return;
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      setUploadError('Please enter a valid https:// image URL.');
      return;
    }
    const newMedia = [...media];
    const newItem: ProductMedia = {
      id: newMedia[slotIndex]?.id || `media-url-${Date.now()}-${slotIndex}`,
      url,
      alt_text: `Product Image ${slotIndex + 1}`,
      is_primary: slotIndex === 0,
      sort_order: slotIndex + 1,
    };
    if (slotIndex < newMedia.length) {
      newMedia[slotIndex] = newItem;
    } else {
      newMedia.push(newItem);
    }
    onChangeMedia(reindex(newMedia.filter((m) => m.url.trim())));
    setActiveSlotUrlInput(null);
    setUrlInputValue('');
    setUploadError(null);
  };

  const imageCount = media.filter((m) => m.url.trim()).length;
  const isFull = imageCount >= MAX_IMAGES;

  // Slots: always show exactly MAX_IMAGES fixed-position slots
  const slots = Array.from({ length: MAX_IMAGES }, (_, i) => media[i] ?? null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-[#FFD166]" />
          <span>Product Images</span>
        </label>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
          imageCount >= MAX_IMAGES
            ? 'bg-rose-500/20 text-rose-300'
            : 'bg-white/10 text-slate-400'
        }`}>
          {imageCount} / {MAX_IMAGES} images
        </span>
      </div>

      {/* Upload error banner */}
      {uploadError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="ml-auto text-rose-400 hover:text-rose-200"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Image Slots Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {slots.map((currentItem, slotIdx) => {
          const hasImage = Boolean(currentItem?.url?.trim());
          const isPrimary = slotIdx === 0;
          const isUploading = uploadingSlot === slotIdx;
          const isUrlInputOpen = activeSlotUrlInput === slotIdx;
          const canUpload = !hasImage && !isFull && uploadingSlot === null;

          return (
            <div
              key={slotIdx}
              className={`relative rounded-xl border p-2 flex flex-col transition-all ${
                isPrimary
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-black/30 border-white/10'
              }`}
            >
              {/* Slot header */}
              <div className="flex items-center justify-between mb-1.5 text-[9px] font-bold">
                <span className={`flex items-center gap-0.5 ${isPrimary ? 'text-[#FFD166]' : 'text-slate-400'}`}>
                  {isPrimary && <Star className="w-2.5 h-2.5 fill-[#FFD166]" />}
                  {isPrimary ? 'Cover' : `#${slotIdx + 1}`}
                </span>

                {hasImage && (
                  <div className="flex items-center gap-0.5">
                    {/* Move left */}
                    {slotIdx > 0 && media[slotIdx - 1] && (
                      <button
                        type="button"
                        onClick={() => handleMoveSlot(slotIdx, slotIdx - 1)}
                        title="Move left (promote)"
                        aria-label="Move image left"
                        className="p-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                      >
                        <ArrowLeft className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {/* Move right */}
                    {slotIdx < media.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveSlot(slotIdx, slotIdx + 1)}
                        title="Move right"
                        aria-label="Move image right"
                        className="p-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300"
                      >
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slotIdx)}
                      title="Remove image"
                      aria-label="Remove image"
                      className="p-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Slot content */}
              {isUploading ? (
                <div className="aspect-video w-full flex flex-col items-center justify-center gap-1.5 rounded-lg bg-black/40 border border-indigo-500/30">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  <span className="text-[9px] text-slate-400">Uploading…</span>
                </div>
              ) : hasImage ? (
                <div className="space-y-1.5">
                  <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black/60 border border-white/10 group">
                    <img
                      src={currentItem!.url}
                      alt={`Product image slot ${slotIdx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_PLACEHOLDER;
                      }}
                    />
                    {/* Replace overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRefs[slotIdx].current?.click()}
                        disabled={uploadingSlot !== null}
                        className="px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-[9px] font-bold flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" /> Replace
                      </button>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-500 truncate text-center px-1">
                    {currentItem!.url.startsWith('data:') ? 'Uploaded' : currentItem!.url.split('/').pop()}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-3 border border-dashed border-white/15 rounded-lg bg-black/20 text-center gap-1 min-h-[80px]">
                  {isFull ? (
                    <p className="text-[9px] text-slate-500">Full ({MAX_IMAGES}/{MAX_IMAGES})</p>
                  ) : isUrlInputOpen ? (
                    <div className="w-full px-1.5 space-y-1">
                      <input
                        type="text"
                        value={urlInputValue}
                        onChange={(e) => setUrlInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetUrl(slotIdx)}
                        placeholder="https:// image URL"
                        className="w-full px-2 py-1 rounded bg-black/60 border border-white/20 text-white text-[9px] focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetUrl(slotIdx)}
                          className="flex-1 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold"
                        >
                          Set URL
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveSlotUrlInput(null); setUrlInputValue(''); }}
                          className="px-2 py-0.5 rounded bg-white/10 text-slate-400 text-[9px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 text-slate-600" />
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => fileInputRefs[slotIdx].current?.click()}
                          disabled={!canUpload}
                          className="px-2 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 text-[9px] font-bold flex items-center gap-1 transition-all disabled:opacity-40"
                          aria-label="Upload Image"
                        >
                          <Upload className="w-2.5 h-2.5" /> Upload Image
                        </button>
                        <button
                          type="button"
                          onClick={() => { setActiveSlotUrlInput(slotIdx); setUrlInputValue(''); setUploadError(null); }}
                          disabled={!canUpload}
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-slate-300 text-[9px] font-bold disabled:opacity-40"
                        >
                          Paste URL
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRefs[slotIdx]}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(slotIdx, file);
                  e.target.value = '';
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Primary image note */}
      <p className="text-[9px] text-slate-500 text-center">
        Image #1 (Cover ★) is shown as the product thumbnail. Use ← → to reorder.
      </p>

      {/* Video URL */}
      <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
        <label className="text-xs font-bold text-slate-300 block">
          Product Showcase Video (Optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={videoUrl || ''}
            onChange={(e) => onChangeVideoUrl(e.target.value)}
            placeholder="YouTube embed URL or direct video URL"
            className="flex-1 px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {videoUrl && (
            <button
              type="button"
              onClick={() => onChangeVideoUrl('')}
              className="text-[10px] text-rose-400 hover:underline font-bold shrink-0"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
