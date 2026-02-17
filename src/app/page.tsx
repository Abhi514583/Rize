import Link from "next/link";
import Leaderboard from "~/components/Leaderboard";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-6 space-y-16 max-w-lg mx-auto">
      <div className="flex flex-col items-center text-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="relative">
          <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-50" />
          <h1 className="text-9xl font-black tracking-tighter italic text-gradient relative drop-shadow-2xl">
            RIZE
          </h1>
        </div>
        <p className="text-sm font-black opacity-40 uppercase tracking-[0.4em] translate-x-1">
          Evolution of Effort
        </p>
      </div>

      <Link 
        href="/workout"
        className="w-full animate-in fade-in slide-in-from-bottom-12 delay-200 duration-700 fill-mode-both"
      >
        <button className="w-full py-8 bg-primary text-white font-black text-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-tight relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <span className="relative z-10">Start Workout</span>
        </button>
      </Link>

      <div className="w-full animate-in fade-in slide-in-from-bottom-16 delay-400 duration-700 fill-mode-both">
        <Leaderboard />
      </div>
    </div>
  );
}
