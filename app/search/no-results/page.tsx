export const metadata = { title: "No Results" };

export default function Page() {
  return (
    <div className="bg-background text-on-surface font-body-md selection:bg-secondary selection:text-black min-h-screen">
      {/* TopNavBar */}
      <header className="w-full top-0 sticky z-50 bg-surface dark:bg-surface-container-lowest border-b border-white/10">
        <nav className="flex justify-between items-center w-full px-margin-desktop py-4 max-w-max-width mx-auto">
          <div className="flex items-center gap-8">
            <a className="font-headline-md text-headline-md text-secondary tracking-tighter" href="/">E-DRIFT</a>
            <div className="hidden md:flex gap-6">
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="/shop">TRIKES</a>
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="/shop">PARTS</a>
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="/shop">GEAR</a>
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="/tech-lab">THE GARAGE</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <input className="bg-surface-container-high border-none text-on-surface font-label-bold text-xs uppercase px-4 py-2 pr-10 focus:ring-1 focus:ring-secondary w-64 transition-all" placeholder="SEARCH..." type="text" />
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            </div>
            <div className="flex gap-4">
              <button className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-colors">shopping_cart</button>
              <button className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-colors">person</button>
            </div>
          </div>
        </nav>
      </header>
      <main className="relative min-h-screen overflow-hidden technical-grid">
        {/* Background Atmospheric Element */}
        <section className="max-w-max-width mx-auto px-margin-desktop py-24 relative z-10">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 mb-12 font-label-bold text-label-bold uppercase text-on-surface-variant">
            <span>SHOP</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span>SEARCH RESULTS</span>
          </div>
          {/* Main Heading */}
          <div className="mb-16">
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg uppercase text-on-surface flex flex-col">
              <span className="text-secondary opacity-50 text-headline-md font-label-bold tracking-widest mb-4">SYSTEM ERROR: 404_ITEMS_FOUND</span>
              0 RESULTS FOUND FOR <span className="text-secondary italic">"NITROUS KIT"</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mt-6 border-l-4 border-secondary pl-6">
              We don't stock that yet, but our engineers are constantly pushing the limits of electric drifting. Try these popular performance categories instead:
            </p>
          </div>
          {/* Recommendation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Card 1: Electric Trikes */}
            <div className="group relative aspect-[4/5] bg-surface-container-low border border-white/10 rounded-lg overflow-hidden power-on-glow transition-all duration-500">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" data-alt="A high-performance electric drift trike with a lime green frame, wide rear PVC sleeves, and glowing LED accents, photographed in a dark industrial garage with concrete textures and technical blueprint lines visible on the floor." style={{backgroundImage: 'url("/assets/motor-72v-hub.jpg")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-8">
                <h3 className="font-headline-md text-headline-md text-white uppercase mb-2">ELECTRIC TRIKES</h3>
                <p className="font-label-bold text-label-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                  EXPLORE BUILDS <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform">arrow_forward</span>
                </p>
              </div>
            </div>
            {/* Card 2: Drift Sleeves */}
            <div className="group relative aspect-[4/5] bg-surface-container-low border border-white/10 rounded-lg overflow-hidden power-on-glow transition-all duration-500">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" data-alt="Close-up of premium black PVC drift sleeves being fitted onto a high-performance tire, with sparks flying in the background to suggest a workshop environment. The lighting is moody and focused on the technical texture of the materials." style={{backgroundImage: 'url("/assets/action-mid-slide.jpg")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-8">
                <h3 className="font-headline-md text-headline-md text-white uppercase mb-2">DRIFT SLEEVES</h3>
                <p className="font-label-bold text-label-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                  REDUCE TRACTION <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform">arrow_forward</span>
                </p>
              </div>
            </div>
            {/* Card 3: The Garage */}
            <div className="group relative aspect-[4/5] bg-surface-container-low border border-white/10 rounded-lg overflow-hidden power-on-glow transition-all duration-500">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" data-alt="A wide angle view of a professional high-tech motorsport garage featuring rows of custom electric trikes, neon overhead lighting, tool chests organized with precision, and a large digital screen displaying telemetry data. The color palette is dark charcoal and voltage blue." style={{backgroundImage: 'url("/assets/volt-s1-pro-hero.jpg")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-8">
                <h3 className="font-headline-md text-headline-md text-white uppercase mb-2">THE GARAGE</h3>
                <p className="font-label-bold text-label-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                  VIEW GALLERY <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform">arrow_forward</span>
                </p>
              </div>
            </div>
          </div>
          {/* Custom Build CTA Section */}
          <div className="mt-24 bg-surface-container-high border border-white/10 rounded-lg p-12 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-9xl">engineering</span>
            </div>
            <div className="relative z-10 max-w-xl text-center md:text-left mb-8 md:mb-0">
              <h2 className="font-headline-xl text-headline-xl uppercase text-white mb-4">NEED A CUSTOM BUILD?</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                If you're looking for high-performance kits we don't list yet, our engineering team can build bespoke solutions for your specific drift setup.
              </p>
            </div>
            <button className="relative z-10 bg-secondary text-black font-label-bold text-label-bold uppercase px-12 py-5 rounded-lg hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-secondary/20">
              CONTACT OUR ENGINEERS
            </button>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="w-full relative overflow-hidden bg-surface-container-lowest dark:bg-black border-t border-secondary/20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:20px_20px]">
        <div className="font-display-lg text-display-lg text-on-surface/10 absolute opacity-20 -bottom-10 left-0 select-none pointer-events-none">E-DRIFT</div>
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-desktop py-16 gap-gutter max-w-max-width mx-auto relative z-10">
          <div className="flex flex-col gap-6">
            <h4 className="font-headline-md text-headline-md text-secondary">E-DRIFT MOTORS</h4>
            <p className="font-body-md text-body-md max-w-xs text-on-surface-variant">Pushing the boundaries of street motorsport with zero-emission electric adrenaline.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="flex flex-col gap-4">
              <span className="font-label-bold text-label-bold uppercase text-white tracking-widest">LINKS</span>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="/support">Support</a>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy</a>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="/shipping-warranty">Shipping</a>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Terms</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="font-label-bold text-label-bold uppercase text-white tracking-widest">SOCIAL</span>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Instagram</a>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">YouTube</a>
              <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">TikTok</a>
            </div>
          </div>
        </div>
        <div className="w-full px-margin-desktop py-6 border-t border-white/5 text-center max-w-max-width mx-auto">
          <p className="font-body-md text-body-md text-on-surface-variant opacity-50 uppercase tracking-widest">© 2024 E-DRIFT MOTORS. ENGINEERED FOR ADRENALINE.</p>
        </div>
      </footer>
    </div>
  );
}
