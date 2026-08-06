import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Camera, Image as ImageIcon, ImagePlus, Loader2, X } from 'lucide-react';
import { prepareImage, type PreparedImage } from '../utils/imageScan';
import { spring } from '../ui/motion';

interface ChatInputProps {
  onSendMessage: (text: string, image?: PreparedImage) => void;
  disabled?: boolean;
  /** Enables attaching a nutrition label. Omit to hide the control entirely. */
  allowAttachments?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  allowAttachments = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [focused, setFocused] = useState(false);
  const [attachment, setAttachment] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height to fit content — capped at 30dvh
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxH = Math.min(window.innerHeight * 0.30, 180);
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxH)}px`;
    }
  }, [inputText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled || preparing) return;

    onSendMessage(inputText.trim(), attachment ?? undefined);
    setInputText('');
    setAttachment(null);
    setAttachError(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
    if (!file) return;

    setSourceMenuOpen(false);
    setPreparing(true);
    setAttachError(null);
    try {
      // Downscaled here so a 4MB camera JPEG becomes a ~250KB upload.
      setAttachment(await prepareImage(file));
      textareaRef.current?.focus();
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'That image could not be used.');
    } finally {
      setPreparing(false);
    }
  };

  const canSend = Boolean(inputText.trim()) && !disabled && !preparing;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full shrink-0"
      style={{ padding: 'clamp(8px, 2.5vw, 16px)', maxWidth: '100%' }}
    >
      <div className="w-full mx-auto relative" style={{ maxWidth: '672px' }}>
        {/* Where the photo comes from.
            Two separate inputs, because `capture` is a hint the browser cannot
            un-apply: on a phone the camera input goes straight to the camera and
            hides the gallery, so offering both needs one input of each kind. */}
        <AnimatePresence>
          {sourceMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-10"
                onClick={() => setSourceMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={spring}
                className="absolute bottom-full left-0 mb-2 z-20 w-60 card p-1.5 shadow-soft-lg"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => cameraRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl
                             hover:bg-surface-raised transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-xl grad-accent flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-extrabold text-fg-base">Take a photo</span>
                    <span className="block text-[10px] font-bold text-fg-dim">Point at the label</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => galleryRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl
                             hover:bg-surface-raised transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-xl grad-tile flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-extrabold text-fg-base">Choose a photo</span>
                    <span className="block text-[10px] font-bold text-fg-dim">From your gallery</span>
                  </div>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Attached label — shown above the composer, like a chat attachment */}
        <AnimatePresence>
          {(attachment || attachError) && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              transition={spring}
              className="overflow-hidden"
            >
              <div className="mb-2 flex items-center gap-2.5 card p-2 pr-3">
                {attachment ? (
                  <>
                    <img
                      src={attachment.dataUrl}
                      alt="Attached nutrition label"
                      className="w-10 h-10 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold text-fg-base leading-tight">
                        Nutrition label attached
                      </p>
                      <p className="text-[10px] font-bold text-fg-dim">
                        Its figures will be used instead of an estimate
                      </p>
                    </div>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setAttachment(null)}
                      aria-label="Remove attachment"
                      className="p-1.5 text-fg-dim hover:text-fg-base shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold text-fg-muted flex-1">{attachError}</p>
                    <button
                      type="button"
                      onClick={() => setAttachError(null)}
                      className="p-1.5 text-fg-dim shrink-0"
                      aria-label="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={{
            scale: focused ? 1.01 : 1,
            boxShadow: focused
              ? '0 0 0 1px rgba(255, 255, 255, 0.12), 0 10px 34px rgba(255, 255, 255, 0.07)'
              : '0 10px 34px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4)',
          }}
          transition={spring}
          className={`relative flex items-end bg-surface-card rounded-4xl border-2 min-w-0
                      transition-colors duration-200 ${focused ? 'border-white/30' : 'border-white/[0.07]'}`}
        >
          {allowAttachments && (
            <>
              <motion.button
                type="button"
                onClick={() => setSourceMenuOpen((v) => !v)}
                disabled={disabled || preparing}
                aria-label="Attach a nutrition label"
                aria-expanded={sourceMenuOpen}
                aria-haspopup="menu"
                whileTap={{ scale: 0.9 }}
                animate={{ rotate: sourceMenuOpen ? 45 : 0 }}
                transition={spring}
                className="absolute left-2 bottom-2 rounded-full flex items-center justify-center shrink-0
                           bg-surface-raised text-fg-muted hover:text-accent disabled:opacity-40
                           transition-colors duration-200"
                style={{ width: 'var(--avatar-sm)', height: 'var(--avatar-sm)', aspectRatio: '1' }}
              >
                {preparing ? (
                  <Loader2 style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="animate-spin" />
                ) : (
                  <ImagePlus style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} strokeWidth={2.2} />
                )}
              </motion.button>

              {/* Camera: `capture` asks the phone for the rear camera directly. */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              {/* Gallery: no `capture`, so the browser offers the picker. */}
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
            </>
          )}

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={attachment ? 'What did you eat, and how much?' : 'I ate 2 bananas and 3 eggs…'}
            rows={1}
            disabled={disabled}
            aria-label="Describe what you ate"
            className="w-full bg-transparent text-fg-strong placeholder-fg-dim font-semibold
                       focus:outline-none resize-none leading-relaxed self-center disabled:opacity-60"
            style={{
              paddingTop: 'clamp(12px, 2.6vw, 16px)',
              paddingBottom: 'clamp(12px, 2.6vw, 16px)',
              // Leaves room for the attach button when it is shown.
              paddingLeft: allowAttachments ? 'clamp(52px, 12vw, 62px)' : 'clamp(16px, 3.6vw, 22px)',
              paddingRight: 'clamp(52px, 12vw, 62px)',
              fontSize: 'var(--fs-sm)',
              minHeight: 'clamp(48px, 9vw, 58px)',
            }}
          />

          <motion.button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            animate={{ scale: canSend ? 1 : 0.86, opacity: canSend ? 1 : 0.55 }}
            whileHover={canSend ? { scale: 1.1 } : undefined}
            whileTap={canSend ? { scale: 0.9 } : undefined}
            transition={spring}
            className={`absolute right-2 bottom-2 rounded-full flex items-center justify-center shrink-0
                        transition-colors duration-200 ${
                          canSend ? 'grad-accent shadow-glow' : 'bg-surface-raised text-fg-dim'
                        }`}
            style={{ width: 'var(--avatar-sm)', height: 'var(--avatar-sm)', aspectRatio: '1' }}
          >
            <ArrowUp style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} strokeWidth={2.6} />
          </motion.button>
        </motion.div>
      </div>
    </form>
  );
};
