export const metadata = { title: "Shop All Trikes" };

export default function Page() {
  return (
    <div className="bg-off-white text-surface-container-lowest font-body-md overflow-x-hidden min-h-screen">
      {/* Global Navigation */}
      <nav className="bg-surface dark:bg-surface-container-lowest w-full top-0 sticky z-50 border-b border-white/10 group/nav">
        <div className="flex justify-between items-center w-full px-margin-desktop py-4 max-w-max-width mx-auto">
          <a className="font-headline-md text-headline-md text-secondary tracking-tighter" href="#">E-DRIFT</a>
          <div className="hidden md:flex items-center gap-8">
            <div className="group/item">
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-secondary border-b-2 border-secondary pb-1 flex items-center gap-1" href="#">
                TRIKES <span className="material-symbols-outlined text-xs transition-transform group-hover/item:rotate-180">expand_more</span>
              </a>
              {/* Mega Menu: Trikes */}
              <div className="absolute top-full left-0 w-full mega-menu-gradient border-b border-white/10 opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all duration-300 pointer-events-none group-hover/item:pointer-events-auto">
                <div className="max-w-max-width mx-auto px-margin-desktop py-12 grid grid-cols-4 gap-12">
                  <div className="col-span-1">
                    <h4 className="font-label-bold text-xs text-secondary tracking-[0.2em] mb-6 border-b border-white/10 pb-4">ELECTRIC PERFORMANCE</h4>
                    <ul className="space-y-4">
                      <li><a className="text-on-surface-variant hover:text-white transition-colors text-sm font-label-bold" href="#">VOLT-S1 PRO</a></li>
                      <li><a className="text-on-surface-variant hover:text-white transition-colors text-sm font-label-bold" href="#">VOLT-E CORE</a></li>
                      <li><a className="text-on-surface-variant hover:text-white transition-colors text-sm font-label-bold" href="#">STORM CHASER</a></li>
                    </ul>
                  </div>
                  <div className="col-span-1">
                    <h4 className="font-label-bold text-xs text-secondary tracking-[0.2em] mb-6 border-b border-white/10 pb-4">GAS POWERED</h4>
                    <ul className="space-y-4">
                      <li><a className="text-on-surface-variant hover:text-white transition-colors text-sm font-label-bold" href="#">INTERCEPTOR-G</a></li>
                      <li><a className="text-on-surface-variant hover:text-white transition-colors text-sm font-label-bold" href="#">HAZARD X</a></li>
                      <li><a className="text-on-surface-variant hover:text-white transition-colors text-sm font-label-bold" href="#">NITRO-FUELED</a></li>
                    </ul>
                  </div>
                  <div className="col-span-2 bg-white/5 p-8 border border-white/5 rounded">
                    <div className="flex gap-6 items-center">
                      <div className="w-1/2 aspect-video bg-surface-container rounded overflow-hidden">
                        <img alt="Featured" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvNf87_k0qlUq1GmgWTl677btLklR2y8-uYhJu-a6KgtYcZuxGDWKAb3HfTpjSpxIdMipbimTJPXcCIpy5eopwSpjQFZw52WWo9Ru3d7K7ZkPj76zhCuR_16bnQmRJVhhwnCBSpS0EIUtSFw-ciDFAmehjG2mxY8pZkBBHAjL6WSSixKCK0aUfnv-V3pdZBK82VKv5s3bLL_XGGlLR7DNulZEp2v-rVidOYyupxOdmlSpFL62aqVAHYQ" />
                      </div>
                      <div className="w-1/2">
                        <span className="text-secondary text-[10px] font-label-bold tracking-widest block mb-2 uppercase">New Release</span>
                        <h5 className="text-white font-headline-md text-xl mb-2">VOLT-S1 PRO</h5>
                        <p className="text-on-surface-variant text-xs mb-4">Experience the pinnacle of electric drift engineering.</p>
                        <a className="inline-block border border-secondary text-secondary px-4 py-2 text-[10px] font-label-bold tracking-widest hover:bg-secondary hover:text-surface-container-lowest transition-all" href="#">VIEW RIG</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">PARTS</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">GEAR</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">THE GARAGE</a>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input className="bg-white/5 border border-white/10 rounded-sm py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-secondary w-48 transition-all text-white" placeholder="FIND YOUR RIG" type="text" />
            </div>
            <button className="text-on-surface-variant hover:text-secondary transition-colors active:scale-95 duration-75">
              <span className="material-symbols-outlined">shopping_cart</span>
            </button>
            <button className="text-on-surface-variant hover:text-secondary transition-colors active:scale-95 duration-75">
              <span className="material-symbols-outlined">person</span>
            </button>
          </div>
        </div>
      </nav>
      {/* Hero Header Area */}
      <header className="relative bg-off-white pt-16 pb-12 overflow-hidden">
        <div className="max-w-max-width mx-auto px-margin-desktop relative z-10">
          <div className="flex flex-col items-start">
            <span className="font-label-bold text-label-bold text-primary-container tracking-widest uppercase mb-2">PRECISION ENGINEERING</span>
            <h1 className="font-display-lg text-display-lg text-surface-container-lowest uppercase leading-none mb-4">ALL RIGS</h1>
            <div className="w-24 h-1 bg-secondary" />
          </div>
        </div>
        {/* Subtle technical accent */}
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-5 pointer-events-none">
          <div className="technical-grid w-full h-full" />
        </div>
      </header>
      <main className="max-w-max-width mx-auto px-margin-desktop py-12 flex flex-col md:flex-row gap-gutter">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-1/4 flex-shrink-0 space-y-10">
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest border-b border-surface-container-lowest/10 pb-4 mb-6">POWER SOURCE</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input defaultChecked className="w-5 h-5 rounded border-surface-container-lowest/20 text-secondary focus:ring-secondary" type="checkbox" />
                <span className="font-label-bold text-sm tracking-wide group-hover:text-primary-container transition-colors">ELECTRIC (12)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input className="w-5 h-5 rounded border-surface-container-lowest/20 text-secondary focus:ring-secondary" type="checkbox" />
                <span className="font-label-bold text-sm tracking-wide group-hover:text-primary-container transition-colors">GAS (8)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input className="w-5 h-5 rounded border-surface-container-lowest/20 text-secondary focus:ring-secondary" type="checkbox" />
                <span className="font-label-bold text-sm tracking-wide group-hover:text-primary-container transition-colors">GRAVITY (4)</span>
              </label>
            </div>
          </div>
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest border-b border-surface-container-lowest/10 pb-4 mb-6">SKILL LEVEL</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input className="w-5 h-5 rounded border-surface-container-lowest/20 text-secondary focus:ring-secondary" type="checkbox" />
                <span className="font-label-bold text-sm tracking-wide group-hover:text-primary-container transition-colors">EXPERT</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input defaultChecked className="w-5 h-5 rounded border-surface-container-lowest/20 text-secondary focus:ring-secondary" type="checkbox" />
                <span className="font-label-bold text-sm tracking-wide group-hover:text-primary-container transition-colors">INTERMEDIATE</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input className="w-5 h-5 rounded border-surface-container-lowest/20 text-secondary focus:ring-secondary" type="checkbox" />
                <span className="font-label-bold text-sm tracking-wide group-hover:text-primary-container transition-colors">ENTRY</span>
              </label>
            </div>
          </div>
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest border-b border-surface-container-lowest/10 pb-4 mb-6">PRICE RANGE</h3>
            <input className="w-full h-1 bg-surface-container-lowest/10 appearance-none cursor-pointer accent-secondary" max={5000} min={500} type="range" />
            <div className="flex justify-between mt-4">
              <span className="font-label-bold text-xs">$500</span>
              <span className="font-label-bold text-xs">$5,000</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 cut-corner text-white">
            <h4 className="font-headline-md text-xl uppercase mb-2">CUSTOM BUILD?</h4>
            <p className="text-xs text-on-surface-variant mb-6">Engineered to your specific drift dynamics.</p>
            <button className="w-full py-3 bg-secondary text-surface-container-lowest font-label-bold text-sm uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">START BUILD</button>
          </div>
        </aside>
        {/* Product Grid */}
        <section className="flex-grow">
          <div className="flex justify-between items-center mb-10">
            <p className="font-label-bold text-sm text-surface-container-lowest/60">SHOWING 24 RIGS &amp; PACKS</p>
            <div className="flex items-center gap-2">
              <span className="font-label-bold text-xs uppercase tracking-widest">SORT BY:</span>
              <select className="bg-transparent border-none font-label-bold text-sm focus:ring-0 cursor-pointer">
                <option>LATEST DROP</option>
                <option>PRICE: HI-LOW</option>
                <option>PERFORMANCE</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-gutter">
            {/* Product Card 1: VOLT-S1 Pro */}
            <article className="group bg-white border border-surface-container-lowest/5 rounded-lg overflow-hidden flex flex-col hover:shadow-xl transition-all duration-500">
              <div className="relative aspect-[1.49] overflow-hidden bg-[#F0F0F0]">
                <img alt="The VOLT-S1 Pro electric drift trike, featuring a sleek Voltage Blue aerodynamic frame with carbon fiber accents." className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvNf87_k0qlUq1GmgWTl677btLklR2y8-uYhJu-a6KgtYcZuxGDWKAb3HfTpjSpxIdMipbimTJPXcCIpy5eopwSpjQFZw52WWo9Ru3d7K7ZkPj76zhCuR_16bnQmRJVhhwnCBSpS0EIUtSFw-ciDFAmehjG2mxY8pZkBBHAjL6WSSixKCK0aUfnv-V3pdZBK82VKv5s3bLL_XGGlLR7DNulZEp2v-rVidOYyupxOdmlSpFL62aqVAHYQ" />
                <div className="absolute top-4 left-4">
                  <span className="bg-secondary text-surface-container-lowest px-3 py-1 font-label-bold text-xs uppercase tracking-widest rounded-sm">NEW</span>
                </div>
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-headline-md text-2xl uppercase tracking-tight">VOLT-S1 PRO</h2>
                  <span className="font-headline-md text-2xl text-primary-container">$3,499</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="border-l-2 border-secondary pl-3">
                    <span className="block font-label-bold text-[10px] text-surface-container-lowest/40 uppercase tracking-widest">TOP SPEED</span>
                    <span className="font-label-bold text-lg tabular-nums">48 MPH</span>
                  </div>
                  <div className="border-l-2 border-secondary pl-3">
                    <span className="block font-label-bold text-[10px] text-surface-container-lowest/40 uppercase tracking-widest">RANGE</span>
                    <span className="font-label-bold text-lg tabular-nums">22 MILES</span>
                  </div>
                </div>
                <button className="mt-auto w-full py-4 bg-surface-container-lowest text-white font-label-bold text-sm uppercase tracking-widest hover:bg-primary-container active:scale-[0.98] transition-all">CONFIGURE RIG</button>
              </div>
            </article>
            {/* Product Card 2: INTERCEPTOR-G */}
            <article className="group bg-white border border-surface-container-lowest/5 rounded-lg overflow-hidden flex flex-col hover:shadow-xl transition-all duration-500">
              <div className="relative aspect-[1.49] overflow-hidden bg-[#F0F0F0]">
                <img alt="The INTERCEPTOR-G gas-powered drift trike, showing its rugged steel tube frame in charcoal black with Hazard Lime accents." className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDEhdVLdAZChQkUKv4ll2LTn5esZhbp6LgwCKEwEib8_fhDi2pY72FhGuAB8IkyNRRQTwa0yDitsm5wuL_1sK_2YbBqgCEvbEmACg87AF-UzPAKK4-95egA6-_S6GgZGME9xEnZlwOnDvUKy0pDlkgBbFZ1T1LcSBMN8qFhSMdq51x1w9sYjeZM6lbJELTO0AaX5HyRD8oCDopOwWBXXH3eLDJXFtd52YPeTpmDR6K1cbd_z3yVg4V-xg" />
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-headline-md text-2xl uppercase tracking-tight">INTERCEPTOR-G</h2>
                  <span className="font-headline-md text-2xl text-primary-container">$2,850</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="border-l-2 border-secondary pl-3">
                    <span className="block font-label-bold text-[10px] text-surface-container-lowest/40 uppercase tracking-widest">ENGINE</span>
                    <span className="font-label-bold text-lg tabular-nums">212CC</span>
                  </div>
                  <div className="border-l-2 border-secondary pl-3">
                    <span className="block font-label-bold text-[10px] text-surface-container-lowest/40 uppercase tracking-widest">OUTPUT</span>
                    <span className="font-label-bold text-lg tabular-nums">12 HP</span>
                  </div>
                </div>
                <button className="mt-auto w-full py-4 bg-surface-container-lowest text-white font-label-bold text-sm uppercase tracking-widest hover:bg-primary-container active:scale-[0.98] transition-all">CONFIGURE RIG</button>
              </div>
            </article>
            {/* Product Card 3: PARTS BUNDLE */}
            <article className="group bg-white border border-surface-container-lowest/5 rounded-lg overflow-hidden flex flex-col lg:col-span-2 hover:shadow-xl transition-all duration-500">
              <div className="flex flex-col md:flex-row">
                <div className="relative w-full md:w-1/2 aspect-[1.49] overflow-hidden bg-[#F0F0F0]">
                  <img alt="A detailed technical close-up of high-performance drift trike parts on a white studio background." className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDiE-jOzVIqf-yscisl4KsmFL92K7BJCNqaaVojAvKD2rtVzqVtAzUDbQJEAPMtNCbIIH4qXkJWlNL6tuodLDYncy3otZl46d1HDI53assXw9qdz3qjhoTo0ZwXCapRCwOKZHSB8nZHhSNXZCvwX8GnpAc251OyvE7RK1IrTupObQDBrcbSw5Bx5XNRsBAZS06zCXYs6DB3IDwbQc8DjuFGj1GFL-5AexHyyob6kDxrIDx26DMqAf37Ig" />
                  <div className="absolute top-4 left-4">
                    <span className="bg-[#ffb4ab] text-error-container px-3 py-1 font-label-bold text-xs uppercase tracking-widest rounded-sm">LOW STOCK</span>
                  </div>
                </div>
                <div className="p-8 md:p-12 flex flex-col flex-grow justify-center">
                  <span className="font-label-bold text-xs text-primary-container uppercase tracking-widest mb-2">UPGRADE PACK</span>
                  <h2 className="font-headline-md text-3xl uppercase tracking-tight mb-4">ELITE DRIFT BUNDLE V.4</h2>
                  <p className="text-surface-container-lowest/60 text-sm mb-8 max-w-md">The ultimate conversion kit. Includes 5KW Brushless Motor, 72V Battery Interface, and 12-Month Slide-Sleeve Subscription.</p>
                  <div className="flex items-center gap-6 mb-8">
                    <span className="font-headline-md text-3xl text-primary-container">$899</span>
                    <div className="flex items-center gap-1 text-secondary">
                      <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: '"FILL" 1'}}>star</span>
                    </div></div></div></div></article></div></section></main>
      {/* Global Footer */}
      <footer className="bg-surface-container-lowest text-on-surface py-20 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-max-width mx-auto px-margin-desktop relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-1 md:col-span-1">
              <h2 className="font-headline-md text-3xl text-secondary mb-6">E-DRIFT</h2>
              <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">Pioneering the evolution of drift performance. Engineered for those who live sideways.</p>
              <div className="flex gap-4">
                <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary hover:text-surface transition-all" href="#"><span className="material-symbols-outlined text-lg">share</span></a>
                <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary hover:text-surface transition-all" href="#"><span className="material-symbols-outlined text-lg">videocam</span></a>
                <a className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary hover:text-surface transition-all" href="#"><span className="material-symbols-outlined text-lg">hub</span></a>
              </div>
            </div>
            <div>
              <h4 className="font-label-bold text-xs tracking-widest uppercase mb-8 text-white">THE RIGS</h4>
              <ul className="space-y-4">
                <li><a className="text-on-surface-variant hover:text-secondary text-sm transition-colors uppercase tracking-wider" href="#">Electric Series</a></li>
                <li><a className="text-on-surface-variant hover:text-secondary text-sm transition-colors uppercase tracking-wider" href="#">Gas Performance</a></li>
                <li><a className="text-on-surface-variant hover:text-secondary text-sm transition-colors uppercase tracking-wider" href="#">Gravity Gravity</a></li>
                <li><a className="text-on-surface-variant hover:text-secondary text-sm transition-colors uppercase tracking-wider" href="#">Custom Shop</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-bold text-xs tracking-widest uppercase mb-8 text-white">RESOURCES</h4>
              <ul className="space-y-4">
                <li><a className="text-on-surface-variant hover:text-secondary text-sm transition-colors uppercase tracking-wider" href="#">Tech Support</a></li>
                <li><a className="text-on-surface-variant hover:text-secondary text-sm transition-colors uppercase tracking-wider" href="#">Drift Academy</a></li>
                <li><a className="text-on-surface-variant hover:text-secondary text-sm transition-colors uppercase tracking-wider" href="#">Find a Dealer</a></li>
                <li><a className="text-on-surface-variant hover:text-secondary text-sm transition-colors uppercase tracking-wider" href="#">Maintenance</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-bold text-xs tracking-widest uppercase mb-8 text-white">JOIN THE SQUAD</h4>
              <p className="text-xs text-on-surface-variant mb-6 uppercase tracking-widest">Get early access to drops.</p>
              <form className="flex gap-2">
                <input className="bg-white/5 border border-white/10 px-4 py-3 text-xs w-full focus:outline-none focus:border-secondary" placeholder="EMAIL" type="email" />
                <button className="bg-secondary text-surface px-6 py-3 text-xs font-label-bold hover:brightness-110 transition-all">JOIN</button>
              </form>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-[0.2em]">© 2024 E-DRIFT PERFORMANCE ENGINEERING. ALL RIGHTS RESERVED.</p>
            <div className="flex gap-8 text-[10px] text-on-surface-variant uppercase tracking-[0.2em]">
              <a className="hover:text-white transition-colors" href="#">Privacy</a>
              <a className="hover:text-white transition-colors" href="#">Terms</a>
              <a className="hover:text-white transition-colors" href="#">Liability</a>
            </div>
          </div>
        </div>
        {/* Footer Technical Graphic */}
        <div className="absolute bottom-0 right-0 w-1/4 h-64 opacity-5 pointer-events-none">
          <div className="technical-grid w-full h-full" />
        </div>
      </footer>
    </div>
  );
}
