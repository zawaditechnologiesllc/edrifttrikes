export const metadata = { title: "Rider Dashboard" };

export default function Page() {
  return (
    <div className="bg-background text-on-background font-body-md selection:bg-secondary selection:text-on-secondary min-h-screen">
      {/* Dashboard Layout Wrapper */}
      <div className="flex min-h-screen">
        {/* Sidebar Navigation (Anchor: SideNav Logic) */}
        <aside className="w-72 bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col sticky top-0 h-screen overflow-y-auto">
          <div className="p-8">
            <span className="font-headline-md text-headline-md text-secondary tracking-tighter uppercase">E-DRIFT</span>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            {/* Dashboard Active State */}
            <a className="flex items-center gap-4 px-4 py-3 bg-primary-container text-on-primary-container rounded-lg transition-all duration-75 active:scale-95" href="#">
              <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
              <span className="font-label-bold text-label-bold uppercase">Dashboard</span>
            </a>
            <a className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:bg-white/5 transition-all rounded-lg active:scale-95" href="#orders">
              <span className="material-symbols-outlined" data-icon="package_2">package_2</span>
              <span className="font-label-bold text-label-bold uppercase">Orders &amp; Tracking</span>
            </a>
            <a className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:bg-white/5 transition-all rounded-lg active:scale-95" href="#builds">
              <span className="material-symbols-outlined" data-icon="settings_wrench">settings_alert</span>
              <span className="font-label-bold text-label-bold uppercase">My Builds</span>
            </a>
            <a className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:bg-white/5 transition-all rounded-lg active:scale-95" href="#">
              <span className="material-symbols-outlined" data-icon="favorite">favorite</span>
              <span className="font-label-bold text-label-bold uppercase">Wishlist</span>
            </a>
            <div className="pt-8 pb-4 px-4">
              <span className="text-[10px] text-outline uppercase tracking-widest font-bold">Account</span>
            </div>
            <a className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:bg-white/5 transition-all rounded-lg active:scale-95" href="#">
              <span className="material-symbols-outlined" data-icon="location_on">location_on</span>
              <span className="font-label-bold text-label-bold uppercase">Addresses</span>
            </a>
            <a className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:bg-white/5 transition-all rounded-lg active:scale-95" href="#">
              <span className="material-symbols-outlined" data-icon="payments">payments</span>
              <span className="font-label-bold text-label-bold uppercase">Payment</span>
            </a>
            <a className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:bg-white/5 transition-all rounded-lg active:scale-95" href="#">
              <span className="material-symbols-outlined" data-icon="settings">settings</span>
              <span className="font-label-bold text-label-bold uppercase">Settings</span>
            </a>
          </nav>
          <div className="p-8">
            <button className="w-full flex items-center justify-center gap-2 py-3 border border-outline-variant/30 rounded-lg text-error font-label-bold text-label-bold uppercase hover:bg-error/10 transition-colors">
              <span className="material-symbols-outlined" data-icon="logout">logout</span>
              Sign Out
            </button>
          </div>
        </aside>
        {/* Main Content Area */}
        <main className="flex-1 bg-surface-container-low min-h-screen technical-grid">
          {/* Top App Bar (Contextual) */}
          <header className="w-full bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 z-30 px-margin-desktop py-6 flex justify-between items-center border-b border-outline-variant/10">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-secondary" data-icon="bolt">bolt</span>
              <h1 className="font-headline-md text-headline-md text-on-surface uppercase tracking-tighter">Welcome back, Drifter</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full border-2 border-surface-container-lowest bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold">JD</div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" data-icon="notifications">notifications</span>
            </div>
          </header>
          <div className="px-margin-desktop py-8 max-w-max-width mx-auto space-y-gutter">
            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              <div className="bg-surface-container p-6 border border-outline-variant/20 cut-corner group hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-outline uppercase text-[10px] font-bold tracking-widest">Active Orders</span>
                  <span className="material-symbols-outlined text-secondary" data-icon="local_shipping">local_shipping</span>
                </div>
                <div className="font-headline-xl text-headline-xl text-on-surface">01</div>
                <div className="text-on-surface-variant text-sm mt-2">VOLT-S1 Pro • Expected Friday</div>
              </div>
              <div className="bg-surface-container p-6 border border-outline-variant/20 cut-corner group hover:border-secondary/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-outline uppercase text-[10px] font-bold tracking-widest">Build Status</span>
                  <span className="material-symbols-outlined text-secondary" data-icon="engineering">engineering</span>
                </div>
                <div className="font-headline-xl text-headline-xl text-on-surface">84%</div>
                <div className="text-on-surface-variant text-sm mt-2">Custom Drift Rig • Motor Calibrated</div>
              </div>
              <div className="bg-surface-container p-6 border border-outline-variant/20 cut-corner group hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-outline uppercase text-[10px] font-bold tracking-widest">Garage Points</span>
                  <span className="material-symbols-outlined text-secondary" data-icon="stars">stars</span>
                </div>
                <div className="font-headline-xl text-headline-xl text-on-surface">2,450</div>
                <div className="text-on-surface-variant text-sm mt-2">Next reward: 500 points away</div>
              </div>
            </div>
            {/* Bento Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
              {/* My Builds (Large Bento Item) */}
              <section className="lg:col-span-8 space-y-gutter" id="builds">
                <div className="bg-surface-container-highest rounded-xl overflow-hidden border border-outline-variant/20 flex flex-col md:flex-row">
                  <div className="md:w-1/2 p-8 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-on-secondary rounded-full font-label-bold text-[10px] uppercase">
                      <span className="material-symbols-outlined text-[14px]" data-icon="verified" data-weight="fill">verified</span>
                      Active Build
                    </div>
                    <h2 className="font-headline-xl text-headline-xl text-on-surface uppercase leading-none">THE VOLT-S1<br /><span className="text-secondary">PRO CONFIG</span></h2>
                    {/* Technical Specs Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                      <div>
                        <p className="text-outline text-[10px] uppercase font-bold mb-1">Power Core</p>
                        <p className="text-on-surface font-bold">72V Brushless Hub</p>
                      </div>
                      <div>
                        <p className="text-outline text-[10px] uppercase font-bold mb-1">Drift Sleeve</p>
                        <p className="text-on-surface font-bold">Custom PVC Hard-Shell</p>
                      </div>
                      <div>
                        <p className="text-outline text-[10px] uppercase font-bold mb-1">Controller</p>
                        <p className="text-on-surface font-bold">Vector Gen-3 Sine</p>
                      </div>
                      <div>
                        <p className="text-outline text-[10px] uppercase font-bold mb-1">Telemetry</p>
                        <p className="text-on-surface font-bold">Bluetooth v5.2</p>
                      </div>
                    </div>
                    <div className="pt-6">
                      <button className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-bold text-label-bold uppercase flex items-center gap-2 hover:bg-primary-fixed transition-colors active:scale-95 duration-75">
                        <span className="material-symbols-outlined" data-icon="tune">tune</span>
                        Manage Config
                      </button>
                    </div>
                  </div>
                  <div className="md:w-1/2 relative bg-surface-container-lowest min-h-[400px]">
                    <img className="w-full h-full object-cover opacity-80 mix-blend-screen" data-alt="Technical detail shot of the 72V brushless rear hub motor and custom PVC slide sleeves on the VOLT-S1 Pro, sparks of static blue, high-precision engineering aesthetic, white background. Volt-S1 Pro colors." src="https://lh3.googleusercontent.com/aida/AP1WRLs5ZaM9RPZ6LzV__jLKdPJd4gEtlr2ugog5HEhNbzUY5WI0of540x8OVs3E2ZjjiPxLq9vaup44QwKn-vAVAAzPvTRTnRHvi4qe6H-bD_yMTpkcE6phxtMRLyw_MX1xf_JjQHvqRtvncHBBxfebQ2JBmopEsmpldSDvpj7fJ6-8EkgfXykXvvikJYUasLsKhfaHJHneni6hFUZfAgw3RR9azBbsRTYqERWEc8x7gUGGKtK2Yn4hlJFXmqoW" />
                    <div className="absolute inset-0 bg-gradient-to-r from-surface-container-highest to-transparent pointer-events-none" />
                    {/* Technical Grid Overlay */}
                    <div className="absolute inset-0 technical-grid opacity-20 pointer-events-none" />
                  </div>
                </div>
                {/* Orders Timeline */}
                <div className="bg-surface-container p-8 rounded-xl border border-outline-variant/10" id="orders">
                  <h3 className="font-headline-md text-headline-md text-on-surface uppercase mb-8">Active Orders</h3>
                  <div className="relative">
                    {/* Order Header */}
                    <div className="flex justify-between items-center mb-10 pb-6 border-b border-outline-variant/10">
                      <div>
                        <p className="text-outline text-[10px] uppercase font-bold">Order #ED-88291</p>
                        <p className="text-on-surface font-bold text-lg">Hyper-Drift Kit Mk.II</p>
                      </div>
                      <div className="text-right">
                        <p className="text-outline text-[10px] uppercase font-bold">ETA Delivery</p>
                        <p className="text-secondary font-bold text-lg">Oct 24, 2024</p>
                      </div>
                    </div>
                    {/* Progress Line */}
                    <div className="relative h-1 bg-outline-variant/20 w-full mb-12">
                      <div className="absolute top-0 left-0 h-full bg-secondary w-2/3 shadow-[0_0_10px_rgba(196,247,49,0.5)]" />
                      {/* Nodes */}
                      <div className="absolute -top-3 left-0 flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-secondary text-sm" data-icon="check">check</span>
                        </div>
                        <span className="mt-4 text-[10px] uppercase font-bold text-secondary">Processing</span>
                      </div>
                      <div className="absolute -top-3 left-1/3 flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-secondary text-sm" data-icon="check">check</span>
                        </div>
                        <span className="mt-4 text-[10px] uppercase font-bold text-secondary">QA Testing</span>
                      </div>
                      <div className="absolute -top-3 left-2/3 flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-secondary ring-4 ring-secondary/20 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-on-secondary animate-pulse" />
                        </div>
                        <span className="mt-4 text-[10px] uppercase font-bold text-on-surface">Shipping</span>
                      </div>
                      <div className="absolute -top-3 left-full -translate-x-full flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-outline-variant flex items-center justify-center" />
                        <span className="mt-4 text-[10px] uppercase font-bold text-outline">Delivered</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              {/* Sidebar Stats / Quick Links */}
              <aside className="lg:col-span-4 space-y-gutter">
                <div className="bg-secondary-container p-8 cut-corner text-on-secondary-container">
                  <h4 className="font-headline-md text-headline-md uppercase mb-2">Ready to Drift?</h4>
                  <p className="text-sm mb-6 opacity-80">Your custom sleeve configuration is optimized for track conditions in your area (72°F, Dry Asphalt).</p>
                  <button className="w-full bg-on-secondary-container text-secondary-container py-3 font-label-bold text-label-bold uppercase rounded hover:opacity-90 transition-opacity">
                    View Track Profile
                  </button>
                </div>
                <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/10">
                  <h4 className="font-label-bold text-label-bold uppercase text-on-surface mb-6">Recent Activity</h4>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 shrink-0 bg-primary/10 flex items-center justify-center rounded-lg">
                        <span className="material-symbols-outlined text-primary" data-icon="shopping_bag">shopping_bag</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">Replacement Sleeves Ordered</p>
                        <p className="text-xs text-on-surface-variant">2 days ago</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 shrink-0 bg-secondary/10 flex items-center justify-center rounded-lg">
                        <span className="material-symbols-outlined text-secondary" data-icon="star">star</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">Achievement: Tire Shredder</p>
                        <p className="text-xs text-on-surface-variant">Last Week</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 shrink-0 bg-outline-variant/10 flex items-center justify-center rounded-lg">
                        <span className="material-symbols-outlined text-on-surface-variant" data-icon="build">build</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">Motor Service Logged</p>
                        <p className="text-xs text-on-surface-variant">3 weeks ago</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Technical Specs Card */}
                <div className="bg-surface-container-lowest p-6 border border-outline-variant/20 rounded-xl technical-grid">
                  <h4 className="text-outline text-[10px] uppercase font-bold tracking-widest mb-4">Firmware Status</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                      <span className="text-on-surface-variant text-sm">Controller Version</span>
                      <span className="text-secondary font-mono text-sm">v4.2.1-stable</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                      <span className="text-on-surface-variant text-sm">Battery Cycle Count</span>
                      <span className="text-on-surface font-mono text-sm">124</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-on-surface-variant text-sm">Next Calibration</span>
                      <span className="text-primary font-mono text-sm">12.11.24</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
          {/* Footer (Anchor: Shared Component) */}
          <footer className="w-full relative overflow-hidden bg-surface-container-lowest dark:bg-black border-t border-secondary/20 mt-16">
            <div className="bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:20px_20px]">
              <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-desktop py-16 gap-gutter max-w-max-width mx-auto">
                <span className="font-display-lg text-display-lg text-on-surface/10 absolute opacity-20 pointer-events-none left-0 bottom-0 select-none">E-DRIFT</span>
                <div className="z-10">
                  <p className="text-secondary dark:text-secondary-fixed font-body-md text-body-md uppercase font-bold mb-4">© 2024 E-DRIFT MOTORS. ENGINEERED FOR ADRENALINE.</p>
                </div>
                <div className="flex gap-8 z-10">
                  <a className="text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors active:opacity-80" href="#">Support</a>
                  <a className="text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors active:opacity-80" href="#">Privacy</a>
                  <a className="text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors active:opacity-80" href="#">Shipping</a>
                  <a className="text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors active:opacity-80" href="#">Terms</a>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>
      {/* Floating Action Button (FAB) - For Home/Dashboard Intent */}
      <button className="fixed bottom-8 right-8 bg-secondary text-on-secondary w-14 h-14 rounded-full shadow-2xl flex items-center justify-center group hover:scale-110 active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform" data-icon="add">add</span>
        <div className="absolute right-16 bg-surface-container border border-outline-variant text-on-surface px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-label-bold uppercase text-[10px] tracking-widest">
          Log New Drift Session
        </div>
      </button>
    </div>
  );
}
