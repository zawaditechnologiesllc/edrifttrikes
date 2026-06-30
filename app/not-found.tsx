export default function NotFound() {
  return (
    <div className="bg-background text-on-surface font-body-md overflow-x-hidden min-h-screen">
      {/* TopNavBar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-background/95 backdrop-blur-md">
        <nav className="flex justify-between items-center px-margin-mobile md:px-margin-desktop py-4 max-w-max-width mx-auto">
          <div className="font-headline-md text-headline-md text-secondary uppercase italic tracking-tighter">
            VOLT DRIFT
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a className="font-body-md text-on-surface-variant hover:text-secondary duration-300 transition-colors uppercase tracking-widest text-sm" href="#">Trikes</a>
            <a className="font-body-md text-on-surface-variant hover:text-secondary duration-300 transition-colors uppercase tracking-widest text-sm" href="#">Upgrades</a>
            <a className="font-body-md text-on-surface-variant hover:text-secondary duration-300 transition-colors uppercase tracking-widest text-sm" href="#">Gear</a>
            <a className="font-body-md text-on-surface-variant hover:text-secondary duration-300 transition-colors uppercase tracking-widest text-sm" href="#">Tech</a>
            <a className="font-body-md text-on-surface-variant hover:text-secondary duration-300 transition-colors uppercase tracking-widest text-sm" href="#">Garage</a>
          </div>
          <div className="flex items-center gap-4 text-primary">
            <button className="material-symbols-outlined hover:text-secondary transition-all active:skew-x-[-12deg]" data-icon="shopping_cart">shopping_cart</button>
            <button className="material-symbols-outlined hover:text-secondary transition-all active:skew-x-[-12deg]" data-icon="account_circle">account_circle</button>
          </div>
        </nav>
      </header>
      <main className="relative min-h-screen flex items-center justify-center pt-20">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/90 z-10" />
          <div className="absolute inset-0 bg-black/60 z-10 backdrop-blur-sm" />
          <div className="absolute inset-0 opacity-40 z-0" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida/AP1WRLuHgQ0BmBrdPK5lfcRXc3tbbZOeBTW_Nq2jInp3WliSPMH7FG4_OggE20QGCMOUWIZZ9ImNat9NOx8LDgGbX2fITmpEWiVRL8OTCuA2RtxROiomBqOGVqFpVydNT5ZXfzWXRMCDZoY25fKI1Jt3DxX8WKwylqDvGFNjQ3ko5amktzj9iY9pb4XsX6Lbmr61NsVIGPAYkW1ehiinQWJFhr6FwGrtxY7YLdsFXkmpHhRYqOF2O-ncFsSQ43w")', backgroundSize: 'cover', backgroundPosition: 'center'}} />
          {/* Technical Grid Overlay */}
          <div className="absolute inset-0 z-[5] opacity-10 pointer-events-none" style={{backgroundImage: 'linear-gradient(#b7c4ff 1px, transparent 1px), linear-gradient(90deg, #b7c4ff 1px, transparent 1px)', backgroundSize: '40px 40px'}}>
          </div>
          <div className="scanline z-20" />
        </div>
        {/* Content Canvas */}
        <div className="relative z-30 max-w-4xl mx-auto px-margin-mobile text-center">
          <div className="inline-block px-4 py-1 mb-6 border border-secondary text-secondary font-label-bold uppercase tracking-[0.2em] text-xs skew-x-[-12deg]">
            System Error: Sector 404
          </div>
          <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-white mb-6 uppercase italic text-glow leading-none">
            404 - YOU DRIFTED <br /> <span className="text-secondary">OFF THE TRACK</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-12">
            The schematic you're looking for has been decommissioned or moved to a new sector. 
            Your current trajectory has exceeded safety parameters.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <a className="group relative inline-flex items-center justify-center px-10 py-4 bg-secondary text-on-secondary font-label-bold uppercase tracking-widest rounded-lg transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(196,247,49,0.3)] glitch-hover overflow-hidden" href="/">
              <span className="relative z-10">REGAIN CONTROL</span>
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-[-20deg]" />
            </a>
            <div className="flex items-center gap-4">
              <a className="px-6 py-4 border border-white/20 text-white font-label-bold uppercase tracking-widest rounded-lg hover:border-primary hover:text-primary transition-all duration-300" href="#">
                Trikes
              </a>
              <a className="px-6 py-4 border border-white/20 text-white font-label-bold uppercase tracking-widest rounded-lg hover:border-primary hover:text-primary transition-all duration-300" href="#">
                The Tech Lab
              </a>
            </div>
          </div>
          {/* Decorative 15-degree lines */}
          <div className="mt-24 flex justify-center gap-2 opacity-30">
            <div className="h-1 w-20 bg-secondary skew-x-[-45deg]" />
            <div className="h-1 w-8 bg-primary skew-x-[-45deg]" />
            <div className="h-1 w-4 bg-secondary skew-x-[-45deg]" />
          </div>
        </div>
        {/* Technical Sidebar (Right) */}
        <div className="hidden lg:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col gap-4 items-end z-40 opacity-50">
          <div className="text-[10px] font-mono text-primary tracking-[0.3em] uppercase vertical-text transform rotate-180" style={{writingMode: 'vertical-rl'}}>
            Coordinates: 0.0.0.0 // ERR_PATH_UNDEFINED
          </div>
          <div className="w-px h-32 bg-gradient-to-b from-transparent via-primary to-transparent" />
          <div className="text-[10px] font-mono text-secondary tracking-[0.3em] uppercase">
            STATUS: DISCONNECTED
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full mt-margin-desktop border-t border-white/10 bg-surface-container-lowest">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop py-16 max-w-max-width mx-auto">
          <div className="col-span-1 md:col-span-2">
            <div className="font-headline-md text-headline-md text-on-surface uppercase italic mb-4">VOLT DRIFT</div>
            <p className="text-on-surface-variant max-w-sm mb-8 font-body-md">
              Engineered for high-performance electric drifting. Raw energy meet precision engineering.
            </p>
            <div className="text-on-surface-variant font-body-md opacity-50">
              © 2024 VOLT DRIFT ENGINEERING. ALL RIGHTS RESERVED.
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="text-white font-label-bold uppercase tracking-widest mb-2">Navigation</div>
            <a className="text-on-surface-variant hover:text-secondary transition-all hover:translate-x-1 font-body-md" href="#">Manuals</a>
            <a className="text-on-surface-variant hover:text-secondary transition-all hover:translate-x-1 font-body-md" href="#">Safety Data</a>
            <a className="text-on-surface-variant hover:text-secondary transition-all hover:translate-x-1 font-body-md" href="#">Battery Tech</a>
          </div>
          <div className="flex flex-col gap-4">
            <div className="text-white font-label-bold uppercase tracking-widest mb-2">Support</div>
            <a className="text-on-surface-variant hover:text-secondary transition-all hover:translate-x-1 font-body-md" href="#">Shipping</a>
            <a className="text-on-surface-variant hover:text-secondary transition-all hover:translate-x-1 font-body-md" href="#">Warranty</a>
            <a className="text-on-surface-variant hover:text-secondary transition-all hover:translate-x-1 font-body-md" href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
