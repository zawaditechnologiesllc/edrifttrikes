export const metadata = { title: "Your Parts Bin" };

export default function Page() {
  return (
    <div className="bg-background text-on-background font-body-md selection:bg-secondary selection:text-on-secondary min-h-screen">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-background/95 backdrop-blur-md">
        <div className="flex justify-between items-center px-margin-desktop py-4 max-w-max-width mx-auto">
          <a className="font-headline-md text-headline-md text-secondary uppercase italic" href="#">VOLT DRIFT</a>
          <div className="hidden md:flex items-center gap-8">
            <a className="font-headline-md text-headline-md tracking-tighter text-on-surface-variant hover:text-secondary duration-300 transition-colors" href="#">Trikes</a>
            <a className="font-headline-md text-headline-md tracking-tighter text-on-surface-variant hover:text-secondary duration-300 transition-colors" href="#">Upgrades</a>
            <a className="font-headline-md text-headline-md tracking-tighter text-on-surface-variant hover:text-secondary duration-300 transition-colors" href="#">Gear</a>
            <a className="font-headline-md text-headline-md tracking-tighter text-on-surface-variant hover:text-secondary duration-300 transition-colors" href="#">Tech</a>
            <a className="font-headline-md text-headline-md tracking-tighter text-secondary border-b-2 border-secondary pb-1 active:skew-x-[-12deg] transition-transform" href="#">Garage</a>
          </div>
          <div className="flex items-center gap-6">
            <button className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-colors" data-icon="shopping_cart">shopping_cart</button>
            <button className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-colors" data-icon="account_circle">account_circle</button>
          </div>
        </div>
      </nav>
      <main className="pt-32 pb-16 min-h-screen technical-grid">
        <div className="max-w-max-width mx-auto px-margin-desktop">
          {/* Page Header */}
          <header className="mb-12 relative">
            <div className="flex items-baseline gap-4 mb-2">
              <h1 className="font-display-lg text-display-lg uppercase tracking-tighter">YOUR PARTS BIN</h1>
              <span className="text-secondary font-label-bold px-3 py-1 border border-secondary/30 bg-secondary/5 skew-x-[-12deg]">MANIFEST v2.4</span>
            </div>
            <div className="w-24 h-1 bg-secondary" />
            <p className="mt-6 text-on-surface-variant max-w-xl font-body-lg">Review your saved technical configurations, performance components, and chassis drafts. Ready for assembly.</p>
          </header>
          {/* Parts List (Technical Manifest Layout) */}
          <div className="grid grid-cols-1 gap-gutter" id="parts-container">
            {/* Item 1: VOLT-S1 Pro */}
            <div className="group relative bg-surface-container-low border border-white/10 p-6 flex flex-col md:flex-row gap-8 items-center hover:border-secondary/50 transition-all duration-300 overflow-hidden">
              {/* Technical ID Background Decor */}
              <div className="absolute top-4 right-4 font-headline-md text-6xl opacity-[0.03] select-none pointer-events-none">S1-P01</div>
              <div className="w-full md:w-80 h-56 bg-surface-container-lowest overflow-hidden flex items-center justify-center border border-white/5 relative">
                <img alt="VOLT-S1 Pro Side Profile" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida/AP1WRLtjcqP-c2qViuGZXkFfknrhIldv6fowsfOK6rICSRyVHo2O1BCDvxCUM1Kstt0YMANZSRJpLNJ_NkKCxpBR2y80gQkZOXl89GoffTtXn0Wr_VGahtmdDdemhiRkc1_8qebnndrmqB9uEBMjnCSpMUfMu3CVVxe2_H-DsGQI1JLYnsqJ7fcSzFXiOv9IPR-be7eCfmKZEpdPpiS3dlEXLDe_0ihCkbBBXNF_m5hvSzmb6Czu_bhrau_Pbrw" />
                <div className="absolute bottom-2 left-2 bg-secondary text-on-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-widest">SAVED CONFIG</div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-headline-md text-headline-md leading-none mb-1">VOLT-S1 PRO</h3>
                    <p className="text-secondary font-label-bold text-xs">CHASSIS / ELECTRIC DRIFT TRIKE</p>
                  </div>
                  <span className="font-headline-md text-headline-md text-on-surface">$3,499.00</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 border-y border-white/5">
                  <div className="space-y-1">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Motor</p>
                    <p className="text-sm font-bold">5000W BLDC</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Battery</p>
                    <p className="text-sm font-bold">72V 40Ah Carbon</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Colorway</p>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-secondary rounded-full" />
                      <p className="text-sm font-bold">Voltage Blue</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 pt-2">
                  <button className="bg-secondary text-on-secondary px-8 py-3 font-label-bold uppercase flex items-center gap-2 hover:bg-secondary/90 transition-all active:scale-95">
                    <span className="material-symbols-outlined text-lg" data-icon="build">build</span>
                    ADD TO BUILD
                  </button>
                  <button className="border border-white/20 text-on-surface px-6 py-3 font-label-bold uppercase flex items-center gap-2 hover:bg-white/5 transition-all group/btn">
                    <span className="material-symbols-outlined text-lg group-hover/btn:text-error transition-colors" data-icon="delete">delete</span>
                    REMOVE
                  </button>
                </div>
              </div>
            </div>
            {/* Item 2: Performance Sleeves */}
            <div className="group relative bg-surface-container-low border border-white/10 p-6 flex flex-col md:flex-row gap-8 items-center hover:border-secondary/50 transition-all duration-300 overflow-hidden">
              <div className="absolute top-4 right-4 font-headline-md text-6xl opacity-[0.03] select-none pointer-events-none">ACC-X2</div>
              <div className="w-full md:w-80 h-56 bg-surface-container-lowest overflow-hidden flex items-center justify-center border border-white/5 relative">
                <img alt="Performance Sleeves and Motor" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida/AP1WRLuC11uU24NY8tt_G8g5ZXCZCkUFo0BJp5bFdRu4f1vp5qnn89hzzYaeH50T79MF5iS6dAxpddAvtFEzxS7MTv7rqfEPkCSqqyAN7T08iGTmE-_y5GKIZodTHrUfbLSlfXs1VstHec2rxh0NgzMJ_AXnsrafFKha841LV6zq9qB9YBXfyXYKnlDn_2nSzzYRI8RDPEqlTuWaNpoZKv5EFauwshJrYO511D5OtF1he-pSxGSWjZAM3J4APqLf" />
                <div className="absolute top-2 left-2 bg-primary text-on-primary px-2 py-1 text-[10px] font-bold uppercase tracking-widest">IN STOCK</div>
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-headline-md text-headline-md leading-none mb-1">PERFORMANCE SLEEVES</h3>
                    <p className="text-secondary font-label-bold text-xs">UPGRADE / REAR SLIDERS</p>
                  </div>
                  <span className="font-headline-md text-headline-md text-on-surface">$245.00</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 border-y border-white/5">
                  <div className="space-y-1">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Material</p>
                    <p className="text-sm font-bold">Custom PVC Mix</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Quantity</p>
                    <p className="text-sm font-bold">1 Set (2 Sleeves)</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Compatibility</p>
                    <p className="text-sm font-bold">S1, S1-Pro, GT</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 pt-2">
                  <button className="bg-secondary text-on-secondary px-8 py-3 font-label-bold uppercase flex items-center gap-2 hover:bg-secondary/90 transition-all active:scale-95">
                    <span className="material-symbols-outlined text-lg" data-icon="shopping_cart">shopping_cart</span>
                    ADD TO BUILD
                  </button>
                  <button className="border border-white/20 text-on-surface px-6 py-3 font-label-bold uppercase flex items-center gap-2 hover:bg-white/5 transition-all group/btn">
                    <span className="material-symbols-outlined text-lg group-hover/btn:text-error transition-colors" data-icon="delete">delete</span>
                    REMOVE
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Empty State (Hidden by default, shown via JS if list empty) */}
          <div className="hidden py-32 flex flex-col items-center justify-center text-center space-y-8 border-2 border-dashed border-white/10 bg-surface-container-lowest/50" id="empty-state">
            <div className="w-24 h-24 rounded-full border-2 border-secondary/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-secondary" data-icon="inventory_2">inventory_2</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md uppercase mb-2">Your bin is empty.</h2>
              <p className="text-on-surface-variant">Your technical manifest currently contains no saved configurations.</p>
            </div>
            <a className="bg-secondary text-on-secondary px-12 py-4 font-label-bold uppercase hover:bg-secondary/80 transition-all skew-x-[-12deg]" href="#">
              Start your build
            </a>
          </div>
          {/* Summary Bar */}
          <div className="mt-12 bg-surface-container-high p-8 flex flex-col md:flex-row justify-between items-center gap-8 border-l-4 border-secondary">
            <div className="flex gap-12">
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-1">Manifest Items</p>
                <p className="font-headline-md text-headline-md leading-none" id="item-count">02</p>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-1">Estimated Value</p>
                <p className="font-headline-md text-headline-md leading-none text-secondary">$3,744.00</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button className="bg-on-surface text-background px-10 py-4 font-label-bold uppercase hover:bg-white transition-all">CHECKOUT ALL</button>
              <button className="border border-secondary text-secondary px-6 py-4 font-label-bold uppercase hover:bg-secondary/10 transition-all">EXPORT SPEC</button>
            </div>
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full mt-margin-desktop border-t border-white/10 bg-surface-container-lowest">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-desktop py-16 max-w-max-width mx-auto">
          <div className="col-span-1 md:col-span-1">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-6 uppercase italic">VOLT DRIFT</h2>
            <p className="text-on-surface-variant font-body-md pr-8">
              High-performance electric drifting equipment. Engineered for precision, designed for the street.
            </p>
          </div>
          <div>
            <h4 className="font-label-bold text-secondary uppercase mb-6 tracking-widest">Engineering</h4>
            <ul className="space-y-4">
              <li><a className="text-body-md text-on-surface-variant hover:text-on-surface transition-all hover:translate-x-1 inline-block" href="#">Manuals</a></li>
              <li><a className="text-body-md text-on-surface-variant hover:text-on-surface transition-all hover:translate-x-1 inline-block" href="#">Safety Data</a></li>
              <li><a className="text-body-md text-on-surface-variant hover:text-on-surface transition-all hover:translate-x-1 inline-block" href="#">Battery Tech</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-label-bold text-secondary uppercase mb-6 tracking-widest">Support</h4>
            <ul className="space-y-4">
              <li><a className="text-body-md text-on-surface-variant hover:text-on-surface transition-all hover:translate-x-1 inline-block" href="#">Shipping</a></li>
              <li><a className="text-body-md text-on-surface-variant hover:text-on-surface transition-all hover:translate-x-1 inline-block" href="#">Warranty</a></li>
              <li><a className="text-body-md text-on-surface-variant hover:text-on-surface transition-all hover:translate-x-1 inline-block" href="#">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-label-bold text-secondary uppercase mb-6 tracking-widest">Newsletter</h4>
            <div className="relative">
              <input className="w-full bg-background border border-white/10 py-3 px-4 text-sm font-label-bold focus:border-secondary outline-none rounded-none" placeholder="EMAIL@DOMAIN.COM" type="email" />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary">
                <span className="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
        <div className="px-margin-desktop py-8 border-t border-white/5 text-center">
          <p className="text-on-surface-variant font-body-md opacity-50">© 2024 VOLT DRIFT ENGINEERING. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
}
