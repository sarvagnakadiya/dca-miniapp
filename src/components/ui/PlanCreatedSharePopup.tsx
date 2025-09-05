import React from "react";
import Image from "next/image";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { useMiniApp } from "../providers/FrameProvider";

interface PlanCreatedSharePopupProps {
  open: boolean;
  onClose: () => void;
  tokenSymbol: string;
  frequencyLabel: string;
}

const IMAGES = [
  "/dca1.png",
  "/dca2.png",
  "/dca3.png",
  "/dca4.png",
  "/dca5.png",
] as const;

export const PlanCreatedSharePopup: React.FC<PlanCreatedSharePopupProps> = ({
  open,
  onClose,
  tokenSymbol,
  frequencyLabel,
}) => {
  const { openUrl } = useMiniApp();
  const [imageIndex, setImageIndex] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % IMAGES.length);
    }, 400);
    return () => clearInterval(interval);
  }, [open]);

  const handleShare = async () => {
    const text = `I started my DCA journey on $${tokenSymbol.toUpperCase()}.\nInvest smartly. Stop watching, start stacking.`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(
      text
    )}&embeds[]=${encodeURIComponent("https://dca-miniapp.vercel.app/")}`;
    await openUrl(url);
  };

  return (
    <BottomSheetPopup open={open} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-2xl font-semibold text-white">
          Plan Created 🎉
        </span>
        <button className="text-orange-400 text-lg" onClick={onClose}>
          × Close
        </button>
      </div>
      <div className="w-full flex justify-center m-4">
        <div className="border-2 border-orange-500 p-4 rounded-full">
          <Image
            src={IMAGES[imageIndex]}
            alt="DCA logo"
            width={80}
            height={80}
            className="w-20 h-20"
            priority
          />
        </div>
      </div>
      <div className="space-y-3 mb-6">
        <p className="text-gray-300 text-sm">
          DCA is one of the most proven ways to stay consistent and smooth out
          market swings.
        </p>
        <p className="text-gray-400 text-sm">
          {tokenSymbol} will be invested{" "}
          {frequencyLabel.toLowerCase().includes("minute") ||
          frequencyLabel.toLowerCase().includes("hour")
            ? `every ${frequencyLabel}`
            : frequencyLabel}
          .
        </p>
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full"
        onClick={handleShare}
      >
        Share my DCA journey
      </Button>
      {/* no rotation */}
    </BottomSheetPopup>
  );
};

export default PlanCreatedSharePopup;
