export const metadata = { title: "Rider Authentication" };

export default function Page() {
  return (
    <div className="bg-surface-container-lowest text-on-surface font-body-md overflow-x-hidden min-h-screen">
      <main className="min-h-screen flex flex-col md:flex-row">
        {/* LEFT SIDE: High-Energy Action Canvas */}
        <section className="relative w-full md:w-1/2 lg:w-3/5 h-[40vh] md:h-screen overflow-hidden group">
          <div className="absolute inset-0 bg-black/40 z-10" />
          <img className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000" src="/assets/trike-gas-charcoal.jpg" />
          {/* Branding Overlay */}
          <div className="absolute bottom-12 left-margin-desktop z-20">
            <h1 className="font-display-lg text-display-lg text-white tracking-tighter leading-none mb-4">
              E-DRIFT<br />MOTORS
            </h1>
            <div className="flex items-center gap-4">
              <span className="w-12 h-[2px] bg-secondary" />
              <p className="font-label-bold text-label-bold text-white uppercase tracking-widest">Precision Performance</p>
            </div>
          </div>
          {/* Kinetic Technical Overlay */}
          <div className="absolute inset-0 z-15 pointer-events-none opacity-30 garage-grid" />
        </section>
        {/* RIGHT SIDE: Authentication Canvas */}
        <section className="w-full md:w-1/2 lg:w-2/5 min-h-screen bg-surface flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop relative garage-grid">
          {/* Technical Border Accents */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-container to-transparent opacity-50" />
          <div className="w-full max-w-md auth-card-transition">
            {/* Header */}
            <header className="mb-12">
              <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight mb-2">ACCESS THE GARAGE</h2>
              <p className="text-on-surface-variant font-body-md">Sign in to manage your fleet and performance specs.</p>
            </header>
            {/* Auth Tabs */}
            <div className="flex mb-10 border-b border-outline-variant/30">
              <button className="flex-1 py-4 font-label-bold text-label-bold tracking-widest text-secondary border-b-2 border-secondary transition-all" id="tab-login">LOGIN</button>
              <button className="flex-1 py-4 font-label-bold text-label-bold tracking-widest text-on-surface-variant hover:text-on-surface transition-all" id="tab-register">REGISTER</button>
            </div>
            {/* Social Authentication */}
            <div className="grid grid-cols-2 gap-gutter mb-8">
              <button className="flex items-center justify-center gap-3 bg-surface-container-high py-3 px-6 rounded hover:bg-surface-variant transition-colors border border-white/5 active:scale-95 duration-75">
                <img alt="Google" className="w-5 h-5" src="/assets/volt-s1-pro-hero.jpg" />
                <span className="font-label-bold text-xs">GOOGLE</span>
              </button>
              <button className="flex items-center justify-center gap-3 bg-surface-container-high py-3 px-6 rounded hover:bg-surface-variant transition-colors border border-white/5 active:scale-95 duration-75">
                <span className="material-symbols-outlined text-xl" style={{fontVariationSettings: '"FILL" 1'}}>apps</span>
                <span className="font-label-bold text-xs">APPLE</span>
              </button>
            </div>
            <div className="relative flex items-center justify-center mb-8">
              <div className="w-full border-t border-outline-variant/20" />
              <span className="absolute px-4 bg-surface text-on-surface-variant text-[10px] font-label-bold tracking-widest">OR USE EMAIL</span>
            </div>
            {/* Login Form */}
            <form className="space-y-6" id="auth-form">
              <div className="space-y-1 group">
                <label className="block font-label-bold text-[11px] text-on-surface-variant tracking-wider uppercase group-focus-within:text-primary-container transition-colors">Commander Email</label>
                <div className="relative">
                  <input className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 text-on-surface font-body-md placeholder:text-outline-variant transition-all focus:border-primary-container focus:ring-0" placeholder="PILOT@EDRIFT.COM" required type="email" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline-variant text-lg">alternate_email</span>
                </div>
              </div>
              <div className="space-y-1 group">
                <div className="flex justify-between items-end">
                  <label className="block font-label-bold text-[11px] text-on-surface-variant tracking-wider uppercase group-focus-within:text-primary-container transition-colors">Access Key</label>
                  <a className="text-[10px] font-label-bold text-primary hover:underline uppercase tracking-tighter" href="#">Lost Key?</a>
                </div>
                <div className="relative">
                  <input className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 text-on-surface font-body-md placeholder:text-outline-variant transition-all focus:border-primary-container focus:ring-0" placeholder="••••••••••••" required type="password" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline-variant text-lg">lock_open</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input className="w-4 h-4 rounded border-outline-variant bg-surface-container-low text-primary-container focus:ring-primary-container" id="remember" type="checkbox" />
                <label className="text-xs font-label-bold text-on-surface-variant uppercase tracking-wider" htmlFor="remember">Maintain session</label>
              </div>
              <button className="w-full bg-primary-container text-white py-5 rounded-lg font-label-bold text-label-bold tracking-[0.2em] shadow-xl shadow-primary-container/20 hover:bg-inverse-primary hover:-translate-y-0.5 transition-all active:scale-95" type="submit">
                INITIALIZE LOGIN
              </button>
            </form>
            {/* Guest Checkout / Footer Actions */}
            <div className="mt-12 text-center space-y-6">
              <button className="font-label-bold text-xs text-on-surface-variant hover:text-secondary tracking-widest uppercase flex items-center justify-center gap-2 mx-auto transition-colors">
                CONTINUE AS GUEST
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
              <p className="text-[10px] text-outline uppercase tracking-widest font-label-bold opacity-50">
                © 2024 E-DRIFT MOTORS. ENGINEERED FOR ADRENALINE.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
