interface ResultSummaryProps {
  reps: number;
  duration: number;
}

export default function ResultSummary({ reps, duration }: ResultSummaryProps) {
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full flex flex-col items-center gap-2 mb-8">
      <h2 className="text-muted-foreground uppercase tracking-widest text-sm font-bold">Workout Complete</h2>
      <div className="flex items-baseline gap-2">
        <span className="text-8xl font-black text-primary leading-none">{reps}</span>
        <span className="text-3xl font-bold uppercase tracking-tighter">Reps</span>
      </div>
      <p className="text-lg font-medium opacity-80">Duration: {formatDuration(duration)}</p>
    </div>
  );
}
