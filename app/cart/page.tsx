export const metadata = { title: "Your Garage Manifest" };

export default function Page() {
  return (
    <div className="bg-surface-container-lowest text-on-surface font-body-md overflow-x-hidden selection:bg-secondary selection:text-on-secondary min-h-screen">
      {/* TopNavBar */}
      <header className="w-full top-0 sticky bg-surface dark:bg-surface-container-lowest border-b border-white/10 z-50">
        <div className="flex justify-between items-center w-full px-margin-desktop py-4 max-w-max-width mx-auto">
          <a className="font-headline-md text-headline-md text-secondary tracking-tighter" href="#">E-DRIFT</a>
          <nav className="hidden md:flex items-center gap-8">
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">TRIKES</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">PARTS</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">GEAR</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-secondary border-b-2 border-secondary pb-1" href="#">THE GARAGE</a>
          </nav>
          <div className="flex items-center gap-6">
            <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-all active:scale-90" data-icon="search">search</button>
            <div className="relative">
              <button className="material-symbols-outlined text-primary transition-all active:scale-90" data-icon="shopping_cart">shopping_cart</button>
              <span className="absolute -top-2 -right-2 bg-secondary text-on-secondary text-[10px] font-bold px-1.5 py-0.5 rounded-full">1</span>
            </div>
            <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-all active:scale-90" data-icon="person">person</button>
          </div>
        </div>
      </header>
      <main className="technical-grid min-h-screen pt-12 pb-24">
        <div className="max-w-max-width mx-auto px-margin-desktop">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 mb-4">
            <a className="font-label-bold text-label-bold text-on-surface-variant/60 hover:text-on-surface transition-colors" href="#">CORE</a>
            <span className="material-symbols-outlined text-on-surface-variant/40 text-sm">chevron_right</span>
            <span className="font-label-bold text-label-bold text-on-surface-variant">LOGISTICS</span>
          </nav>
          {/* Main Mission Title */}
          <div className="flex items-baseline gap-4 mb-12">
            <h1 className="font-headline-xl text-headline-xl uppercase manifest-title">MISSION LOGISTICS</h1>
            <span className="text-primary font-label-bold text-xs tracking-[0.3em] uppercase opacity-60">Status: Active Deployment</span>
          </div>
          {/* Split Screen Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* Left Column: Your Manifest */}
            <div className="lg:col-span-7 space-y-gutter" id="manifest-container">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="font-headline-md text-headline-md uppercase text-on-surface/90">YOUR MANIFEST</h2>
                <span className="text-xs font-label-bold text-on-surface-variant opacity-40 uppercase">Ref: #ED-992-ARC</span>
              </div>
              {/* Free Shipping Progress (Hazard Style) */}
              <div className="bg-surface-container-low p-6 border border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="flex justify-between items-center mb-4">
                  <p className="font-label-bold text-label-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">local_shipping</span>
                    LOGISTICS SUBSIDY TARGET
                  </p>
                  <p className="font-label-bold text-label-bold text-on-surface-variant">$1,200.00 REMAINING</p>
                </div>
                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full hazard-stripe w-3/4 relative" />
                </div>
              </div>
              {/* Manifest Items */}
              <div className="space-y-4" id="cart-items">
                {/* Item 1 */}
                <div className="bg-surface-container border border-white/10 flex gap-6 p-6 group relative">
                  <div className="w-40 h-40 bg-black overflow-hidden flex-shrink-0 border border-white/5">
                    <img className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWc0jnIfvQLoRotfwnwLeeAtM0XBgz8qMjslhzHL31hOcnzxd5ZqUia5NY9W_rOtHWYpRJ2wdRXIgUZsXccgWT1DoytTu4paxQQe4zQCZxFc5DwRwX4EnutMq7jYr12ikHYXDWcNJP8tL_g4T8kBGDhRl-ibdn9fwSRb462ZKCSYY4SWfMaRg4s9WIyNdn_xHqbpLdVqim-Lc19UxiKLRsFzCEurFTCIQFj_dvGZCjafgb9qfw7VG0iw" />
                  </div>
                  <div className="flex-grow flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="bg-secondary text-on-secondary text-[10px] font-bold px-2 py-0.5 mb-2 inline-block cut-corner">LIMITED ASSET</div>
                        <h3 className="font-headline-md text-headline-md text-on-surface uppercase leading-none">VOLTAGE BLUE DRIFT RIG</h3>
                        <p className="text-on-surface-variant font-label-bold mt-1 text-xs">SPEC: 72V BRUSHLESS BEAST</p>
                      </div>
                      <p className="font-headline-md text-headline-md text-primary">$3,499.00</p>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center bg-black/40 border border-white/10 rounded-sm">
                        <button className="px-3 py-2 hover:bg-white/5 text-on-surface-variant" data-step="down">
                          <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <input className="w-10 bg-transparent border-none text-center font-label-bold focus:ring-0 text-sm" min={1} type="number" defaultValue={1} />
                        <button className="px-3 py-2 hover:bg-white/5 text-on-surface-variant" data-step="up">
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                      </div>
                      <button className="flex items-center gap-2 text-on-surface-variant/40 hover:text-error transition-colors uppercase font-label-bold text-[10px] tracking-widest" data-remove-closest="group">
                        <span className="material-symbols-outlined text-base">delete_sweep</span>
                        PURGE
                      </button>
                    </div>
                  </div>
                </div>
                {/* Item 2 (Out of Stock Example) */}
                <div className="bg-surface-container/50 border border-white/10 flex gap-6 p-6 group relative opacity-80 grayscale">
                  <div className="w-40 h-40 bg-black overflow-hidden flex-shrink-0 border border-white/5 relative">
                    <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2nMSkgJt7KTVDS2ja6IeRwCEPdKfAmF0skcQooGjAvvTQttDJ4D3xhnrfBMKnHF3c7K7fJyUxxtREWtUidyWSyvEw5UDdXnNbeu2m-f6LT_akykWAOI2vbA6XpId2j8jRFZ20n9EPs2_nVmrjeeotppd7EqSxXjXVDEUphLqpe5X_E3sRcJZbcjuXJgKsMS6dfm7bbBI-bBx-qWhh2Po7KZfWEzRp_bksZEHawbPm2pjmJMAuTuSQaw" />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="border-2 border-error text-error font-headline-md px-4 py-1 -rotate-12 uppercase text-sm tracking-widest">DECOMMISSIONED</span>
                    </div>
                  </div>
                  <div className="flex-grow flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-headline-md text-headline-md text-on-surface-variant/60 uppercase leading-none">BRUSHLESS SPARE HUB</h3>
                        <p className="text-on-surface-variant/40 font-label-bold mt-1 text-xs">SPEC: 72V DIRECT DRIVE</p>
                      </div>
                      <p className="font-headline-md text-headline-md text-on-surface-variant/40">$420.00</p>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                      <span className="text-error font-label-bold text-[10px] uppercase tracking-widest">AWAITING RESTOCK</span>
                      <button className="flex items-center gap-2 text-on-surface-variant/40 hover:text-error transition-colors uppercase font-label-bold text-[10px] tracking-widest" data-remove-closest="group">
                        <span className="material-symbols-outlined text-base">delete_sweep</span>
                        PURGE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Empty State (Hidden by default) */}
              <div className="hidden animate-fadeIn" id="empty-garage">
                <div className="bg-surface-container relative overflow-hidden border border-white/10 rounded-lg group">
                  <img alt="Empty Workshop" className="w-full aspect-video object-cover opacity-50 group-hover:scale-105 transition-transform duration-1000" src="https://lh3.googleusercontent.com/aida/AP1WRLtUMtTahjWdiPH21ccw4ff5eZlRxZ-FEevYf0fQeCUFi7dhrrZufKZT9ZnJEu1aYkIykeowJlgBrBETy3ky8lEIhpNnt9eQ2DkGDDxgaxPq1fXbpMpraxVQOY0PPmiLuKWbYG0_mV0A4ee1gbdfVBP-oXfPBxfbd9q7pXlJYmo47FxaAhKHmoO04Nvdlw3_FrNxgla8E3AjzWFfp8CIArNL9DeSiBRpZrnAExkteBvQsVxGxaZqZrSQpkmH" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-gradient-to-t from-surface to-transparent">
                    <h2 className="font-headline-xl text-headline-xl mb-4">GARAGE IS OFFLINE</h2>
                    <p className="font-body-md text-on-surface-variant max-w-md mb-8">No active assets detected in your manifest. Return to base to select your gear.</p>
                    <a className="bg-primary px-10 py-4 font-label-bold text-on-primary uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_30px_rgba(30,91,255,0.4)]" href="#">RE-ENGAGE</a>
                  </div>
                </div>
              </div>
            </div>
            {/* Right Column: Order Logistics */}
            <aside className="lg:col-span-5 sticky top-24">
              <div className="bg-surface-container-high p-8 border border-white/10 relative overflow-hidden">
                {/* Background Technical Watermark */}
                <div className="absolute -top-10 -right-10 opacity-[0.03] rotate-12 pointer-events-none">
                  <span className="material-symbols-outlined text-[300px]">precision_manufacturing</span>
                </div>
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  <h2 className="font-headline-md text-headline-md uppercase">ORDER LOGISTICS</h2>
                </div>
                <div className="space-y-5 mb-8">
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span className="font-label-bold uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                      <span className="w-1 h-1 bg-primary rounded-full" /> SUB-TOTAL
                    </span>
                    <span className="font-label-bold">$3,919.00</span>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span className="font-label-bold uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                      <span className="w-1 h-1 bg-white/20 rounded-full" /> SHIPPING EST.
                    </span>
                    <span className="font-label-bold italic text-[10px] opacity-60">PENDING ADDRESS</span>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span className="font-label-bold uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                      <span className="w-1 h-1 bg-white/20 rounded-full" /> TAX/DUTIES
                    </span>
                    <span className="font-label-bold">$124.50</span>
                  </div>
                </div>
                {/* Calculated State Visual */}
                <div className="bg-primary/5 border border-primary/20 p-4 mb-8 flex items-center gap-4 ready-status">
                  <div className="bg-primary text-on-primary rounded-full p-1">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-bold text-primary text-[10px] uppercase tracking-widest">STATUS: READY FOR DRIFT</span>
                    <span className="text-[9px] text-primary/60 uppercase">Calculations verified by E-DRIFT core</span>
                  </div>
                </div>
                <div className="flex justify-between items-end mb-10">
                  <div>
                    <span className="font-label-bold text-on-surface-variant uppercase text-[10px] tracking-widest block mb-1">TOTAL PAYLOAD</span>
                    <span className="font-label-bold text-on-surface uppercase text-sm">CREDITS DUE</span>
                  </div>
                  <span className="font-display-lg text-primary text-headline-xl leading-none">$4,043.50</span>
                </div>
                <div className="space-y-4">
                  <button className="w-full bg-primary py-5 px-8 font-label-bold text-on-primary uppercase tracking-widest text-lg hover:bg-white transition-all active:scale-95 flex items-center justify-center gap-3 group relative overflow-hidden">
                    <span className="relative z-10">INITIATE DEPLOYMENT</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform relative z-10">rocket_launch</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-black/40 border border-white/10 py-3 flex items-center justify-center rounded hover:bg-white/5 transition-all group">
                      <span className="font-label-bold text-[10px] uppercase tracking-tighter opacity-50 group-hover:opacity-100">QUICK: APPLE PAY</span>
                    </button>
                    <button className="bg-[#ffc439] py-3 flex items-center justify-center rounded hover:brightness-110 transition-all">
                      <span className="font-label-bold text-[10px] uppercase text-black tracking-tighter">QUICK: PAYPAL</span>
                    </button>
                  </div>
                </div>
                {/* Trust Section & Transmission Footer */}
                <div className="mt-12 pt-8 border-t border-white/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-secondary-container/10 p-3 border border-secondary/20">
                      <span className="material-symbols-outlined text-secondary" style={{fontVariationSettings: '"FILL" 1'}}>encrypted</span>
                    </div>
                    <div>
                      <p className="font-label-bold text-xs uppercase text-secondary">SECURE NODE ENCRYPTION</p>
                      <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">TLS 1.3 / AES-256 PROTECTION</p>
                    </div>
                  </div>
                  <div className="bg-black/20 p-4 border border-white/5 rounded italic text-[9px] text-on-surface-variant/40 leading-relaxed uppercase tracking-tighter">
                    <span className="text-secondary opacity-60">Transmission Note:</span> All logistics data is processed through our secure hardened perimeter. Zero data persistence on local client nodes. End-to-end encrypted transmission active.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <footer className="bg-surface-container-lowest dark:bg-black w-full relative overflow-hidden border-t border-secondary/20">
        <div className="bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:20px_20px] absolute inset-0 pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-desktop py-16 gap-gutter max-w-max-width mx-auto relative z-10">
          <div>
            <span className="font-display-lg text-display-lg text-on-surface/10 absolute -bottom-4 -left-4 opacity-20 pointer-events-none">E-DRIFT</span>
            <h3 className="font-headline-md text-headline-md text-secondary mb-6">ENGINEERED FOR ADRENALINE.</h3>
            <p className="max-w-md text-on-surface-variant font-body-md">
              We push the limits of electric propulsion to deliver the ultimate street motorsport experience. High voltage, zero compromise.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-4">
              <h4 className="font-label-bold text-label-bold text-on-surface uppercase mb-4">RESOURCES</h4>
              <ul className="space-y-2">
                <li><a className="text-on-surface-variant hover:text-primary transition-colors text-body-md" href="#">Support</a></li>
                <li><a className="text-on-surface-variant hover:text-primary transition-colors text-body-md" href="#">Privacy</a></li>
                <li><a className="text-on-surface-variant hover:text-primary transition-colors text-body-md" href="#">Shipping</a></li>
                <li><a className="text-on-surface-variant hover:text-primary transition-colors text-body-md" href="#">Terms</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-label-bold text-label-bold text-on-surface uppercase mb-4">SOCIAL</h4>
              <div className="flex gap-4">
                <button className="w-10 h-10 border border-white/10 flex items-center justify-center hover:border-secondary hover:text-secondary transition-all active:opacity-80">
                  <span className="material-symbols-outlined text-lg">share_reviews</span>
                </button>
                <button className="w-10 h-10 border border-white/10 flex items-center justify-center hover:border-secondary hover:text-secondary transition-all active:opacity-80">
                  <span className="material-symbols-outlined text-lg">movie</span>
                </button>
                <button className="w-10 h-10 border border-white/10 flex items-center justify-center hover:border-secondary hover:text-secondary transition-all active:opacity-80">
                  <span className="material-symbols-outlined text-lg">podcasts</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 py-8 text-center relative z-10">
          <p className="font-label-bold text-on-surface-variant/40 text-xs tracking-[0.2em]">© 2024 E-DRIFT MOTORS. MISSION CRITICAL INTERFACE.</p>
        </div>
      </footer>
    </div>
  );
}
