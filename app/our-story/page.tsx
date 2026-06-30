export const metadata = { title: "Our Story" };

export default function Page() {
  return (
    <div className="bg-background min-h-screen">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-background/95 backdrop-blur-md">
        <div className="flex justify-between items-center px-margin-desktop py-4 max-w-max-width mx-auto">
          <a className="font-headline-md text-headline-md text-secondary uppercase italic tracking-tighter" href="/product/volt-s1-pro">VOLT DRIFT</a>
          <div className="hidden md:flex items-center space-x-8">
            <a className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="/shop">Trikes</a>
            <a className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Upgrades</a>
            <a className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="/shop">Gear</a>
            <a className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Tech</a>
            <a className="font-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Garage</a>
          </div>
          <div className="flex items-center space-x-6">
            <button className="text-on-surface-variant hover:text-secondary duration-300 active:skew-x-[-12deg] transition-transform" data-nav="/cart">
              <span className="material-symbols-outlined" data-icon="shopping_cart">shopping_cart</span>
            </button>
            <button className="text-on-surface-variant hover:text-secondary duration-300 active:skew-x-[-12deg] transition-transform" data-nav="/login">
              <span className="material-symbols-outlined" data-icon="account_circle">account_circle</span>
            </button>
            <button className="md:hidden text-on-surface-variant">
              <span className="material-symbols-outlined" data-icon="menu">menu</span>
            </button>
          </div>
        </div>
      </nav>
      {/* Main Content Canvas */}
      <main className="pt-24">
        {/* Hero Section: BORN IN THE GARAGE */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden technical-grid">
          <div className="absolute inset-0 z-0">
            <img alt="Electric drift trike action" className="w-full h-full object-cover opacity-60 mix-blend-luminosity" src="/assets/action-mid-slide.jpg" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            {/* Slanted overlay element */}
            <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/10 -skew-x-12 transform translate-x-1/2" />
          </div>
          <div className="relative z-10 px-margin-desktop max-w-max-width mx-auto w-full grid grid-cols-12 gap-gutter">
            <div className="col-span-12 md:col-span-8 lg:col-span-7">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px w-12 bg-secondary" />
                <span className="text-secondary font-label-bold uppercase tracking-[0.2em]">Our Mission</span>
              </div>
              <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg uppercase leading-none mb-8 italic">
                BORN IN THE <span className="text-primary italic">GARAGE</span>
              </h1>
              <div className="bg-surface-container/80 backdrop-blur-md p-8 border-l-4 border-secondary max-w-2xl">
                <p className="font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
                  It started with a welder, a pile of scrap chromoly tubing, and a singular obsession: the perfect slide. Our founder, a former street racer turned electrical engineer, spent three years of late nights in a humid suburban garage chasing the physics of a zero-traction environment. 
                </p>
                <p className="mt-4 font-body-lg text-body-lg leading-relaxed text-on-surface-variant">
                  The goal wasn't just to drift—it was to control the chaos. We traded loud pistons for silent torque, discovering that electric propulsion wasn't just cleaner; it was the key to surgical precision in every corner.
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* Section 2: Technical Rigor */}
        <section className="py-24 bg-surface-container-lowest relative overflow-hidden">
          {/* Diagonal Divider */}
          <div className="absolute top-0 left-0 w-full h-24 bg-background -translate-y-12 -skew-y-3 z-0" />
          <div className="relative z-10 px-margin-desktop max-w-max-width mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div className="order-2 md:order-1">
                <div className="relative group">
                  {/* Tech Grid Background for Image */}
                  <div className="absolute inset-0 bg-primary/5 translate-x-4 translate-y-4 -z-10 group-hover:translate-x-6 group-hover:translate-y-6 transition-transform duration-500" />
                  <div className="aspect-square bg-surface-container-high relative overflow-hidden border border-white/10 p-1">
                    <div className="absolute inset-0 technical-grid opacity-20" />
                    <div className="w-full h-full bg-cover bg-center" data-alt="A high-tech cinematic close-up of a high-performance electric drift trike motor and battery system. The components are sleek and metallic, with exposed copper windings and carbon fiber housings. Cool blue LED light strips trace the electrical pathways, suggesting immense power and cutting-edge engineering. The background is a clean, dark industrial laboratory setting with technical blueprint lines visible on a digital screen." style={{backgroundImage: 'url("/assets/parts-performance.jpg")'}} />
                    {/* Technical Overlays */}
                    <div className="absolute top-4 left-4 font-label-bold text-[10px] text-secondary opacity-50">SYSTEM_VOLTAGE: 72V_DC</div>
                    <div className="absolute bottom-4 right-4 font-label-bold text-[10px] text-secondary opacity-50">TORQUE_MAP: STAGE_03</div>
                  </div>
                </div>
              </div>
              <div className="order-1 md:order-2">
                <h2 className="font-headline-xl text-headline-xl uppercase mb-8 leading-tight">
                  FROM GAS TO <br /><span className="text-primary italic">VOLTAGE</span>
                </h2>
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-2 h-2 bg-secondary" />
                      <h3 className="font-label-bold uppercase text-on-surface">The Propulsion Shift</h3>
                    </div>
                    <p className="text-on-surface-variant">Gas engines are binary. They're loud, messy, and lack the instantaneous response needed for high-stakes drifting. Our 72V hub-motors provide 100% torque from zero RPM, allowing for micro-adjustments in wheel speed that were previously impossible.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-2 h-2 bg-secondary" />
                      <h3 className="font-label-bold uppercase text-on-surface">Thermal Management</h3>
                    </div>
                    <p className="text-on-surface-variant">Long slides generate extreme heat. We engineered a proprietary liquid-cooling loop for our drift-series controllers, ensuring that power delivery remains constant even when the asphalt is melting beneath you.</p>
                  </div>
                  <button className="px-8 py-4 bg-primary text-on-primary font-label-bold uppercase tracking-widest rounded-lg hover:bg-secondary hover:text-black transition-all duration-300 voltage-glow group">
                    View Technical Specs
                    <span className="material-symbols-outlined align-middle ml-2 group-hover:translate-x-1 transition-transform" data-icon="arrow_forward">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Section 3: The Squad (Bento Grid) */}
        <section className="py-32 px-margin-desktop max-w-max-width mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div>
              <span className="text-secondary font-label-bold uppercase tracking-[0.2em] mb-4 block">Community</span>
              <h2 className="font-display-lg text-headline-xl md:text-display-lg uppercase italic leading-none">THE SQUAD</h2>
            </div>
            <p className="max-w-md text-on-surface-variant font-body-lg italic border-l-2 border-primary pl-6">
              "We don't just sell trikes. We build the grid. From illegal midnight meetups to sanctioned drift circuits, the VOLT DRIFT family is rewriting street motorsport."
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-gutter h-auto md:h-[800px]">
            {/* Bento Item 1 */}
            <div className="md:col-span-2 md:row-span-2 relative group overflow-hidden border border-white/5">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" data-alt="A group of diverse, professional-looking drift riders standing together in an industrial warehouse setting. They are wearing high-end tactical gear and helmets with blue reflective visors. Several sleek black electric drift trikes are parked around them. The lighting is cinematic with deep shadows and vibrant blue neon accents casting a glow on the concrete floor. The mood is one of serious camaraderie and technical expertise." style={{backgroundImage: 'url("/assets/trike-voltage-blue.jpg")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-80" />
              <div className="absolute bottom-0 left-0 p-8">
                <div className="bg-secondary text-black font-label-bold uppercase px-3 py-1 inline-block mb-4">Elite Division</div>
                <h3 className="font-headline-md text-headline-md uppercase italic">Worldwide Chapters</h3>
              </div>
            </div>
            {/* Bento Item 2 */}
            <div className="md:col-span-2 relative group overflow-hidden border border-white/5">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" data-alt="An overhead cinematic shot of multiple electric drift trikes performing a synchronized tandem drift on a wet city street at night. The streaks of neon blue light from the trikes create beautiful kinetic patterns on the dark, reflective pavement. The surrounding architecture is modern and industrial, with high-contrast lighting creating a high-adrenaline motorsport atmosphere." style={{backgroundImage: 'url("/assets/action-mid-slide.jpg")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-80" />
              <div className="absolute bottom-0 left-0 p-8">
                <h3 className="font-headline-md text-headline-md uppercase italic">The Tandem Life</h3>
              </div>
            </div>
            {/* Bento Item 3 */}
            <div className="md:col-span-1 relative group overflow-hidden border border-white/5">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" data-alt="Close up of a customized electric drift trike seat featuring high-quality Alcantara fabric and contrast neon blue stitching. The background is a blurry workshop with tools and technical diagrams. The focus is on the craftsmanship and premium materials used in every build. The lighting is soft and focused, emphasizing the tactile quality of the materials." style={{backgroundImage: 'url("/assets/trike-voltage-blue.jpg")'}} />
              <div className="absolute inset-0 bg-background/40 group-hover:bg-background/20 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-label-bold uppercase tracking-widest text-secondary group-hover:scale-110 transition-transform">Custom Garage</span>
              </div>
            </div>
            {/* Bento Item 4 */}
            <div className="md:col-span-1 relative group overflow-hidden border border-white/5 bg-surface-container-high flex flex-col justify-center p-8">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="material-symbols-outlined text-8xl" data-icon="electric_bolt">electric_bolt</span>
              </div>
              <h4 className="font-headline-md text-headline-md text-primary uppercase leading-tight mb-4">12K+</h4>
              <p className="font-label-bold uppercase text-on-surface-variant text-sm">Active Riders globally across 42 chapters.</p>
              <hr className="my-6 border-white/10" />
              <a className="text-secondary font-label-bold uppercase flex items-center gap-2 text-xs hover:gap-4 transition-all" href="#">
                Join The Movement <span className="material-symbols-outlined text-sm" data-icon="north_east">north_east</span>
              </a>
            </div>
          </div>
        </section>
        {/* CTA Section */}
        <section className="py-24 technical-grid border-y border-white/5">
          <div className="px-margin-desktop max-w-max-width mx-auto text-center">
            <h2 className="font-display-lg text-display-lg-mobile md:text-display-lg uppercase italic mb-8">Ready to <span className="text-secondary">Shift?</span></h2>
            <div className="flex flex-col md:flex-row gap-6 justify-center">
              <button className="px-12 py-5 bg-secondary text-black font-headline-md uppercase italic hover:bg-primary hover:text-on-primary transition-all duration-300">
                Build Your Trike
              </button>
              <button className="px-12 py-5 border border-white/20 text-on-surface font-headline-md uppercase italic hover:bg-white/5 transition-all duration-300">
                Find a Chapter
              </button>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="w-full mt-margin-desktop border-t border-white/10 bg-surface-container-lowest">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-desktop py-16 max-w-max-width mx-auto">
          <div className="col-span-1 md:col-span-1">
            <span className="font-headline-md text-headline-md text-on-surface uppercase italic block mb-6">VOLT DRIFT</span>
            <p className="text-on-surface-variant text-sm pr-8">High-performance electric drifting engineered for the street expert. Born in the garage, optimized for the circuit.</p>
          </div>
          <div>
            <h4 className="font-label-bold uppercase text-secondary mb-6 tracking-widest">Engineering</h4>
            <ul className="space-y-4 font-body-md text-body-md">
              <li><a className="text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform inline-block" href="#">Manuals</a></li>
              <li><a className="text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform inline-block" href="#">Safety Data</a></li>
              <li><a className="text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform inline-block" href="#">Battery Tech</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-label-bold uppercase text-secondary mb-6 tracking-widest">Support</h4>
            <ul className="space-y-4 font-body-md text-body-md">
              <li><a className="text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform inline-block" href="/shipping-warranty">Shipping</a></li>
              <li><a className="text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform inline-block" href="/shipping-warranty">Warranty</a></li>
              <li><a className="text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform inline-block" href="/support">Contact</a></li>
            </ul>
          </div>
          <div className="flex flex-col justify-between">
            <div>
              <h4 className="font-label-bold uppercase text-secondary mb-6 tracking-widest">Socials</h4>
              <div className="flex gap-4">
                <a className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-secondary hover:text-black transition-colors" href="#"><span className="material-symbols-outlined" data-icon="bolt">bolt</span></a>
                <a className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-secondary hover:text-black transition-colors" href="#"><span className="material-symbols-outlined" data-icon="videocam">videocam</span></a>
                <a className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-secondary hover:text-black transition-colors" href="#"><span className="material-symbols-outlined" data-icon="share">share</span></a>
              </div>
            </div>
            <div className="mt-12 md:mt-0 text-[10px] text-on-surface-variant opacity-50 uppercase tracking-widest">
              © 2024 VOLT DRIFT ENGINEERING. ALL RIGHTS RESERVED.
            </div>
          </div>
        </div>
      </footer>
      {/* FAB for quick action (Suppressed as per rules on detail/info pages, but we could place it on home) */}
    </div>
  );
}
