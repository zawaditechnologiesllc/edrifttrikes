export const metadata = { title: "Electric Drift Trikes" };

export default function Page() {
  return (
    <div className="bg-background text-on-background font-body-md selection:bg-secondary selection:text-on-secondary min-h-screen">
      {/* TopNavBar */}
      <header className="bg-surface dark:bg-surface-container-lowest w-full top-0 sticky z-50 border-b border-white/10 flat no shadows">
        <nav className="flex justify-between items-center w-full px-margin-desktop py-4 max-w-max-width mx-auto">
          <div className="font-headline-md text-headline-md text-secondary tracking-tighter">E-DRIFT</div>
          <div className="hidden md:flex gap-8 items-center">
            <a className="text-secondary border-b-2 border-secondary pb-1 font-label-bold text-label-bold uppercase tracking-widest" href="/shop">TRIKES</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold text-label-bold uppercase tracking-widest hover:bg-white/5" href="/shop">PARTS</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold text-label-bold uppercase tracking-widest hover:bg-white/5" href="/shop">GEAR</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold text-label-bold uppercase tracking-widest hover:bg-white/5" href="/tech-lab">THE GARAGE</a>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center bg-white/5 px-4 py-2 border border-white/10 rounded">
              <span className="material-symbols-outlined text-on-surface-variant mr-2">search</span>
              <input className="bg-transparent border-none focus:ring-0 text-label-bold uppercase p-0 w-32 placeholder:text-on-surface-variant/40" placeholder="FIND YOUR RIDE" type="text" />
            </div>
            <button className="material-symbols-outlined text-on-surface hover:text-secondary transition-all active:scale-95">shopping_cart</button>
            <button className="material-symbols-outlined text-on-surface hover:text-secondary transition-all active:scale-95">person</button>
          </div>
        </nav>
      </header>
      <main>
        {/* Hero Section */}
        <section className="bg-white text-black py-24 md:py-32 slant-divider relative overflow-hidden">
          <div className="max-w-max-width mx-auto px-margin-desktop grid md:grid-cols-2 gap-12 items-center relative z-10">
            <div className="space-y-6">
              <div className="inline-block bg-black text-secondary px-3 py-1 font-label-bold text-label-bold uppercase tracking-widest">EST. 2024</div>
              <h1 className="font-display-lg text-display-lg md:text-display-lg-mobile lg:text-display-lg uppercase leading-none">ELECTRIC BEASTS</h1>
              <p className="font-body-lg text-body-lg text-black/70 max-w-md">Instant torque. Silent chaos. Engineered for maximum lateral G-force.</p>
              <button className="bg-primary-container text-on-primary-container px-8 py-4 rounded-lg font-label-bold text-label-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">VIEW COLLECTION</button>
            </div>
            <div className="relative">
              <img alt="Premium Electric Drift Trike" className="w-full h-auto drop-shadow-2xl transform hover:scale-105 transition-transform duration-700" src="/assets/action-mid-slide.jpg" />
              <div className="absolute -bottom-10 -right-10 w-48 h-48 border border-black/5 technical-grid pointer-events-none" />
            </div>
          </div>
          <div className="absolute inset-0 technical-grid opacity-[0.03] pointer-events-none" />
        </section>
        {/* Product Listing Section */}
        <section className="max-w-max-width mx-auto px-margin-desktop py-20">
          <div className="flex flex-col lg:flex-row gap-gutter">
            {/* Sidebar Filters */}
            <aside className="w-full lg:w-64 flex-shrink-0 space-y-10">
              <div className="space-y-4">
                <h3 className="font-label-bold text-label-bold uppercase border-b border-white/10 pb-2">ACTIVE FILTERS</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded flex items-center gap-2 font-label-bold text-[10px] uppercase">
                    72V <span className="material-symbols-outlined text-[14px] cursor-pointer">close</span>
                  </span>
                  <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded flex items-center gap-2 font-label-bold text-[10px] uppercase">
                    PRO <span className="material-symbols-outlined text-[14px] cursor-pointer">close</span>
                  </span>
                </div>
              </div>
              {/* Filter Categories */}
              <div className="space-y-8">
                <div>
                  <h4 className="font-label-bold text-label-bold uppercase mb-4 text-on-surface-variant">Power Source</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input defaultChecked className="w-4 h-4 rounded border-outline bg-transparent text-secondary focus:ring-secondary" type="checkbox" />
                      <span className="font-label-bold text-label-bold uppercase group-hover:text-secondary transition-colors">Electric</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-4 h-4 rounded border-outline bg-transparent text-secondary focus:ring-secondary" type="checkbox" />
                      <span className="font-label-bold text-label-bold uppercase group-hover:text-secondary transition-colors text-on-surface-variant">Gas</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-4 h-4 rounded border-outline bg-transparent text-secondary focus:ring-secondary" type="checkbox" />
                      <span className="font-label-bold text-label-bold uppercase group-hover:text-secondary transition-colors text-on-surface-variant">Gravity</span>
                    </label>
                  </div>
                </div>
                <div>
                  <h4 className="font-label-bold text-label-bold uppercase mb-4 text-on-surface-variant">Voltage</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="border border-white/10 py-2 font-label-bold text-[12px] hover:border-secondary transition-all">24V</button>
                    <button className="border border-white/10 py-2 font-label-bold text-[12px] hover:border-secondary transition-all">36V</button>
                    <button className="border border-white/10 py-2 font-label-bold text-[12px] hover:border-secondary transition-all">48V</button>
                    <button className="border border-white/10 py-2 font-label-bold text-[12px] hover:border-secondary transition-all">60V</button>
                    <button className="border border-secondary bg-secondary/10 py-2 font-label-bold text-[12px] text-secondary">72V</button>
                  </div>
                </div>
                <div>
                  <h4 className="font-label-bold text-label-bold uppercase mb-4 text-on-surface-variant">Rider Level</h4>
                  <div className="space-y-2">
                    <button className="w-full text-left font-label-bold text-label-bold uppercase text-on-surface-variant hover:text-on-surface py-1">Entry</button>
                    <button className="w-full text-left font-label-bold text-label-bold uppercase text-on-surface-variant hover:text-on-surface py-1">Intermediate</button>
                    <button className="w-full text-left font-label-bold text-label-bold uppercase text-secondary py-1 flex justify-between items-center">Pro <span className="w-1.5 h-1.5 bg-secondary" /></button>
                  </div>
                </div>
                <div>
                  <h4 className="font-label-bold text-label-bold uppercase mb-4 text-on-surface-variant">Price Range</h4>
                  <input className="w-full h-1 bg-white/10 appearance-none cursor-pointer" max={10000} min={500} step={100} type="range" />
                  <div className="flex justify-between mt-2 font-label-bold text-[12px] text-on-surface-variant uppercase">
                    <span>$500</span>
                    <span>$10,000+</span>
                  </div>
                </div>
              </div>
            </aside>
            {/* Grid */}
            <div className="flex-grow">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="font-label-bold text-label-bold uppercase text-on-surface-variant">Showing 24 of 112 units</p>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="font-label-bold text-label-bold uppercase text-on-surface-variant">Sort By:</span>
                  <select className="bg-transparent border-none focus:ring-0 font-label-bold text-label-bold uppercase text-on-surface cursor-pointer p-0">
                    <option>Top Rated</option>
                    <option>Price: Low to High</option>
                    <option>Price: High to Low</option>
                    <option>Newest Arrivals</option>
                  </select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-gutter">
                {/* Card 1 */}
                <div className="group bg-surface-container-low border border-white/5 rounded-lg overflow-hidden flex flex-col hover:border-primary transition-all duration-300">
                  <div className="relative aspect-[1.49] bg-surface-container overflow-hidden">
                    <div className="absolute top-4 left-4 z-10">
                      <span className="bg-secondary text-on-secondary px-3 py-1 font-label-bold text-[12px] uppercase cut-corner">NEW</span>
                    </div>
                    <img alt="VOLT-S1 PRO Electric Drift Trike" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="/assets/volt-s1-pro-hero.jpg" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <p className="text-[10px] font-label-bold text-secondary uppercase tracking-widest">IN STOCK &amp; READY TO SHIP</p>
                    </div>
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-headline-xl text-[24px] uppercase tracking-tight">VOLT-S1 PRO</h3>
                      <div className="flex items-center text-secondary">
                        <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: '"FILL" 1'}}>star</span>
                        <span className="font-label-bold text-[12px] ml-1">4.9</span>
                      </div>
                    </div>
                    <p className="text-on-surface-variant font-label-bold text-[12px] uppercase tracking-wide mb-4">72V · 48 MPH · ADULT</p>
                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/10">
                      <span className="font-headline-md text-headline-md">$3,499</span>
                      <button className="bg-primary-container text-on-primary-container px-4 py-2 rounded font-label-bold text-[12px] uppercase tracking-widest hover:brightness-110 transition-all">ADD TO CART</button>
                    </div>
                  </div>
                </div>
                {/* Card 2 */}
                <div className="group bg-surface-container-low border border-white/5 rounded-lg overflow-hidden flex flex-col hover:border-primary transition-all duration-300">
                  <div className="relative aspect-[1.49] bg-surface-container overflow-hidden">
                    <div className="absolute top-4 left-4 z-10">
                      <span className="bg-primary-container text-white px-3 py-1 font-label-bold text-[12px] uppercase cut-corner">BEST SELLER</span>
                    </div>
                    <img alt="RAZOR-EDGE EVO Professional Drift Trike Action" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="/assets/action-mid-slide.jpg" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all" />
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-headline-xl text-[24px] uppercase tracking-tight">RAZOR-EDGE EVO</h3>
                      <div className="flex items-center text-secondary">
                        <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: '"FILL" 1'}}>star</span>
                        <span className="font-label-bold text-[12px] ml-1">5.0</span>
                      </div>
                    </div>
                    <p className="text-on-surface-variant font-label-bold text-[12px] uppercase tracking-wide mb-4">84V CUSTOM · 55 MPH · PRO</p>
                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/10">
                      <span className="font-headline-md text-headline-md">$4,100</span>
                      <button className="bg-primary-container text-on-primary-container px-4 py-2 rounded font-label-bold text-[12px] uppercase tracking-widest hover:brightness-110 transition-all">ADD TO CART</button>
                    </div>
                  </div>
                </div>
                {/* Card 3 */}
                <div className="group bg-surface-container-low border border-white/5 rounded-lg overflow-hidden flex flex-col hover:border-primary transition-all duration-300">
                  <div className="relative aspect-[1.49] bg-surface-container overflow-hidden">
                    <div className="absolute top-4 left-4 z-10">
                      <span className="bg-error text-on-error px-3 py-1 font-label-bold text-[12px] uppercase cut-corner">SALE</span>
                    </div>
                    <img alt="STREET BRAWLER Gas Powered Drift Trike" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="/assets/action-mid-slide.jpg" />
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-headline-xl text-[24px] uppercase tracking-tight">STREET BRAWLER</h3>
                      <div className="flex items-center text-secondary">
                        <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: '"FILL" 1'}}>star</span>
                        <span className="font-label-bold text-[12px] ml-1">4.7</span>
                      </div>
                    </div>
                    <p className="text-on-surface-variant font-label-bold text-[12px] uppercase tracking-wide mb-4">48V · 28 MPH · TEEN/ADULT</p>
                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/10">
                      <div className="flex flex-col">
                        <span className="font-headline-md text-headline-md text-error">$1,599</span>
                        <span className="text-on-surface-variant line-through text-[12px] font-label-bold">$1,999</span>
                      </div>
                      <button className="bg-primary-container text-on-primary-container px-4 py-2 rounded font-label-bold text-[12px] uppercase tracking-widest hover:brightness-110 transition-all">ADD TO CART</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* SEO Section */}
        <section className="bg-white text-black py-24 slant-divider">
          <div className="max-w-4xl mx-auto px-margin-desktop text-center space-y-8">
            <h2 className="font-headline-xl text-headline-xl uppercase">The Evolution of Drift - Why go electric?</h2>
            <div className="grid md:grid-cols-2 gap-12 text-left">
              <div className="space-y-4">
                <p className="font-body-md text-black/80">
                  Traditional drifting relied on combustion engines—heavy, loud, and restricted by torque curves. The new era of drift is powered by high-density lithium-ion cells and brushless DC motors. With instant peak torque, you initiate slides with surgical precision. 
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-3 font-label-bold text-[12px] uppercase">
                    <span className="w-2 h-2 bg-secondary-container" /> Zero Transmission Lag
                  </li>
                  <li className="flex items-center gap-3 font-label-bold text-[12px] uppercase">
                    <span className="w-2 h-2 bg-secondary-container" /> Whisper-Quiet Operation
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <p className="font-body-md text-black/80">
                  Our chassis are engineered using 4130 Chromoly steel for the perfect balance of rigidity and weight. Each E-Drift trike features programmable controllers, allowing riders to fine-tune throttle maps and regenerative braking intensity for specific track conditions.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-3 font-label-bold text-[12px] uppercase">
                    <span className="w-2 h-2 bg-secondary-container" /> Aerospace Grade Components
                  </li>
                  <li className="flex items-center gap-3 font-label-bold text-[12px] uppercase">
                    <span className="w-2 h-2 bg-secondary-container" /> Advanced Thermal Management
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="bg-surface-container-lowest dark:bg-black w-full relative overflow-hidden border-t border-secondary/20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:20px_20px]">
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-desktop py-16 gap-gutter max-w-max-width mx-auto relative z-10">
          <div className="space-y-8 max-w-sm">
            <div className="font-display-lg text-secondary dark:text-secondary-fixed text-4xl uppercase leading-none">E-DRIFT</div>
            <p className="text-on-surface-variant font-body-md">Engineered for adrenaline. We provide the tools for the ultimate street drifting experience. Pure electric power, pure lateral chaos.</p>
            <div className="flex gap-4">
              <a className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors" href="#">brand_awareness</a>
              <a className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors" href="#">precision_manufacturing</a>
              <a className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors" href="#">electric_bolt</a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-20">
            <div className="space-y-4">
              <h5 className="font-label-bold text-label-bold uppercase text-secondary">COMPANY</h5>
              <ul className="space-y-2">
                <li><a className="text-on-surface-variant font-label-bold text-[12px] uppercase hover:text-primary transition-colors" href="/support">Support</a></li>
                <li><a className="text-on-surface-variant font-label-bold text-[12px] uppercase hover:text-primary transition-colors" href="#">Privacy</a></li>
                <li><a className="text-on-surface-variant font-label-bold text-[12px] uppercase hover:text-primary transition-colors" href="/shipping-warranty">Shipping</a></li>
                <li><a className="text-on-surface-variant font-label-bold text-[12px] uppercase hover:text-primary transition-colors" href="#">Terms</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h5 className="font-label-bold text-label-bold uppercase text-secondary">GARAGE</h5>
              <ul className="space-y-2">
                <li><a className="text-on-surface-variant font-label-bold text-[12px] uppercase hover:text-primary transition-colors" href="/shop">Trikes</a></li>
                <li><a className="text-on-surface-variant font-label-bold text-[12px] uppercase hover:text-primary transition-colors" href="#">Batteries</a></li>
                <li><a className="text-on-surface-variant font-label-bold text-[12px] uppercase hover:text-primary transition-colors" href="#">Tires</a></li>
                <li><a className="text-on-surface-variant font-label-bold text-[12px] uppercase hover:text-primary transition-colors" href="#">Apparel</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-max-width mx-auto px-margin-desktop py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center relative z-10 text-on-surface-variant text-[10px] font-label-bold tracking-widest uppercase">
          <span>© 2024 E-DRIFT MOTORS. ENGINEERED FOR ADRENALINE.</span>
          <div className="mt-4 md:mt-0 flex gap-8">
            <span>LOCALIZED IN CALI</span>
            <span>VOLTAGE: HIGH</span>
          </div>
        </div>
        <div className="font-display-lg text-display-lg text-on-surface/10 absolute opacity-20 -bottom-10 right-0 pointer-events-none select-none">ADRENALINE</div>
      </footer>
    </div>
  );
}
