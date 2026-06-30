export const metadata = { title: "Search" };

export default function Page() {
  return (
    <div className="bg-background text-on-surface selection:bg-secondary selection:text-black technical-grid min-h-screen min-h-screen">
      {/* TopNavBar */}
      <header className="w-full top-0 sticky z-50 bg-surface dark:bg-surface-container-lowest border-b border-white/10">
        <div className="flex justify-between items-center w-full px-margin-desktop py-4 max-w-max-width mx-auto">
          {/* Brand */}
          <div className="font-headline-md text-headline-md text-secondary tracking-tighter cursor-pointer">
            E-DRIFT
          </div>
          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">TRIKES</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-secondary border-b-2 border-secondary pb-1" href="#">PARTS</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">GEAR</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">THE GARAGE</a>
          </nav>
          {/* Active Search & Actions */}
          <div className="flex items-center gap-6 relative">
            {/* Active Search Bar */}
            <div className="relative flex items-center bg-surface-container-high rounded-lg px-4 py-2 border border-secondary w-80">
              <span className="material-symbols-outlined text-secondary mr-2">search</span>
              <input className="bg-transparent border-none focus:ring-0 text-body-md font-body-md text-on-surface w-full" type="text" defaultValue="72V Motor" />
              {/* Instant Results Dropdown */}
              <div className="absolute top-full left-0 w-full mt-2 bg-surface-container-high border border-outline-variant shadow-xl rounded-lg overflow-hidden z-50">
                <div className="p-4 border-b border-white/5">
                  <p className="text-[10px] font-label-bold text-outline uppercase tracking-widest mb-3">Products</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 hover:bg-white/5 transition-all cursor-pointer rounded">
                      <div className="w-10 h-10 bg-surface-container rounded border border-white/10 flex-shrink-0">
                        <img className="w-full h-full object-cover rounded" data-alt="Close-up shot of a high-performance 72V electric motor for drift trikes. The motor has a sleek black finish with exposed copper windings and a brushed metal housing. Industrial dark atmosphere with sharp neon blue lighting reflecting off the metallic surfaces. High-tech engineering aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOwBFA7PIpzBMb5mcyy7x0EIqyRMmtr6PR2wOoFISQhudw9blsm4p5GoEx_UjGn35ZNUmxQw9pTac_3u-gU5JD7Q5jt201chqRJuu1JN8o_qMKQDyX29VeHXVBwyV4Rwhbb7V_tEzYsT6Dpr5FhLUGZfZpAltQP5Gg00nkvJiQl8tdnZsU8WKHUzlZGAoIqliXqWtdsSoH4omxP0GcNtpUofZMYVr_TIiVXMQIVNUnYaw8lFAPytfrrw" />
                      </div>
                      <div>
                        <p className="text-body-md font-bold text-secondary">VOLT-S1 Pro (72V)</p>
                        <p className="text-xs text-on-surface-variant">$1,299.00</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 hover:bg-white/5 transition-all cursor-pointer rounded">
                      <div className="w-10 h-10 bg-surface-container rounded border border-white/10 flex-shrink-0">
                        <img className="w-full h-full object-cover rounded" data-alt="A rugged brushless 72V spare hub motor for heavy-duty electric drift trikes. Detailed view of the hub assembly with integrated cooling fins and high-torque design. Set against a dark, technical blueprint background with subtle Hazard Lime accents. Sharp focus on the precision-machined steel parts." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBXY-zlR0MMlWci5NHzZWD5-K2vHSK3O7_HSc9LDT0OGDD48Jz7dXnW2nrYyZwIsjYpoix_fRkU1S19TJw3G83l5u_LJSyK9PSihQN0zk8MvFLcT5e7GPc8fLIhAAH_N3OOzWOf5NnrTr3CciC-6ufUX3AnRs9O_rCNqIKZwDQ1hpu-Nvo-y6hg6aWKDdA8CVuBBTM4RG3I7s7Zc8GiotTnKLI0Lnz0c7oqDov8dAb7PRCn2sqO2Qx2Fg" />
                      </div>
                      <div>
                        <p className="text-body-md font-bold text-on-surface">Brushless Spare Hub (72V)</p>
                        <p className="text-xs text-on-surface-variant">$450.00</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-surface-container-highest/30">
                  <p className="text-[10px] font-label-bold text-outline uppercase tracking-widest mb-3">Guides</p>
                  <div className="space-y-2">
                    <a className="flex items-center gap-2 text-body-md text-on-surface-variant hover:text-secondary transition-colors" href="#">
                      <span className="material-symbols-outlined text-sm">article</span>
                      72V Battery Maintenance
                    </a>
                    <a className="flex items-center gap-2 text-body-md text-on-surface-variant hover:text-secondary transition-colors" href="#">
                      <span className="material-symbols-outlined text-sm">build</span>
                      How to swap a 72V motor
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-all cursor-pointer">shopping_cart</span>
              <span className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-all cursor-pointer">person</span>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-max-width mx-auto px-margin-desktop py-12">
        {/* Search Header */}
        <div className="mb-12">
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-2">SEARCH RESULTS FOR '<span className="text-secondary">72V MOTOR</span>'</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">4 items found matching your high-performance criteria.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-gutter">
          {/* Sidebar Filters */}
          <aside className="w-full md:w-64 flex-shrink-0 space-y-8">
            <div>
              <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface mb-4">Category</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input defaultChecked className="w-5 h-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-background" type="checkbox" />
                  <span className="text-body-md text-on-surface group-hover:text-secondary transition-colors">Complete Trikes</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input defaultChecked className="w-5 h-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-background" type="checkbox" />
                  <span className="text-body-md text-on-surface group-hover:text-secondary transition-colors">Motors &amp; Hubs</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input className="w-5 h-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-background" type="checkbox" />
                  <span className="text-body-md text-on-surface group-hover:text-secondary transition-colors">Power Systems</span>
                </label>
              </div>
            </div>
            <div>
              <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface mb-4">Price Range</h3>
              <input className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary" type="range" />
              <div className="flex justify-between mt-2 text-xs text-on-surface-variant">
                <span>$100</span>
                <span>$5,000+</span>
              </div>
            </div>
            <div>
              <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface mb-4">Voltage</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input className="w-5 h-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-background" type="checkbox" />
                  <span className="text-body-md text-on-surface group-hover:text-secondary transition-colors">48V System</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input defaultChecked className="w-5 h-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-background" type="checkbox" />
                  <span className="text-body-md text-on-surface group-hover:text-secondary transition-colors">72V Performance</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input className="w-5 h-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-background" type="checkbox" />
                  <span className="text-body-md text-on-surface group-hover:text-secondary transition-colors">96V Extreme</span>
                </label>
              </div>
            </div>
            <div>
              <h3 className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface mb-4">Availability</h3>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input defaultChecked className="w-5 h-5 rounded border-outline-variant bg-surface-container-high text-secondary focus:ring-secondary focus:ring-offset-background" type="checkbox" />
                <span className="text-body-md text-on-surface group-hover:text-secondary transition-colors">In Stock Only</span>
              </label>
            </div>
          </aside>
          {/* Products Grid (PLP) */}
          <div className="flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-gutter">
              {/* Item 1: VOLT-S1 Pro */}
              <div className="group bg-surface-container-low border border-white/10 rounded-lg overflow-hidden transition-all hover:border-secondary/50 relative">
                <div className="aspect-video relative overflow-hidden">
                  <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" data-alt="Full view of the VOLT-S1 Pro electric drift trike, a beast of engineering with a carbon fiber frame and a massive 72V rear-mounted motor. The trike is staged in a dark industrial garage with wet concrete floors and vibrant Voltage Blue lighting streaks. Dynamic 15-degree angle shot highlighting the aggressive stance and performance tires." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDXX430ThCd2IgpICYtm3igc8R_4FIlF5U2uhpVTzlPFQ84LJ3Lo-cHyOQNX3xho3ltmeDG2riggV6wFXxxIXSl-rEHNwL__TSeB8dbWkSKU_czxPyDQMKL_VUQmaF89kgO5BXBPgoEb3Afll9nkjyoQgvWF7lPunt32g3TtCSEatd-4xWUUEdpA-EVpYs15QM6DDVoTb0AWEGCFCNbhk3aBPmZLfmRiqOrWeP2ndIOJ5Hhq4qD2NwxrA" />
                  <div className="absolute top-4 left-4 bg-secondary text-black font-label-bold text-[10px] px-3 py-1 rounded-sm uppercase tracking-widest">In Stock</div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-secondary transition-colors">VOLT-S1 PRO (72V)</h3>
                    <p className="font-headline-md text-headline-md text-secondary">$1,299</p>
                  </div>
                  <p className="text-body-md text-on-surface-variant mb-6 line-clamp-2">The flagship drift powerhouse. Engineered with a proprietary 72V brushless motor for maximum torque and endurance.</p>
                  <div className="flex gap-4">
                    <button className="flex-grow bg-secondary text-black font-label-bold text-label-bold uppercase py-4 rounded-lg hover:brightness-110 active:scale-95 transition-all">Quick Add</button>
                    <button className="w-14 border border-outline-variant flex items-center justify-center rounded-lg hover:border-secondary transition-colors">
                      <span className="material-symbols-outlined">favorite</span>
                    </button>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-secondary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </div>
              {/* Item 2: Spare Hub */}
              <div className="group bg-surface-container-low border border-white/10 rounded-lg overflow-hidden transition-all hover:border-secondary/50 relative">
                <div className="aspect-video relative overflow-hidden">
                  <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" data-alt="Technical product shot of a 72V brushless hub motor for electric drifting. The component is isolated on a dark metallic surface with technical grid lines. Sharp industrial lighting highlights the machined cooling fins and heavy-duty cabling. High-contrast neon accents create a futuristic, professional engineering vibe. Minimalist and powerful presentation." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQ-7AcAa_cFJHlEybO4CmnlofpVf_t0O1B2ZEDXgc6BBAWJsNkQZy-hapPKTZnpNU44lWV0AaCogtEDubiFUe0g1XvBgoMxNCvjwlzhDbL5ZGkVlOUoAXyKlpP-pDVyg5OiDqubYXHXnSPeSurXllAnoMYQyvM8VSbmusOQymKcuGFPRXAyz4WxRWUlF_KHWkPd-KaIAJoANM42Vwte5d-I3vd5QBNvEHiJctV0T5uq4-AeeqEKBpRAg" />
                  <div className="absolute top-4 left-4 bg-secondary text-black font-label-bold text-[10px] px-3 py-1 rounded-sm uppercase tracking-widest">Precision Kit</div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-secondary transition-colors">BRUSHLESS HUB</h3>
                    <p className="font-headline-md text-headline-md text-secondary">$450</p>
                  </div>
                  <p className="text-body-md text-on-surface-variant mb-6 line-clamp-2">Direct replacement 72V hub motor. High-thermal efficiency core for continuous peak-power drifting sessions.</p>
                  <div className="flex gap-4">
                    <button className="flex-grow bg-secondary text-black font-label-bold text-label-bold uppercase py-4 rounded-lg hover:brightness-110 active:scale-95 transition-all">Quick Add</button>
                    <button className="w-14 border border-outline-variant flex items-center justify-center rounded-lg hover:border-secondary transition-colors">
                      <span className="material-symbols-outlined">favorite</span>
                    </button>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-secondary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </div>
              {/* Item 3: 72V Battery Pack */}
              <div className="group bg-surface-container-low border border-white/10 rounded-lg overflow-hidden transition-all hover:border-secondary/50 relative">
                <div className="aspect-video relative overflow-hidden">
                  <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" data-alt="High-capacity 72V lithium-ion battery pack for electric drift trikes. The battery is encased in a ruggedized, matte-black weather-sealed housing with a glowing LED voltage display. Set against a dark industrial workshop backdrop with subtle grid-line textures and Hazard Lime lighting accents. Professional high-performance power equipment aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDqWfJNhb2s0RSHCF7_JBoKfiNpP3bWJt7PJPg66dvp67iaehcbMPbIjrhr9vKVfH1HJw08ujSttjn_f8xT0FcPK6ffdWDBgHE_sSKhQ4H4tEdevr4WBKMP5Gc6jsizv0JzxCITKXkVm_w8ru2ty74hHK9o_UioSB0K1H5v7v82F7PHqtIpeflDNnunrcfk4xO0t9-WzC1RnY0JAHJsPzGqD-r7dq-se4rcpCo9c5BdfSC-udKTZYYWkg" />
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-secondary transition-colors">72V BATTERY PACK</h3>
                    <p className="font-headline-md text-headline-md text-secondary">$899</p>
                  </div>
                  <p className="text-body-md text-on-surface-variant mb-6 line-clamp-2">Elite 72V power storage with BMS. Designed for rapid discharge and sustained drift performance.</p>
                  <div className="flex gap-4">
                    <button className="flex-grow bg-secondary text-black font-label-bold text-label-bold uppercase py-4 rounded-lg hover:brightness-110 active:scale-95 transition-all">Quick Add</button>
                    <button className="w-14 border border-outline-variant flex items-center justify-center rounded-lg hover:border-secondary transition-colors">
                      <span className="material-symbols-outlined">favorite</span>
                    </button>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-secondary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </div>
              {/* Item 4: Heavy Duty Motor Mount */}
              <div className="group bg-surface-container-low border border-white/10 rounded-lg overflow-hidden transition-all hover:border-secondary/50 relative">
                <div className="aspect-video relative overflow-hidden">
                  <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" data-alt="A heavy-duty steel motor mount for high-torque 72V electric trike motors. Precision CNC-machined part with a textured black powder coat finish. Shot in a macro style showing the fine details of the welds and mounting points. The lighting is clinical and sharp, using Voltage Blue tones against a dark technical background." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWY1zgAlK8YAEcfySi3nFLwAVoKHnAVyvRv1_y68MjzgXmJFQ-OPQJYcp0KWhIJKComVqAtd1vMwNqRFdZBrkFUIcJKLWlWz-T6K7y3K_m1a6A_bHM7PhTpn4kH-FSK2yvQPnmwh1uW-PvecHgdnUbI_cmwdqjYU_GSYCzzPNC3xg4-ZFuRuzaMLdIns-T7YFOUHQqL8xZtUL_RMXOgRlTq8GE4W9jYH6Yg29hiNs3zIFK75659-vNmA" />
                  <div className="absolute top-4 left-4 bg-tertiary-container text-white font-label-bold text-[10px] px-3 py-1 rounded-sm uppercase tracking-widest">Limited</div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-secondary transition-colors">HD MOTOR MOUNT</h3>
                    <p className="font-headline-md text-headline-md text-secondary">$125</p>
                  </div>
                  <p className="text-body-md text-on-surface-variant mb-6 line-clamp-2">Reinforced steel mount designed to handle the extreme torque of our 72V motors. Vibration dampened.</p>
                  <div className="flex gap-4">
                    <button className="flex-grow bg-secondary text-black font-label-bold text-label-bold uppercase py-4 rounded-lg hover:brightness-110 active:scale-95 transition-all">Quick Add</button>
                    <button className="w-14 border border-outline-variant flex items-center justify-center rounded-lg hover:border-secondary transition-colors">
                      <span className="material-symbols-outlined">favorite</span>
                    </button>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-secondary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </div>
            </div>
            {/* Technical Specs List Example */}
            <div className="mt-16 bg-surface-container border border-white/5 p-8 rounded-lg">
              <h2 className="font-headline-md text-headline-md text-secondary mb-8">COMPATIBILITY MATRIX</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-secondary rounded-none" />
                    <span className="font-label-bold text-on-surface">VOLT-S1 Hub Compatibility</span>
                  </div>
                  <span className="text-body-md text-on-surface-variant">Standard 72V</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-secondary rounded-none" />
                    <span className="font-label-bold text-on-surface">Max Continuous Amp Draw</span>
                  </div>
                  <span className="text-body-md text-on-surface-variant">150A</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-secondary rounded-none" />
                    <span className="font-label-bold text-on-surface">Thermal Protection Interface</span>
                  </div>
                  <span className="text-body-md text-on-surface-variant">Integrated</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-secondary rounded-none" />
                    <span className="font-label-bold text-on-surface">Mounting Pattern</span>
                  </div>
                  <span className="text-body-md text-on-surface-variant">4xM8 Technical</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full relative overflow-hidden bg-surface-container-lowest dark:bg-black border-t border-secondary/20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:20px_20px]">
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-desktop py-16 gap-gutter max-w-max-width mx-auto relative z-10">
          <div className="space-y-6 max-w-sm">
            <div className="font-headline-md text-headline-md text-secondary">E-DRIFT</div>
            <p className="text-body-md text-on-surface-variant">The absolute authority in high-performance electric drift engineering. Built by experts, for experts.</p>
            <div className="flex gap-4">
              <span className="material-symbols-outlined text-secondary hover:scale-110 transition-transform cursor-pointer">public</span>
              <span className="material-symbols-outlined text-secondary hover:scale-110 transition-transform cursor-pointer">terminal</span>
              <span className="material-symbols-outlined text-secondary hover:scale-110 transition-transform cursor-pointer">bolt</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="flex flex-col gap-4">
              <h4 className="font-label-bold text-label-bold uppercase text-on-surface">Support</h4>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Tech Hub</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Manuals</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Returns</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="font-label-bold text-label-bold uppercase text-on-surface">Privacy</h4>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Data Policy</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Cookies</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="font-label-bold text-label-bold uppercase text-on-surface">Shipping</h4>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Logistics</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Global</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="font-label-bold text-label-bold uppercase text-on-surface">Terms</h4>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Service</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Warranty</a>
            </div>
          </div>
        </div>
        <div className="px-margin-desktop py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 max-w-max-width mx-auto">
          <p className="text-body-md text-on-surface-variant">© 2024 E-DRIFT MOTORS. ENGINEERED FOR ADRENALINE.</p>
          <div className="flex gap-8">
            <span className="text-secondary font-label-bold tracking-widest text-[10px] uppercase">Voltage Blue Core</span>
            <span className="text-secondary font-label-bold tracking-widest text-[10px] uppercase">Hazard Lime Drift</span>
          </div>
        </div>
        <div className="font-display-lg text-display-lg text-on-surface/10 absolute bottom-[-20%] right-[-5%] opacity-20 select-none pointer-events-none">
          E-DRIFT
        </div>
      </footer>
    </div>
  );
}
