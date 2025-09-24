import React, { useEffect, useRef } from "react";

interface BottomSheetPopupProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const BottomSheetPopup: React.FC<BottomSheetPopupProps> = ({
  open,
  onClose,
  children,
  className = "",
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Prevent body scroll when popup is open
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && sheetRef.current) {
      // Focus the sheet for accessibility
      sheetRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-all duration-300 ease-out"
        style={{
          opacity: open ? 1 : 0,
        }}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`relative w-full max-w-md mx-auto bg-[#1A1A1A] rounded-t-3xl shadow-2xl p-6 border-t border-[#2A2A2A] ${className}`}
        style={{
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        tabIndex={-1}
      >
        {/* Drag handle */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-600 rounded-full opacity-50" />
        {children}
      </div>
    </div>
  );
};
