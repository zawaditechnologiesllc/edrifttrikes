export const metadata = { title: "Volt S1 Pro" };

export default function Page() {
  return (
    <div className="bg-surface text-on-surface font-body-md selection:bg-secondary selection:text-on-secondary min-h-screen">
      {/* TopNavBar */}
      <header className="w-full top-0 sticky z-50 bg-surface/80 backdrop-blur-md border-b border-white/10">
        <nav className="flex justify-between items-center w-full px-margin-desktop py-4 max-w-max-width mx-auto">
          <div className="font-headline-md text-headline-md text-secondary tracking-tighter uppercase">E-DRIFT</div>
          <div className="hidden md:flex gap-8 items-center">
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors active:scale-95 duration-75" href="#">TRIKES</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors active:scale-95 duration-75" href="#">PARTS</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors active:scale-95 duration-75" href="#">GEAR</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors active:scale-95 duration-75" href="#">THE GARAGE</a>
          </div>
          <div className="flex items-center gap-6 text-primary dark:text-primary-fixed-dim">
            <button className="material-symbols-outlined hover:bg-white/5 p-2 rounded-full transition-all">shopping_cart</button>
            <button className="material-symbols-outlined hover:bg-white/5 p-2 rounded-full transition-all">person</button>
          </div>
        </nav>
      </header>
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-12">
        {/* PDP TOP SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left: Asymmetrical Gallery */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-6 grid-rows-6 gap-4 h-[700px]">
              <div className="col-span-4 row-span-4 bg-surface-container-low rounded-xl overflow-hidden border border-white/5 relative group">
                <img alt="VOLT-S1 Main" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida/AP1WRLtjcqP-c2qViuGZXkFfknrhIldv6fowsfOK6rICSRyVHo2O1BCDvxCUM1Kstt0YMANZSRJpLNJ_NkKCxpBR2y80gQkZOXl89GoffTtXn0Wr_VGahtmdDdemhiRkc1_8qebnndrmqB9uEBMjnCSpMUfMu3CVVxe2_H-DsGQI1JLYnsqJ7fcSzFXiOv9IPR-be7eCfmKZEpdPpiS3dlEXLDe_0ihCkbBBXNF_m5hvSzmb6Czu_bhrau_Pbrw" />
                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-secondary text-on-secondary font-label-bold text-xs py-1 px-3 rounded uppercase tracking-wider">High Performance</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              </div>
              <div className="col-span-2 row-span-2 bg-surface-container-low rounded-xl overflow-hidden border border-white/5 group">
                <img alt="Control detail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="https://lh3.googleusercontent.com/aida/AP1WRLtB3NxpC2pPy_HOuqqgxeOkBY0kIsCh4-STnwhxLxVDdzJQ701CZBxUTY9OIXXslyVNf5UGEeOPWHWWD56FzmonD4ftjgmfULAgM9m42k-n_PrJAF2HzTLBhJewPO-bj3-BVqqjGCVTN31hBB0ieFF2Vn_JPsaM9W0tV4gf2WeiW84aTraOnNniBHKP2Tgn0AZmIe86scFiV5Pug61swZchGelGZXARsoHGGeqZjQS6bWxMFudvZeTdpvsG" />
              </div>
              <div className="col-span-2 row-span-2 bg-surface-container-low rounded-xl overflow-hidden border border-white/5 group">
                <img alt="Wheel detail" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="https://lh3.googleusercontent.com/aida/AP1WRLs5ZaM9RPZ6LzV__jLKdPJd4gEtlr2ugog5HEhNbzUY5WI0of540x8OVs3E2ZjjiPxLq9vaup44QwKn-vAVAAzPvTRTnRHvi4qe6H-bD_yMTpkcE6phxtMRLyw_MX1xf_JjQHvqRtvncHBBxfebQ2JBmopEsmpldSDvpj7fJ6-8EkgfXykXvvikJYUasLsKhfaHJHneni6hFUZfAgw3RR9azBbsRTYqERWEc8x7gUGGKtK2Yn4hlJFXmqoW" />
              </div>
              <div className="col-span-2 row-span-2 bg-surface-container-low rounded-xl border border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-secondary text-3xl">play_circle</span>
                <span className="text-xs font-label-bold mt-2 tracking-widest uppercase">Field Test</span>
              </div>
              <div className="col-span-4 row-span-2 bg-surface-container-low rounded-xl border border-white/5 p-6 relative overflow-hidden">
                <div className="scan-line absolute left-0 right-0 h-px bg-secondary/30" />
                <div className="flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-label-bold text-secondary uppercase tracking-[0.2em]">Diagnostic Shell</span>
                    <span className="text-[10px] font-label-bold text-on-surface-variant">LVL-4 CERTIFIED</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 h-1 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-secondary w-3/4" />
                    </div>
                    <div className="flex-1 h-1 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-secondary w-1/2" />
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-on-surface-variant flex gap-4">
                    <span>STATUS: READY</span>
                    <span>TEMP: 32°C</span>
                    <span>ID: V-S1-P-001</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Right: Buy Box */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="sticky top-24 space-y-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
                  <span className="text-secondary font-label-bold text-xs uppercase tracking-widest">In Stock - Ready for Shipping</span>
                </div>
                <h1 className="font-headline-xl text-headline-xl uppercase">VOLT-S1 PRO</h1>
                <p className="text-on-surface-variant font-body-md leading-relaxed">Engineered for the clinical precision of professional drifting. Aircraft-grade chromoly chassis paired with our proprietary high-torque axial flux hub motor.</p>
              </div>
              <div className="p-6 border border-white/10 rounded-xl bg-surface-container-lowest relative overflow-hidden">
                {/* Low Stock Hazard Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 hazard-stripes opacity-80" />
                <div className="flex justify-between items-end mb-6">
                  <div className="space-y-1">
                    <span className="text-error font-label-bold text-[10px] uppercase tracking-tighter flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">bolt</span> LOW VOLTAGE (ONLY 3 LEFT)
                    </span>
                    <div className="text-4xl font-headline-md">$2,499.00</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-on-surface-variant block uppercase">Finance from</span>
                    <span className="font-label-bold text-primary">$120/mo</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <button className="kinetic-btn w-full bg-secondary text-on-secondary font-label-bold py-5 rounded-lg uppercase tracking-widest flex items-center justify-center gap-3">
                    <span>Add to Racing Stable</span>
                    <span className="material-symbols-outlined text-xl">keyboard_double_arrow_right</span>
                  </button>
                  <button className="kinetic-btn w-full border border-white/10 hover:bg-white/5 font-label-bold py-5 rounded-lg uppercase tracking-widest transition-colors">
                    Custom Build Configurator
                  </button>
                </div>
              </div>
              {/* Trust Signals Sidebar */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-white/5 rounded-lg bg-surface-container flex items-center gap-4 group hover:border-secondary/30 transition-colors cursor-default">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                    <span className="material-symbols-outlined text-xl">public</span>
                  </div>
                  <div>
                    <div className="text-xs font-label-bold uppercase tracking-wide">Worldwide</div>
                    <div className="text-[10px] text-on-surface-variant">Global Express Ops</div>
                  </div>
                </div>
                <div className="p-4 border border-white/5 rounded-lg bg-surface-container flex items-center gap-4 group hover:border-secondary/30 transition-colors cursor-default">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                    <span className="material-symbols-outlined text-xl">verified</span>
                  </div>
                  <div>
                    <div className="text-xs font-label-bold uppercase tracking-wide">Certified</div>
                    <div className="text-[10px] text-on-surface-variant">24/7 Tech Support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Technical Specs Overhaul */}
        <div className="mt-24 space-y-12">
          <div className="flex items-center gap-6">
            <h2 className="font-headline-md text-headline-md uppercase shrink-0">Live Performance Log</h2>
            <div className="speed-line flex-grow" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 relative">
            {/* Skeleton Loader State (Visible by default in this overhaul context) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-widest">Torque Curve</span>
                <span className="text-secondary font-mono text-xs">85Nm</span>
              </div>
              <div className="h-24 bg-surface-container rounded border border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 skeleton-pulse bg-secondary/10" />
                <div className="absolute bottom-0 left-0 w-full h-full flex items-end px-2 gap-1">
                  <div className="flex-1 bg-secondary/20 h-[20%]" />
                  <div className="flex-1 bg-secondary/30 h-[40%]" />
                  <div className="flex-1 bg-secondary/40 h-[70%]" />
                  <div className="flex-1 bg-secondary/60 h-[85%]" />
                  <div className="flex-1 bg-secondary/40 h-[60%]" />
                </div>
              </div>
              <p className="text-xs text-on-surface-variant font-mono">Real-time telemetry enabled via Bluetooth 5.2</p>
            </div>
            <div className="space-y-4 border-l border-white/10 pl-8">
              <div className="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-widest">Velocity</div>
              <div className="text-4xl font-headline-md">45 MPH</div>
              <div className="speed-line my-4" />
              <div className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Acceleration (0-30)</span>
                  <span className="font-mono">3.2s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Top Speed Mode</span>
                  <span className="font-mono">UNLOCKED</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 border-l border-white/10 pl-8">
              <div className="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-widest">Energy Core</div>
              <div className="text-4xl font-headline-md">72V / 30AH</div>
              <div className="speed-line my-4" />
              <div className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Cell Type</span>
                  <span className="font-mono">LG 21700</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Cycles</span>
                  <span className="font-mono">2000+</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 border-l border-white/10 pl-8">
              <div className="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-widest">Chassis</div>
              <div className="text-4xl font-headline-md">4130 STEEL</div>
              <div className="speed-line my-4" />
              <div className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Frame Weight</span>
                  <span className="font-mono">12.4kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Rear Axle</span>
                  <span className="font-mono">Reinforced 50mm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="mt-24 border-t border-white/10 py-12 px-margin-desktop bg-surface-container-lowest">
        <div className="max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="space-y-4 max-w-sm">
            <div className="font-headline-md text-secondary uppercase">E-DRIFT</div>
            <p className="text-sm text-on-surface-variant">Precision instruments for the modern drifter. Laboratory tested. Track proven. Est. 2024.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <h4 className="text-xs font-label-bold uppercase tracking-widest text-on-surface">Mission</h4>
              <ul className="text-xs text-on-surface-variant space-y-2">
                <li><a className="hover:text-secondary" href="#">Technology</a></li>
                <li><a className="hover:text-secondary" href="#">Safety</a></li>
                <li><a className="hover:text-secondary" href="#">Team</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-label-bold uppercase tracking-widest text-on-surface">Protocols</h4>
              <ul className="text-xs text-on-surface-variant space-y-2">
                <li><a className="hover:text-secondary" href="#">Shipping</a></li>
                <li><a className="hover:text-secondary" href="#">Returns</a></li>
                <li><a className="hover:text-secondary" href="#">Privacy</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-label-bold uppercase tracking-widest text-on-surface">Connect</h4>
              <ul className="text-xs text-on-surface-variant space-y-2">
                <li><a className="hover:text-secondary" href="#">Instagram</a></li>
                <li><a className="hover:text-secondary" href="#">Discord</a></li>
                <li><a className="hover:text-secondary" href="#">Support</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
