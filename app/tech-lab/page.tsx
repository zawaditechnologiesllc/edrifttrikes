export const metadata = { title: "The Tech Lab" };

export default function Page() {
  return (
    <div className="tech-grid min-h-screen">
      {/* Top Navigation Bar */}
      <nav className="w-full top-0 sticky z-50 border-b border-outline-variant bg-background/95 backdrop-blur-md">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-max-width mx-auto">
          <a className="font-display-lg text-headline-md text-primary tracking-tighter italic" href="#">VOLT DRIFT</a>
          <div className="hidden md:flex gap-8 items-center">
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold text-label-bold" href="#">TRIKES</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold text-label-bold" href="#">UPGRADES</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold text-label-bold" href="#">GEAR</a>
            <a className="text-secondary-fixed font-bold border-b-2 border-secondary-fixed pb-1 font-label-bold text-label-bold" href="#">TECH</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold text-label-bold" href="#">GARAGE</a>
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-on-surface cursor-pointer p-2 hover:bg-surface-container-highest rounded-full transition-all">shopping_cart</span>
            <span className="material-symbols-outlined text-on-surface cursor-pointer p-2 hover:bg-surface-container-highest rounded-full transition-all">account_circle</span>
          </div>
        </div>
      </nav>
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-8">
        {/* Hero Section */}
        <section className="mb-16 relative">
          <div className="relative w-full h-[500px] md:h-[600px] overflow-hidden rounded-xl border border-outline-variant group">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
            <img alt="DIY Build Guide" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBdEjVPn7mOkuAmwOOBSC1SMRM9E0YkltsqkecDgtaCETW38QCNPFLd9lw2hqE3wUrItitTSqQUP5-YHdH5VWIUMIqq5QKNQzPFF-ouL4avD1w1bDdu3LN4l1yNSNIe7qdzKbk15ptOTNHLV6k4sfr7cLrzGgvfv3RnXJotrw-TyPdM5wixuO_hSk-k0vTbb992VbXNfRTHt-QfR2s413aImAH1Bz32ojDPXLpeZJ3SFInP22BiRoTq0g" />
            <div className="absolute bottom-0 left-0 p-8 md:p-12 z-20 max-w-3xl">
              <span className="inline-block bg-secondary text-on-secondary px-3 py-1 text-label-bold font-label-bold mb-4 rounded-sm tracking-widest">FEATURED TECH</span>
              <h1 className="font-display-lg text-display-lg-mobile md:text-headline-xl text-on-surface mb-4 leading-none">MASTER THE DRIFT: THE ULTIMATE DIY BUILD GUIDE</h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-6 max-w-xl">From frame reinforcement to high-voltage wiring, we break down every bolt and byte needed to build a championship-grade electric drift trike.</p>
              <button className="bg-primary-container text-on-primary-container px-8 py-4 rounded-lg font-label-bold text-label-bold uppercase flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all">
                READ FULL GUIDE <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
            {/* Technical Overlay */}
            <div className="absolute top-8 right-8 z-20 hidden md:block">
              <div className="border border-outline-variant/30 p-4 backdrop-blur-sm bg-surface/40 text-[10px] font-mono text-secondary uppercase tracking-[0.2em] flex flex-col gap-1">
                <span>SYS_STATUS: OPTIMAL</span>
                <span>PWR_DRAW: 7.2KW</span>
                <span>DRIFT_MODE: ACTIVE</span>
              </div>
            </div>
          </div>
        </section>
        {/* Filter Chips */}
        <div className="flex flex-wrap gap-3 mb-12 items-center">
          <span className="text-on-surface-variant font-label-bold text-label-bold mr-4 uppercase tracking-tighter">Filter by:</span>
          <button className="px-6 py-2 rounded-full border-2 border-secondary-fixed bg-secondary-fixed text-on-secondary-fixed font-label-bold text-label-bold transition-all">ALL</button>
          <button className="px-6 py-2 rounded-full border border-outline hover:border-secondary hover:text-secondary transition-all font-label-bold text-label-bold">DIY BUILDS</button>
          <button className="px-6 py-2 rounded-full border border-outline hover:border-secondary hover:text-secondary transition-all font-label-bold text-label-bold">SLEEVE LAB</button>
          <button className="px-6 py-2 rounded-full border border-outline hover:border-secondary hover:text-secondary transition-all font-label-bold text-label-bold">SAFETY</button>
          <button className="px-6 py-2 rounded-full border border-outline hover:border-secondary hover:text-secondary transition-all font-label-bold text-label-bold">BUYING GUIDES</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Article Grid (Left Side) */}
          <div className="lg:col-span-8 space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {/* Card 1 */}
              <article className="group border border-outline-variant bg-surface-container-low rounded-xl overflow-hidden hover:border-secondary transition-all flex flex-col">
                <div className="relative h-56 w-full overflow-hidden">
                  <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="High-detail technical macro shot of an electric motor winding with glowing blue electric arcs, blueprints visible in a blurred background, industrial aesthetic, high-contrast, professional photography." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbeTeYqYcHI3WBnLTozvYJ9Fxl6670ZBUgMYqGFbZVLJ2YZ61Le2n9WLvU-0pjAl3FAWmlk8Qh52A_Rz594E_lEeZOlxW9GVKKGmT2gv6eQLtBwZwb0blsrQqizUifMLkR5ViEWFoCzXVitPktAOX2KLAqnDdhBSFrmS5vs1N3TM6w6EDCkq8-p8k_crBvJKkJglU4aL_Skvh6JkMQtaVLyZQWZUnNPcjirUvinOzZxjomL5SC367YOA" />
                  <div className="absolute top-4 left-4">
                    <span className="bg-surface-container-highest/80 backdrop-blur-md text-on-surface text-[10px] px-2 py-1 rounded border border-outline-variant">TECHNICAL</span>
                  </div>
                </div>
                <div className="p-6 flex-grow">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-3 group-hover:text-primary transition-colors">WIRING FOR WATTS: THE PRO CIRCUIT</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant line-clamp-3">Understanding gauge thickness and heat dissipation in 3000W+ drift setups. Essential for any high-performance build.</p>
                </div>
                <div className="p-6 pt-0 mt-auto flex justify-between items-center border-t border-outline-variant/10">
                  <span className="text-label-bold text-[12px] text-outline">12 MIN READ</span>
                  <span className="material-symbols-outlined text-secondary group-hover:translate-x-2 transition-transform">trending_flat</span>
                </div>
              </article>
              {/* Card 2 */}
              <article className="group border border-outline-variant bg-surface-container-low rounded-xl overflow-hidden hover:border-secondary transition-all flex flex-col">
                <div className="relative h-56 w-full overflow-hidden">
                  <img alt="Fitting drift sleeves" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHlm9L14L2yxsiG13bEJL382g8uxb5RQ37YZkvdLfSN_h3pfEIZcQzW1WRl98E_47uRCgCe-LUvloh7IJ5P8hcYMsB9insnVLTtc3y7gDjIakgNw46idD6mQ_V1pj8zMaWmm3R519o1M5uBJaaOP8qE7BOzNMcpSG8SHpclJb6B4mI58hvVNV7X_msznEYp4JP5PYu0ICLMszaahluB_ECLmgD1iiZGNF2QyHdFneNgm1e5Us9AKJ3Ow" />
                  <div className="absolute top-4 left-4">
                    <span className="bg-surface-container-highest/80 backdrop-blur-md text-on-surface text-[10px] px-2 py-1 rounded border border-outline-variant">MAINTENANCE</span>
                  </div>
                </div>
                <div className="p-6 flex-grow">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-3 group-hover:text-primary transition-colors">HOW TO FIT DRIFT SLEEVES</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant line-clamp-3">Tired of sleeves slipping mid-corner? Our proprietary heat-and-lock method ensures zero-slip sessions every time.</p>
                </div>
                <div className="p-6 pt-0 mt-auto flex justify-between items-center border-t border-outline-variant/10">
                  <span className="text-label-bold text-[12px] text-outline">8 MIN READ</span>
                  <span className="material-symbols-outlined text-secondary group-hover:translate-x-2 transition-transform">trending_flat</span>
                </div>
              </article>
            </div>
            {/* Card 3 (Asymmetric/Full Width in section) */}
            <article className="group grid grid-cols-1 md:grid-cols-5 border border-outline-variant bg-surface-container-low rounded-xl overflow-hidden hover:border-primary transition-all">
              <div className="md:col-span-2 relative h-64 md:h-full">
                <img className="w-full h-full object-cover" data-alt="Dramatic side-by-side comparison of two high-voltage lithium batteries, 72V vs 96V, set on a dark technical metal grid table, sparks of energy between them, cinematic studio lighting, voltage blue and neon green accents." src="https://lh3.googleusercontent.com/aida-public/AB6AXuB_DVfxPYwOohgYbp1BVhRLU1g75L1nx2EK1BCVRX-5Rwa-x4OMp3fYtkrExLrql8VAdrc0WTjrq--DkKziOvjnpuNq00AIPxTLbWaTykmxDQgqWxQRmv9js1DqMdxoQgSdzT7zvWf39sxPzsoj8C0gpv0SERrr4ErvkuXW4NhHj-vIkQf9jjgkpfOrpYVjLxTT_ToYAqCQbIO3kzjy5FIyVcwiqWeOCt0hkuPZn8rq1OkoKRXNw-A93w" />
              </div>
              <div className="md:col-span-3 p-8 flex flex-col justify-center">
                <span className="text-secondary font-label-bold text-[12px] mb-2 uppercase tracking-widest">Power Systems</span>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-4 group-hover:text-primary transition-colors">72V VS 96V: THE POWER BREAKDOWN</h3>
                <p className="font-body-lg text-body-lg text-on-surface-variant mb-6">Which voltage is right for your drift style? We compare torque curves, top speeds, and weight distribution for the two most popular power configurations.</p>
                <div className="flex gap-4">
                  <div className="flex flex-col border-l-2 border-outline-variant pl-4">
                    <span className="text-on-surface font-bold text-body-md">45 MPH</span>
                    <span className="text-outline text-[10px] uppercase">72V Top Speed</span>
                  </div>
                  <div className="flex flex-col border-l-2 border-outline-variant pl-4">
                    <span className="text-secondary font-bold text-body-md">65 MPH+</span>
                    <span className="text-outline text-[10px] uppercase">96V Top Speed</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
          {/* Sidebar (Right Side) */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Technical Manuals Section */}
            <div className="bg-surface-container-high p-8 border border-outline-variant rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-secondary/20 translate-x-12 -translate-y-12" />
              <h2 className="font-headline-md text-headline-md text-on-surface mb-6 uppercase flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">terminal</span>
                MOST READ MANUALS
              </h2>
              <ul className="space-y-6">
                <li className="group cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-label-bold text-label-bold text-on-surface group-hover:text-secondary transition-colors">VD-X1 CONTROLLER SETUP</h4>
                      <p className="text-[12px] text-outline mt-1">Version 4.2.0 Rev B</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface">download</span>
                  </div>
                </li>
                <li className="group cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-label-bold text-label-bold text-on-surface group-hover:text-secondary transition-colors">HUB MOTOR REWIRING GUIDE</h4>
                      <p className="text-[12px] text-outline mt-1">Internal Schematic #09</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface">download</span>
                  </div>
                </li>
                <li className="group cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-label-bold text-label-bold text-on-surface group-hover:text-secondary transition-colors">BMS BALANCING PROTOCOL</h4>
                      <p className="text-[12px] text-outline mt-1">Safety First - Li-ion</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface">download</span>
                  </div>
                </li>
              </ul>
              <button className="w-full mt-8 border border-outline text-on-surface py-3 font-label-bold text-label-bold hover:bg-secondary hover:text-on-secondary transition-all">VIEW ALL DOCUMENTATION</button>
            </div>
            {/* Newsletter Signup */}
            <div className="bg-primary-container p-8 rounded-xl border border-primary/30 relative overflow-hidden">
              {/* Tech background subtle line */}
              <div className="absolute inset-0 opacity-10 pointer-events-none tech-grid" />
              <h2 className="font-headline-md text-headline-md text-on-primary-container mb-2">TECHNICAL DROPS</h2>
              <p className="font-body-md text-body-md text-on-primary-container/80 mb-6">Get early access to tech sheets and experimental part lists before they hit the store.</p>
              <form className="space-y-4 relative z-10">
                <div className="relative">
                  <input className="w-full bg-surface-container-lowest border border-outline/50 px-4 py-3 text-on-surface font-mono text-[14px] focus:ring-2 focus:ring-secondary focus:border-transparent outline-none" placeholder="ENGINEER@VOLTDRIFT.COM" type="email" />
                  <span className="absolute right-4 top-3 text-outline text-[10px]">REQUIRED*</span>
                </div>
                <button className="w-full bg-secondary-fixed text-on-secondary-fixed py-4 font-label-bold text-label-bold uppercase tracking-widest hover:brightness-110 transition-all hazard-glow" type="submit">
                  ENLIST FOR INTEL
                </button>
              </form>
              <p className="mt-4 text-[10px] text-on-primary-container/60 uppercase text-center">NO SPAM. JUST HIGH-VOLTAGE UPDATES.</p>
            </div>
            {/* Featured Part Ad */}
            <div className="border-2 border-dashed border-outline-variant p-6 rounded-xl group cursor-pointer hover:border-secondary transition-all">
              <span className="text-[10px] text-outline font-bold uppercase mb-4 block tracking-widest">SPONSORED TECH</span>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-surface-container rounded border border-outline-variant flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-3xl">bolt</span>
                </div>
                <div>
                  <h4 className="font-label-bold text-label-bold text-on-surface">GIGA-LUBE 3000</h4>
                  <p className="text-sm text-outline">Extreme friction reduction for rear axles.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full relative mt-16 border-t border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-mobile md:px-margin-desktop py-12 max-w-max-width mx-auto gap-gutter">
          <div className="flex flex-col gap-6">
            <span className="font-display-lg text-headline-xl text-on-surface">VOLT DRIFT</span>
            <p className="text-on-surface-variant max-w-sm font-body-md text-body-md">
              Leading the charge in high-performance electric drift trike engineering. Join the revolution.
            </p>
            <div className="flex gap-4">
              <span className="material-symbols-outlined cursor-pointer hover:text-secondary">public</span>
              <span className="material-symbols-outlined cursor-pointer hover:text-secondary">smart_display</span>
              <span className="material-symbols-outlined cursor-pointer hover:text-secondary">share</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div className="flex flex-col gap-4">
              <h5 className="text-secondary font-label-bold text-label-bold uppercase tracking-widest">EXPLORE</h5>
              <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-md" href="#">TRIKES</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-md" href="#">UPGRADES</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-md" href="#">TRACK FINDER</a>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="text-secondary font-label-bold text-label-bold uppercase tracking-widest">SUPPORT</h5>
              <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-md" href="#">WARRANTY</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-md" href="#">SHIPPING</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-md" href="#">DEALERS</a>
            </div>
            <div className="flex flex-col gap-4 col-span-2 md:col-span-1">
              <h5 className="text-secondary font-label-bold text-label-bold uppercase tracking-widest">LEGAL</h5>
              <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-md" href="#">TERMS</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors font-body-md" href="#">PRIVACY</a>
            </div>
          </div>
        </div>
        <div className="w-full px-margin-mobile md:px-margin-desktop py-6 border-t border-outline-variant/10">
          <p className="text-center md:text-left text-outline text-[12px] font-body-md">
            © 2024 VOLT DRIFT MOTORSPORTS. ENGINEERED FOR PRECISION.
          </p>
        </div>
      </footer>
    </div>
  );
}
