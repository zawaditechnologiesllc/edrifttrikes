export const metadata = { title: "Order Confirmed" };

export default function Page() {
  return (
    <div className="bg-background text-on-background font-body-md selection:bg-secondary selection:text-black min-h-screen">
      {/* TopNavBar (Shared Component) */}
      <nav className="bg-surface dark:bg-surface-container-lowest text-primary dark:text-primary-fixed-dim w-full top-0 sticky border-b border-white/10 z-50">
        <div className="flex justify-between items-center w-full px-margin-desktop py-4 max-w-max-width mx-auto">
          <div className="font-headline-md text-headline-md text-secondary tracking-tighter">E-DRIFT</div>
          <div className="hidden md:flex gap-8 items-center">
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">TRIKES</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">PARTS</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">GEAR</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-secondary border-b-2 border-secondary pb-1" href="#">THE GARAGE</a>
          </div>
          <div className="flex gap-6 items-center">
            <span className="material-symbols-outlined cursor-pointer hover:bg-white/5 p-2 rounded-full transition-all active:scale-95">shopping_cart</span>
            <span className="material-symbols-outlined cursor-pointer hover:bg-white/5 p-2 rounded-full transition-all active:scale-95">person</span>
          </div>
        </div>
      </nav>
      <main className="relative overflow-hidden min-h-screen">
        {/* Technical Background */}
        <div className="absolute inset-0 technical-grid pointer-events-none opacity-40" />
        {/* Hero Section / Success Banner */}
        <section className="relative pt-24 pb-16 px-margin-desktop max-w-max-width mx-auto z-10">
          <div className="flex flex-col md:flex-row items-end gap-gutter mb-12">
            <div className="flex-1">
              <div className="inline-block bg-secondary text-black px-4 py-1 mb-4 font-label-bold uppercase slant-box">
                <span className="slant-content block">Order #ED-88291</span>
              </div>
              <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg leading-none uppercase mb-4 tracking-tighter">
                ORDER CONFIRMED.<br />
                <span className="text-secondary">PREPARE FOR DRIFT.</span>
              </h1>
              <p className="text-body-lg font-body-lg text-on-surface-variant max-w-2xl">
                The engineering team has been notified. Your high-performance drift machine is moving from digital blueprint to physical production.
              </p>
            </div>
            <div className="hidden lg:block w-1/3 h-48 opacity-20 border-r-4 border-secondary/30 relative">
              <div className="absolute right-0 bottom-0 text-[120px] font-headline-xl leading-none tracking-tighter select-none">ED-88291</div>
            </div>
          </div>
          {/* Bento Progress / Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
            {/* Timeline Column */}
            <div className="md:col-span-7 bg-surface-container-low border border-white/10 p-8 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-secondary/10 overflow-hidden">
                <div className="drift-line w-1/3 h-full bg-secondary" />
              </div>
              <h3 className="font-headline-md text-headline-md mb-8 uppercase tracking-tight">Mission Timeline</h3>
              <div className="space-y-12 relative">
                {/* Connector Line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-px bg-white/10" />
                {/* Step 1: Complete */}
                <div className="flex gap-6 items-start relative">
                  <div className="w-10 h-10 rounded-full bg-secondary text-black flex items-center justify-center shrink-0 z-10">
                    <span className="material-symbols-outlined" style={{fontVariationSettings: '"FILL" 1'}}>check_circle</span>
                  </div>
                  <div>
                    <p className="font-label-bold text-secondary uppercase mb-1">COMPLETED</p>
                    <h4 className="font-headline-md text-xl uppercase">Order Synced</h4>
                    <p className="text-on-surface-variant">Payment confirmed and inventory locked. Welcome to the elite roster.</p>
                  </div>
                </div>
                {/* Step 2: Active */}
                <div className="flex gap-6 items-start relative">
                  <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center shrink-0 z-10 border-2 border-primary ring-4 ring-primary-container/20">
                    <span className="material-symbols-outlined animate-pulse">settings</span>
                  </div>
                  <div>
                    <p className="font-label-bold text-primary uppercase mb-1">IN PROGRESS</p>
                    <h4 className="font-headline-md text-xl uppercase">Quality Assurance</h4>
                    <p className="text-on-surface-variant">Every component is undergoing stress testing and calibration to meet professional drift standards.</p>
                  </div>
                </div>
                {/* Step 3: Pending */}
                <div className="flex gap-6 items-start relative opacity-40">
                  <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 z-10">
                    <span className="material-symbols-outlined">local_shipping</span>
                  </div>
                  <div>
                    <p className="font-label-bold uppercase mb-1">UP NEXT</p>
                    <h4 className="font-headline-md text-xl uppercase">Stealth Shipping</h4>
                    <p className="text-on-surface-variant">Secure packaging and priority dispatch. Tracking link will be sent to your terminal.</p>
                  </div>
                </div>
              </div>
              <div className="mt-12 p-4 bg-white/5 border-l-4 border-primary">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">info</span>
                  <p className="text-body-md font-label-bold uppercase text-primary">Tracking Note</p>
                </div>
                <p className="text-on-surface-variant mt-2 text-sm">Tracking will activate once the unit leaves the Forge. Estimated dispatch: 48-72 hours.</p>
              </div>
            </div>
            {/* Summary & Community Column */}
            <div className="md:col-span-5 flex flex-col gap-gutter">
              {/* Order Summary Card */}
              <div className="bg-surface-container border border-white/10 p-8 rounded-lg">
                <h3 className="font-headline-md text-headline-md mb-6 uppercase tracking-tight">Drift Package</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/5 rounded flex items-center justify-center">
                        <span className="material-symbols-outlined text-secondary">electric_moped</span>
                      </div>
                      <div>
                        <p className="font-label-bold uppercase">Phantom-X Drift Trike</p>
                        <p className="text-xs text-on-surface-variant">Matte Obsidian / Voltage Blue</p>
                      </div>
                    </div>
                    <p className="font-label-bold">$2,499.00</p>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <p className="text-on-surface-variant font-label-bold uppercase">Shipping (Stealth)</p>
                    <p className="font-label-bold">FREE</p>
                  </div>
                  <div className="flex justify-between items-center pt-4">
                    <p className="text-xl font-headline-md uppercase text-secondary">Total Charged</p>
                    <p className="text-xl font-headline-md">$2,499.00</p>
                  </div>
                </div>
              </div>
              {/* Upsell Community Card */}
              <div className="bg-primary-container text-on-primary-container p-8 rounded-lg relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-10 -rotate-12 translate-x-4 -translate-y-4">
                  <span className="material-symbols-outlined text-[128px]">sports_motorsports</span>
                </div>
                <h3 className="font-headline-md text-2xl uppercase mb-2">Join The Garage</h3>
                <p className="mb-6 opacity-90 text-sm font-medium">Create your pilot account to access exclusive performance tuning guides, drift leaderboard, and local drift event invites.</p>
                <button className="w-full bg-white text-primary-container py-4 font-label-bold uppercase tracking-widest rounded shadow-lg hover:bg-on-surface transition-colors">
                  Create Account
                </button>
              </div>
              {/* Bottom Actions */}
              <div className="mt-auto">
                <button className="w-full group bg-transparent border-2 border-secondary text-secondary py-4 font-label-bold uppercase tracking-widest rounded flex items-center justify-center gap-3 hover:bg-secondary hover:text-black transition-all">
                  Continue to The Garage
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </section>
        {/* Aesthetic Decorative Section */}
        <section className="mt-24 mb-16 relative h-96 w-full">
          <div className="absolute inset-0 overflow-hidden diagonal-divider h-full w-full">
            <div className="w-full h-full grayscale opacity-30 hover:grayscale-0 transition-all duration-700 bg-cover bg-center" data-alt="A high-performance electric drift trike performing a sharp 45-degree angle drift on a damp asphalt track at night. The scene is illuminated by neon blue and hazard lime green lights reflecting off the wet surface. Motion blur emphasizes the speed and raw energy of the motorsport, while technical grid overlays suggest precision engineering. Dark industrial background with subtle lens flares." style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-rDnj25OX5IVs1I_BmkNNCnj5twbee49PDGq6ZewPh53hiT95nRfJhcH8Rg_otc8MRd-NaftCkcIq8veXmXjsvjyrDSLZClDMkjoCK9VIr6AYQfdRgJ5N36HssLaSqNObHLN0XQZMy5WtBMxmZ_1xMx72kRi8f7EfEwrpWeRUtNmVG-BBCXUaXaFKyhybdcHcuqSsuVYPUsbTgR4dVBH47eqiobiUwuK3I1Pq6h6oMfhgFJJPzarjFQ")'}} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-white text-[15vw] font-display-lg opacity-5 leading-none select-none tracking-tight">ADRENALINE</div>
          </div>
        </section>
      </main>
      {/* Footer (Shared Component) */}
      <footer className="bg-surface-container-lowest dark:bg-black w-full relative overflow-hidden border-t border-secondary/20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:20px_20px]">
        <div className="font-display-lg text-display-lg text-on-surface/10 absolute opacity-20 -bottom-8 -left-8 pointer-events-none">E-DRIFT</div>
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-desktop py-16 gap-gutter max-w-max-width mx-auto relative z-10">
          <div className="space-y-4">
            <h2 className="font-headline-md text-secondary uppercase tracking-tight">E-DRIFT MOTORS</h2>
            <p className="text-body-md text-on-surface-variant max-w-xs">Built for the streets, engineered for the circuit. Join the electric revolution.</p>
          </div>
          <div className="grid grid-cols-2 md:flex gap-12">
            <div className="flex flex-col gap-3">
              <p className="font-label-bold text-secondary uppercase mb-2">Company</p>
              <a className="text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Support</a>
              <a className="text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy</a>
              <a className="text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Shipping</a>
              <a className="text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Terms</a>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-label-bold text-secondary uppercase mb-2">Social</p>
              <a className="text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Instagram</a>
              <a className="text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">YouTube</a>
              <a className="text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Discord</a>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-6 w-full md:w-auto">
            <div className="font-label-bold text-on-surface-variant text-right">© 2024 E-DRIFT MOTORS. ENGINEERED FOR ADRENALINE.</div>
            <div className="flex gap-4">
              <div className="w-10 h-10 border border-secondary/30 rounded flex items-center justify-center hover:bg-secondary/10 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-secondary">rss_feed</span>
              </div>
              <div className="w-10 h-10 border border-secondary/30 rounded flex items-center justify-center hover:bg-secondary/10 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-secondary">rocket_launch</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
