export default function ScrollIndicator() {
  return (
    <div className="hidden flex-col items-center justify-center gap-2 pb-16 text-xs tracking-widest text-gray-500 md:flex">
      <span>SCROLL</span>
      <svg className="w-4 h-4 animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
      </svg>
    </div>
  );
}
