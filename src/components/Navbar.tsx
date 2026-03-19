export default function Navbar() {
  return (
    <header className="w-full py-6 px-8 flex items-center justify-between z-50 fixed top-0 bg-[#050505]/80 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-400 flex items-center justify-center p-0.5">
          <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </div>
        </div>
        <span className="text-2xl font-black tracking-widest text-white">MONSTA<span className="text-cyan-400">JAM</span></span>
      </div>

      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
        <a className="hover:text-white transition-colors" href="#">Beats</a>
        <a className="hover:text-white transition-colors" href="#">Featured</a>
        <a className="hover:text-white transition-colors" href="#">Community</a>
        <a className="hover:text-white transition-colors" href="#">Contact</a>
      </nav>

      <div className="flex items-center gap-6">
        <a className="text-sm font-medium text-gray-300 hover:text-white transition-colors" href="#">Log In</a>
        <a className="px-5 py-2 rounded-full border border-white/20 text-sm font-medium hover:bg-white hover:text-black transition-all" href="#">Sign Up</a>
      </div>
    </header>
  );
}
