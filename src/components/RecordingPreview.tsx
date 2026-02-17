export default function RecordingPreview() {
  return (
    <div className="w-full mb-8">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Workout Recording</h3>
      <div className="aspect-video w-full glass rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-white/10 relative overflow-hidden group">
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-6 py-2 rounded-full font-bold cursor-pointer transition-all">
            Download Preview
          </span>
        </div>
        <div className="flex flex-col items-center gap-2 opacity-40">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium">Recording preview will appear here</span>
        </div>
      </div>
    </div>
  );
}
