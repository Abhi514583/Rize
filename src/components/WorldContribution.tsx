interface WorldContributionProps {
  reps: number;
}

export default function WorldContribution({ reps }: WorldContributionProps) {
  return (
    <div className="w-full glass rounded-2xl p-6 mb-8 text-center space-y-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-3xl">🇨🇦</span>
        <p className="text-sm font-medium">
          <span className="text-primary font-bold">+{reps}</span> reps added to Canada
        </p>
      </div>
      <div className="text-xs text-muted-foreground">
        Canada total today: <span className="text-foreground font-bold font-mono">12,514</span>
      </div>
      
      <div className="pt-4 border-t border-white/5">
        <button 
          onClick={() => {
            const text = `I did ${reps} pushups. Added to 🇨🇦 Canada. Beat me: rize.gg`;
            navigator.clipboard.writeText(text);
            alert("Score copied to clipboard!");
          }}
          className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl transition-all"
        >
          SHARE SCORE
        </button>
      </div>
    </div>
  );
}
