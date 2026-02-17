const leaderboardData = [
  { rank: 1, country: "Canada", flag: "🇨🇦", score: 12480, color: "text-amber-400" },
  { rank: 2, country: "India", flag: "🇮🇳", score: 11932, color: "text-slate-300" },
  { rank: 3, country: "USA", flag: "🇺🇸", score: 10203, color: "text-amber-600" },
  { rank: 4, country: "UK", flag: "🇬🇧", score: 9845, color: "text-slate-400" },
  { rank: 5, country: "Brazil", flag: "🇧🇷", score: 8721, color: "text-slate-400" },
  { rank: 12, country: "Japan", flag: "🇯🇵", score: 4532, color: "text-primary" },
];

export default function Leaderboard() {
  const top5 = leaderboardData.slice(0, 5);
  const userCountry = leaderboardData.find(c => c.country === "Japan");
  const isUserInTop5 = top5.some(c => c.country === "Japan");

  return (
    <div className="w-full max-w-md glass rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-primary/20 transition-colors" />
      
      <div className="flex justify-between items-center mb-8 relative">
        <h2 className="text-2xl font-black italic tracking-tight">World Stats</h2>
        <div className="flex items-center gap-1.5 glass px-3 py-1 rounded-full border-white/5">
          <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Live</span>
        </div>
      </div>
      
      <div className="space-y-3 relative">
        {top5.map((item) => (
          <div key={item.rank} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 card-hover cursor-default">
            <div className="flex items-center gap-4">
              <span className={`text-lg font-black w-6 ${item.color}`}>{item.rank}</span>
              <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{item.flag}</span>
              <span className="font-bold tracking-tight">{item.country}</span>
            </div>
            <span className="font-black tabular-nums text-primary">{item.score.toLocaleString()}</span>
          </div>
        ))}

        {!isUserInTop5 && userCountry && (
          <>
            <div className="flex items-center justify-center py-1 opacity-20">
              <div className="h-px bg-white w-full mx-8" />
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20 card-hover cursor-default">
              <div className="flex items-center gap-4">
                <span className="text-lg font-black w-6 text-primary">{userCountry.rank}</span>
                <span className="text-2xl">{userCountry.flag}</span>
                <div className="flex flex-col">
                  <span className="font-bold tracking-tight">{userCountry.country}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Your Country</span>
                </div>
              </div>
              <span className="font-black tabular-nums text-primary">{userCountry.score.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
      
      <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-sm border-white/10 group-hover:scale-110 transition-transform">
            {userCountry?.flag}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Local Sub-Division</span>
            <span className="text-[13px] font-bold">Tokyo</span>
          </div>
        </div>
        <button className="text-[11px] font-black text-primary hover:text-white transition-colors uppercase tracking-widest bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
          Rankings
        </button>
      </div>
    </div>
  );
}
