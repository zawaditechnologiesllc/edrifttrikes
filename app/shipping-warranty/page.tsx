export const metadata = { title: "Shipping & Warranty" };

export default function Page() {
  return (
    <div className="bg-background text-on-background font-body-md selection:bg-secondary selection:text-background min-h-screen">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-background/95 backdrop-blur-md">
        <div className="flex justify-between items-center px-margin-desktop py-4 max-w-max-width mx-auto">
          <a className="font-headline-md text-headline-md text-secondary uppercase italic tracking-tighter" href="/product/volt-s1-pro">VOLT DRIFT</a>
          <div className="hidden md:flex gap-8 items-center">
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="/shop">Trikes</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Upgrades</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="/shop">Gear</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Tech</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors duration-300" href="#">Garage</a>
          </div>
          <div className="flex items-center gap-6">
            <button className="material-symbols-outlined text-primary hover:text-secondary transition-all">shopping_cart</button>
            <button className="material-symbols-outlined text-primary hover:text-secondary transition-all">account_circle</button>
          </div>
        </div>
      </nav>
      <main className="pt-24 min-h-screen">
        {/* Hero Header */}
        <header className="relative py-20 px-margin-desktop overflow-hidden border-b border-white/10 tech-grid">
          <div className="max-w-max-width mx-auto relative z-10">
            <div className="inline-block bg-primary text-on-primary px-4 py-1 mb-6 skew-x-[-15deg] font-label-bold text-label-bold">
              <span className="skew-x-[15deg] inline-block">OFFICIAL PROTOCOL</span>
            </div>
            <h1 className="font-display-lg text-display-lg uppercase italic tracking-tighter text-on-surface mb-4">
              LOGISTICS &amp; <span className="text-primary">ASSURANCE</span>
            </h1>
            <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
              Precision engineering meets uncompromising support. Our fulfillment network and protection plans are built with the same intensity as our electric drift trikes.
            </p>
          </div>
          <div className="absolute right-0 top-0 w-1/3 h-full opacity-20 pointer-events-none">
          </div>
        </header>
        {/* Section 1: Stealth Shipping */}
        <section className="py-24 px-margin-desktop bg-surface-container-lowest relative overflow-hidden">
          <div className="max-w-max-width mx-auto grid grid-cols-1 md:grid-cols-12 gap-gutter">
            <div className="md:col-span-5 flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-[2px] bg-secondary" />
                <span className="text-secondary font-label-bold tracking-widest uppercase">Phase 01</span>
              </div>
              <h2 className="font-headline-xl text-headline-xl uppercase mb-8 leading-none">STEALTH SHIPPING</h2>
              <p className="text-on-surface-variant mb-10 font-body-lg">
                Global deployment from our central logistics hubs. Every trike is crated in industrial-grade reinforced packaging to ensure it arrives ready for the asphalt.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4 group">
                  <span className="material-symbols-outlined text-primary group-hover:text-secondary transition-colors" style={{fontVariationSettings: '"FILL" 1'}}>speed</span>
                  <div>
                    <h4 className="font-label-bold text-on-surface mb-1">EXPRESS DELIVERY</h4>
                    <p className="text-on-surface-variant text-sm">Domestic: 3-5 Business Days. International: 7-12 Business Days via Global Stealth Cargo.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 group">
                  <span className="material-symbols-outlined text-primary group-hover:text-secondary transition-colors" style={{fontVariationSettings: '"FILL" 1'}}>location_on</span>
                  <div>
                    <h4 className="font-label-bold text-on-surface mb-1">REAL-TIME TELEMETRY</h4>
                    <p className="text-on-surface-variant text-sm">Encrypted tracking provided within 24 hours of dispatch. Monitor your drift machine’s journey.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="relative bg-surface-container h-full min-h-[400px] border border-white/5 rounded-lg overflow-hidden group">
                <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay">
                  <div className="w-full h-full tech-grid" />
                </div>
                <div className="relative z-10 p-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="bg-surface-container-highest p-4 rounded border border-white/10">
                      <span className="block text-[10px] text-primary-fixed mb-2 font-mono">NODE_LOCATION</span>
                      <span className="font-headline-md text-on-surface">GLOBAL HUBS</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-secondary font-label-bold">ACTIVE REGIONS</span>
                      <span className="text-on-surface-variant text-sm uppercase">North America / EU / Asia Pacific</span>
                    </div>
                  </div>
                  <div className="w-full h-48 bg-background/50 rounded-lg border border-white/10 overflow-hidden relative">
                    <div className="absolute inset-0 bg-cover bg-center" data-alt="A futuristic dark map interface with glowing blue lines connecting major global cities, showing a network of logistics routes with high-tech HUD elements, data points, and technical readouts on a deep charcoal background with subtle electric grid patterns." style={{backgroundImage: 'url("/assets/trike-voltage-blue.jpg")'}} />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-secondary">Signal Optimized</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Section 2: 30-Day Drift Guarantee */}
        <section className="py-24 px-margin-desktop bg-background">
          <div className="max-w-max-width mx-auto">
            <div className="flex flex-col md:flex-row gap-gutter items-end mb-16">
              <div className="flex-1">
                <h2 className="font-headline-xl text-headline-xl uppercase leading-none">THE 30-DAY <br /><span className="text-secondary italic">DRIFT GUARANTEE</span></h2>
              </div>
              <div className="flex-1 text-on-surface-variant">
                <p className="font-body-lg">Confidence comes standard. If your Volt Drift doesn't redefine your perception of adrenaline, our extraction team handles the rest.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="p-8 bg-surface-container-low border-b-2 border-transparent hover:border-secondary transition-all duration-300 hover:-translate-y-2 group">
                <span className="material-symbols-outlined text-4xl text-primary mb-6 group-hover:scale-110 transition-transform">assignment_return</span>
                <h3 className="font-headline-md text-on-surface uppercase mb-4">EASY REVERSAL</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">Initiate a return within 30 days of delivery. No interrogations. If the machine remains in pristine condition, we process full refunds minus logistics fees.</p>
              </div>
              {/* Card 2 */}
              <div className="p-8 bg-surface-container-low border-b-2 border-transparent hover:border-secondary transition-all duration-300 hover:-translate-y-2 group">
                <span className="material-symbols-outlined text-4xl text-primary mb-6 group-hover:scale-110 transition-transform">inventory_2</span>
                <h3 className="font-headline-md text-on-surface uppercase mb-4">CRATE RETENTION</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">Keep the original high-impact crating for 30 days. It is required for secure return transit to maintain the integrity of the chassis.</p>
              </div>
              {/* Card 3 */}
              <div className="p-8 bg-surface-container-low border-b-2 border-transparent hover:border-secondary transition-all duration-300 hover:-translate-y-2 group">
                <span className="material-symbols-outlined text-4xl text-primary mb-6 group-hover:scale-110 transition-transform">verified</span>
                <h3 className="font-headline-md text-on-surface uppercase mb-4">QUALITY CLEARANCE</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">Returns undergo a 12-point technical inspection by our engineering team to ensure electronics and frame integrity before refund finalization.</p>
              </div>
            </div>
          </div>
        </section>
        {/* Section 3: Warranty Details */}
        <section className="py-24 px-margin-desktop bg-surface-container-lowest relative">
          <div className="max-w-max-width mx-auto">
            <div className="text-center mb-20">
              <h2 className="font-headline-xl text-headline-xl uppercase tracking-tighter mb-4">WARRANTY <span className="text-primary italic">PROTOCOLS</span></h2>
              <div className="h-1 w-24 bg-primary mx-auto" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
              {/* Left Technical Column */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-surface-container p-6 border-l-4 border-secondary hover:bg-surface-container-high transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-label-bold text-on-surface uppercase">Chassis &amp; Fork</h4>
                    <span className="bg-secondary text-background px-2 py-0.5 text-[10px] font-bold rounded">LIFETIME</span>
                  </div>
                  <p className="text-on-surface-variant text-sm">Full structural warranty against material defects or manufacturing flaws in the high-tensile steel frame.</p>
                </div>
                <div className="bg-surface-container p-6 border-l-4 border-primary hover:bg-surface-container-high transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-label-bold text-on-surface uppercase">Propulsion Unit</h4>
                    <span className="bg-primary text-on-primary px-2 py-0.5 text-[10px] font-bold rounded">24 MONTHS</span>
                  </div>
                  <p className="text-on-surface-variant text-sm">Covers the brushless hub motor and controller logic boards against electrical failure under standard drift load.</p>
                </div>
                <div className="bg-surface-container p-6 border-l-4 border-primary hover:bg-surface-container-high transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-label-bold text-on-surface uppercase">Energy Cells</h4>
                    <span className="bg-primary text-on-primary px-2 py-0.5 text-[10px] font-bold rounded">12 MONTHS</span>
                  </div>
                  <p className="text-on-surface-variant text-sm">Coverage against capacity drop below 70% of original rating. Batteries are swappable for zero downtime.</p>
                </div>
              </div>
              {/* Right Illustration Column */}
              <div className="lg:col-span-8">
                <div className="bg-surface-container-low p-1 rounded-lg border border-white/5 relative aspect-video overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center" data-alt="A technical blueprint rendering of a high-performance electric drift trike on a dark gray surface, highlighting the motor, battery pack, and frame with glowing blue and green callout lines and labels, reflecting a precision engineering and high-tech automotive aesthetic." style={{backgroundImage: 'url("/assets/parts-performance.jpg")'}} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-full border-[20px] border-background/20" />
                  </div>
                  <div className="absolute bottom-8 right-8 bg-background/90 backdrop-blur-sm p-6 border border-primary/30 max-w-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 bg-secondary rounded-sm" />
                      <span className="text-on-surface font-label-bold text-xs uppercase tracking-widest">Technician Support</span>
                    </div>
                    <p className="text-on-surface-variant text-xs mb-4">Direct access to our engineering discord and live technical support. We provide remote diagnostics and expedited component replacement kits globally.</p>
                    <button className="w-full py-3 bg-primary text-on-primary font-label-bold uppercase text-xs hover:bg-secondary hover:text-background transition-colors skew-hover">CONTACT ENGINEERING</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* CTA Section */}
        <section className="py-32 px-margin-desktop text-center relative overflow-hidden bg-background">
          <div className="absolute inset-0 z-0 opacity-10">
          </div>
          <div className="max-w-3xl mx-auto relative z-10">
            <h2 className="font-display-lg text-display-lg uppercase italic tracking-tighter mb-8">READY TO <span className="text-secondary">COMMIT?</span></h2>
            <div className="flex flex-col md:flex-row justify-center gap-6">
              <button className="px-10 py-5 bg-secondary text-background font-label-bold uppercase text-lg tracking-widest hover:brightness-110 transition-all skew-x-[-15deg]">
                <span className="skew-x-[15deg] inline-block">GO TO SHOP</span>
              </button>
              <button className="px-10 py-5 border-2 border-on-surface text-on-surface font-label-bold uppercase text-lg tracking-widest hover:bg-on-surface hover:text-background transition-all skew-x-[-15deg]">
                <span className="skew-x-[15deg] inline-block">VIEW TECHNICAL SPECS</span>
              </button>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-white/10 mt-margin-desktop">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-desktop py-16 max-w-max-width mx-auto">
          <div className="col-span-1 md:col-span-1">
            <h3 className="font-headline-md text-headline-md text-on-surface uppercase italic mb-6">VOLT DRIFT</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-8">
              Pushing the boundaries of electric performance. Engineered for the drift, built for the adrenaline.
            </p>
            <div className="flex gap-4">
              <a className="w-10 h-10 flex items-center justify-center border border-white/10 rounded-full hover:border-secondary hover:text-secondary transition-all" href="#">
                <span className="material-symbols-outlined text-sm">share</span>
              </a>
              <a className="w-10 h-10 flex items-center justify-center border border-white/10 rounded-full hover:border-secondary hover:text-secondary transition-all" href="#">
                <span className="material-symbols-outlined text-sm">podcasts</span>
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-primary font-label-bold uppercase mb-4">Navigation</h4>
            <a className="text-on-surface-variant hover:text-on-surface transition-transform hover:translate-x-1" href="#">Manuals</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-transform hover:translate-x-1" href="#">Safety Data</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-transform hover:translate-x-1" href="#">Battery Tech</a>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-primary font-label-bold uppercase mb-4">Support</h4>
            <a className="text-on-surface-variant hover:text-on-surface transition-transform hover:translate-x-1" href="/shipping-warranty">Shipping</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-transform hover:translate-x-1" href="/shipping-warranty">Warranty</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-transform hover:translate-x-1" href="/support">Contact</a>
          </div>
          <div className="flex flex-col gap-6">
            <h4 className="text-primary font-label-bold uppercase mb-4">HQ Dispatch</h4>
            <div className="relative">
              <input className="w-full bg-surface-container border border-white/10 rounded p-4 text-xs font-label-bold focus:border-primary focus:ring-0 outline-none uppercase tracking-widest" placeholder="ENLIST FOR UPDATES" type="email" />
              <button className="absolute right-2 top-2 h-10 w-10 bg-secondary text-background flex items-center justify-center">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <p className="text-[10px] text-outline uppercase tracking-tighter">© 2024 VOLT DRIFT ENGINEERING. ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
