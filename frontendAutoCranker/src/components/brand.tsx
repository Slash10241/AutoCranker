import logoImg from "@/assets/logo.png";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logoImg}
        alt="AutoCranker logo"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-md object-contain"
      />
      <span className="font-display text-xl font-bold tracking-tight" style={{ fontFamily: "Syne, sans-serif" }}>
        Auto<span className="text-amber">Cranker</span>
      </span>
    </div>
  );
}
