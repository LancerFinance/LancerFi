import { MapPin } from "lucide-react";

const AnnouncementBar = () => {
  return (
    <div className="w-full bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
        <p className="text-[13px] sm:text-sm font-medium tracking-tight">
          24/7 Escrow Protection on Solana • Trustless Payments with USDC
        </p>
        <button className="hidden sm:flex items-center gap-2 text-[13px] font-medium opacity-90 hover:opacity-100 transition">
          <MapPin className="w-4 h-4" />
          Global Network
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBar;
