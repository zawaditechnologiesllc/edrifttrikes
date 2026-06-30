export default function Page() {
  return (
    <div className="bg-surface text-on-surface font-body-md selection:bg-secondary selection:text-on-secondary overflow-x-hidden min-h-screen">
      {/* Announcement Bar */}
      <div className="w-full bg-secondary text-on-secondary py-2 overflow-hidden whitespace-nowrap relative z-[60]">
        <div className="flex animate-[marquee_20s_linear_infinite]">
          <span className="font-label-bold text-[10px] uppercase tracking-[0.3em] px-12">Next Drop: Volt-X series in T-Minus 12 Days</span>
          <span className="font-label-bold text-[10px] uppercase tracking-[0.3em] px-12">Free shipping on all chassis over $1,500</span>
          <span className="font-label-bold text-[10px] uppercase tracking-[0.3em] px-12">New PVC sleeves now in stock - high durability</span>
          <span className="font-label-bold text-[10px] uppercase tracking-[0.3em] px-12">Next Drop: Volt-X series in T-Minus 12 Days</span>
        </div>
      </div>
      {/* TopNavBar */}
      <nav className="w-full top-0 sticky z-50 bg-surface/90 backdrop-blur-md border-b border-white/10 transition-all duration-300" id="main-nav">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-6 max-w-max-width mx-auto transition-all duration-300" id="nav-container">
          {/* Brand Logo */}
          <a className="font-headline-md text-headline-md text-secondary tracking-tighter" href="#">E-DRIFT</a>
          {/* Navigation Links with Mega Menu */}
          <div className="hidden md:flex gap-10">
            <div className="nav-item group h-full flex items-center">
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-secondary transition-colors pb-1 border-b-2 border-transparent group-hover:border-secondary" href="#">Trikes</a>
              {/* Mega Menu */}
              <div className="mega-menu absolute left-0 top-full w-full bg-surface-container-lowest border-b border-white/10 p-10 grid-cols-4 gap-gutter z-50">
                <div className="space-y-4">
                  <h4 className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Electric</h4>
                  <div className="flex flex-col gap-2">
                    <a className="text-on-surface hover:text-white transition-colors" href="#">Volt-X Interceptor</a>
                    <a className="text-on-surface hover:text-white transition-colors" href="#">Current Pro 72V</a>
                    <a className="text-on-surface hover:text-white transition-colors" href="#">Junior E-Spark</a>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Internal Combustion</h4>
                  <div className="flex flex-col gap-2">
                    <a className="text-on-surface hover:text-white transition-colors" href="#">Gas Predator 212</a>
                    <a className="text-on-surface hover:text-white transition-colors" href="#">Nitro Drag Spec</a>
                    <a className="text-on-surface hover:text-white transition-colors" href="#">Custom Build Bases</a>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Gravity</h4>
                  <div className="flex flex-col gap-2">
                    <a className="text-on-surface hover:text-white transition-colors" href="#">Downhill Assassin</a>
                    <a className="text-on-surface hover:text-white transition-colors" href="#">Slope Master</a>
                  </div>
                </div>
                <div className="bg-surface-container p-6 border border-white/5 rounded">
                  <span className="block text-secondary font-headline-md mb-2">PRO PACKS</span>
                  <p className="text-xs text-on-surface-variant mb-4">Complete kits including spare sleeves and race gear.</p>
                  <button className="text-[10px] font-label-bold uppercase tracking-widest bg-secondary text-black px-4 py-2 rounded">Shop Bundles</button>
                </div>
              </div>
            </div>
            <div className="nav-item h-full flex items-center">
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-secondary transition-colors" href="#">Parts</a>
            </div>
            <div className="nav-item h-full flex items-center">
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-secondary transition-colors" href="#">Gear</a>
            </div>
            <div className="nav-item h-full flex items-center">
              <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-secondary transition-colors" href="#">The Garage</a>
            </div>
          </div>
          {/* Trailing Icons */}
          <div className="flex items-center gap-6">
            <button className="text-on-surface hover:text-secondary transition-all p-2 rounded-full active:scale-95 duration-75 relative">
              <span className="material-symbols-outlined" data-icon="favorite">favorite</span>
            </button>
            <button className="text-on-surface hover:text-secondary transition-all p-2 rounded-full active:scale-95 duration-75">
              <span className="material-symbols-outlined" data-icon="shopping_cart">shopping_cart</span>
            </button>
            <button className="text-on-surface hover:text-secondary transition-all p-2 rounded-full active:scale-95 duration-75">
              <span className="material-symbols-outlined" data-icon="person">person</span>
            </button>
            <button className="md:hidden text-on-surface p-2">
              <span className="material-symbols-outlined" data-icon="menu">menu</span>
            </button>
          </div>
        </div>
      </nav>
      {/* Hero Section */}
      <header className="relative w-full h-[90vh] flex items-center overflow-hidden bg-black power-slant-divider">
        <div className="absolute inset-0 z-0">
          <img alt="High-action e-drift trike in motion" className="w-full h-full object-cover opacity-80 mix-blend-screen" src="https://lh3.googleusercontent.com/aida-public/AB6AXuASILvKUpcCuCVuSBiJVcCa4AtvepujX1rHJpacx2BI4Cifox-qBSE_PosQGfD6KkWjHHu3aq30VMxwPt8QxlArGbNmjOUYUbZPXiebsF5mAx4KeTzYv6XK7W4t788BQprsim50gPccMV4kks3n7n_LCJGLMOQ4j9kwetrAhoN9oZJylzuOcqWZMb4jwD2ZC45DxPua5z9lbAYvGir3SrSWfKlFQA9v3MTVX4DM9c6tW-cMZjbVNqSWZw" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/40" />
        </div>
        <div className="relative z-10 w-full max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white leading-none tracking-tight uppercase">
              ENGINEERED FOR <span className="text-secondary">CHAOS</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl border-l-4 border-secondary pl-6">
              Precision torque meets lateral freedom. Dominate every corner with the world's most advanced electric drift trikes. Built for the adrenaline-fueled expert.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <button className="bg-[#1e5bff] text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:brightness-110 active:scale-95 transition-all">
                BUILD YOUR SLIDE
              </button>
              <button className="border border-white text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:bg-white/10 active:scale-95 transition-all">
                SHOP TRIKES
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* Section 1: THE DRIFT SPEC */}
      <section className="py-32 bg-surface-container-lowest technical-grid">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-gutter">
            <div>
              <h2 className="font-headline-xl text-headline-xl text-white uppercase mb-2">THE DRIFT SPEC</h2>
              <div className="w-32 h-2 bg-secondary" />
            </div>
            <p className="text-on-surface-variant font-body-md max-w-md">
              Technical perfection forged in the streets. Every component is stress-tested for maximum lateral G-force and sustained drift control.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Feature 1 */}
            <div className="bg-surface-container p-10 border border-white/10 hover:border-secondary/50 transition-all group">
              <div className="text-secondary mb-8">
                <span className="material-symbols-outlined !text-5xl" data-icon="bolt">bolt</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-white uppercase mb-4">High-Torque Motor</h3>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                72V custom-wound brushless motors delivering instant 150Nm torque for immediate break-loose capabilities on any surface.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="bg-surface-container p-10 border border-white/10 hover:border-secondary/50 transition-all group">
              <div className="text-secondary mb-8">
                <span className="material-symbols-outlined !text-5xl" data-icon="rebase">rebase</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-white uppercase mb-4">Slide-Sleeves</h3>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                Ultra-high molecular weight polyethylene (UHMWPE) rear sleeves designed for buttery smooth transitions and extreme durability.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="bg-surface-container p-10 border border-white/10 hover:border-secondary/50 transition-all group">
              <div className="text-secondary mb-8">
                <span className="material-symbols-outlined !text-5xl" data-icon="architecture">architecture</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-white uppercase mb-4">Pro Frame</h3>
              <p className="text-on-surface-variant leading-relaxed mb-6">
                Aircraft-grade 6061 aluminum alloy frame with a 15-degree aggressive rake for superior counter-steering feedback.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Section 2: CATEGORY GRID */}
      <section className="py-32 bg-white text-black power-slant-divider-reverse relative">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
          <div className="mb-20 text-center">
            <span className="font-label-bold text-label-bold text-[#1e5bff] uppercase tracking-widest">The Ecosystem</span>
            <h2 className="font-headline-xl text-headline-xl text-black uppercase mt-2">CHOOSE YOUR WEAPON</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {/* Card 1: TRIKES */}
            <div className="group relative aspect-[3/4] overflow-hidden rounded-lg hover-lift border-b-2 border-transparent hover:border-[#1e5bff]">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDiqSBXzDqQNj-KPplG0JL5sQLjjd7-hAMGUl4Alo29qaqMFQ4uwD7WkKslxm_9HW30JBftvQXhRMtPvc5P697pRo2-bOdEnrlugIzm21xJF5HEmYnET8ZiySM57mHL7gZaUYeZBJuQW2Yakt8296XKUaZhS7bKwI1gx_bM2JtJo2HO4qjvbL9nr_Xig1pqnNmX7kKY66IqURlQy14Ch2kQVs5nYMb21L1UM15dL2rf7G8iXynrf3sTXw")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-8">
                <h4 className="font-headline-md text-headline-md text-white uppercase">TRIKES</h4>
                <button className="bg-[#c4f731] text-black px-4 py-2 font-label-bold text-label-bold uppercase tracking-widest rounded mt-4">VIEW ALL</button>
              </div>
            </div>
            {/* Card 2: PARTS */}
            <div className="group relative aspect-[3/4] overflow-hidden rounded-lg hover-lift border-b-2 border-transparent hover:border-[#1e5bff]">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCP6CqAROaPbUHQ625lbbJU8xEDc4RRO5z-iXT1jjqa7nlmOpdETaF2MWDeK5cRQ1U77V_RXsrfn5aC-SLaBdniuZSwvZ2Sxvu0tK8f3GzyLOctS3UjBR24D9zRD2qll4DzTomnr5EJt5SDDqTVDaC9Ejh6DGJhrUbMFXg3nmp1giSZBquYBcI5My6upmqq0XyK8f9SuLI15UE_LtpB6OzvDcNIP2L5kuTB3oThuPEZOa7AlBTZm-TqrQ")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-8">
                <h4 className="font-headline-md text-headline-md text-white uppercase">PARTS</h4>
                <button className="bg-white text-black px-4 py-2 font-label-bold text-label-bold uppercase tracking-widest rounded mt-4">EXPLORE</button>
              </div>
            </div>
            {/* Card 3: GEAR */}
            <div className="group relative aspect-[3/4] overflow-hidden rounded-lg hover-lift border-b-2 border-transparent hover:border-[#1e5bff]">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB4J49nLPNHv-wMdgKEJl0AXPVn6ATt17HpV_plq04wZepiRzCksKsD3PD3u3FDLgnx9Q56mDheBKg_lSqzWUnLnc63CNFlU9RL_PYVjdbAjQq_KOiSPAV_IpJdKfAmCQUGQ8ZuovoHtTxPx-zwEaAo8ybiI1oFUPVjnOKu-jqJIFYvR7BvPa5ccOrh9ZIwpovtNDxCuDpc5ia3N21R-8KQ2YY1wHijzoecGF_aGrNm2H8I7G3GnwJFVQ")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-8">
                <h4 className="font-headline-md text-headline-md text-white uppercase">GEAR</h4>
                <button className="bg-white text-black px-4 py-2 font-label-bold text-label-bold uppercase tracking-widest rounded mt-4">SHOP GEAR</button>
              </div>
            </div>
            {/* Card 4: THE GARAGE */}
            <div className="group relative aspect-[3/4] overflow-hidden rounded-lg hover-lift border-b-2 border-transparent hover:border-[#1e5bff]">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDlZyDAQhUF6RLeJustvEEA7_4Hns7ub4PMb8NKb6JvjnRzOg1ewBS_oHA2eNLaDLwUB5SPK6Nyx0p5GGWFOR-TmD9YrbAWN1uFmKF5wcBZsuprWGZ_0ioJIFdWqhUgVD-lH8zGyDoZW026zzMhYHdTBhoKoFvxlsbwgwOrQH66khaSLsXhy2QE7tMbI0OSMPN8oHy97LESadRN7Ky36sEAvv8BEBesWj6JFTi98T-T1yHUd3Rg_xy7DQ")'}} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-8">
                <h4 className="font-headline-md text-headline-md text-white uppercase">THE GARAGE</h4>
                <button className="bg-white text-black px-4 py-2 font-label-bold text-label-bold uppercase tracking-widest rounded mt-4">ENTER</button>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Section 3: THE GARAGE PROTOCOL */}
      <section className="py-32 bg-surface text-on-surface overflow-hidden">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <div className="inline-block bg-secondary px-3 py-1 font-label-bold text-label-bold text-black uppercase">LIVE COMMUNITY FEED</div>
              <h2 className="font-headline-xl text-headline-xl text-white uppercase leading-none">THE GARAGE PROTOCOL</h2>
              <p className="text-on-surface-variant font-body-lg">
                Our garage isn't just a shop—it's a global network of engineers and adrenaline junkies pushing the limits of what electric drifting can be.
              </p>
              <button className="bg-[#c4f731] text-black px-10 py-5 font-label-bold text-label-bold uppercase tracking-widest rounded shadow-2xl hover:translate-x-2 transition-transform">
                JOIN THE DISCORD
              </button>
            </div>
            <div className="grid grid-cols-6 grid-rows-6 h-[600px] gap-4">
              <div className="col-span-4 row-span-4 rounded-lg overflow-hidden border border-white/10 group">
                <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtAvtNt1_P0jm1UK4wdl86_00mguXBRJdQ8xlGeQryYWPi6PERHaHwXRveErsLO_l8OWmEvA1InPd9Gx_zrv5bk3m-YnHoPDcZxlH9Kk_dUWpnev_KAqpBC43yS9In64f2DZal0vAmWjU47UNXe7_2RleC5YfvhBs1013x4WTqhxIbO3e6O1nhWb2RY4xQVfeN3B7LHsKbu_8ESFiDhBPhyiU2dX2ntu1byj9zJKHlaGe47xAwnFCmQw" />
              </div>
              <div className="col-span-2 row-span-2 rounded-lg overflow-hidden border border-white/10">
                <div className="w-full h-full bg-surface-container-high flex flex-col items-center justify-center p-4 text-center">
                  <span className="text-secondary font-headline-md text-headline-md">42k</span>
                  <span className="text-on-surface-variant font-label-bold text-label-bold uppercase">Active Pilots</span>
                </div>
              </div>
              <div className="col-span-2 row-span-4 rounded-lg overflow-hidden border border-white/10">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA-AskTbf5-JoBkuybkUx840ju7NcgvYt9OdZw6dl9pSKIYSFPMKktGWqBaSlnr2INCyCx9AZ1euO-eB_2zxeDjA51bjhRDO5ZNlXG4iLdy-T14yj0hgLMrJ3bTWtrcy_aDrq4k8pTMAeyJLje9R6YgW6L9dSXsI1VzA7kDL2kBkr5sRPmAm5-lL_ZAtib8jppzFBZpov9o8yUhcvlx8hank4p2Bc-PmGPWauErM7RVKbStkl5ZuMnRyQ" />
              </div>
              <div className="col-span-4 row-span-2 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-secondary/5 border-secondary/20">
                <div className="text-secondary font-label-bold text-label-bold uppercase tracking-[0.2em] animate-pulse text-center p-4">
                  NEW RECORD: 52SEC DRIFT STREAK BY @VOLT_KING
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="w-full relative overflow-hidden bg-surface-container-lowest dark:bg-black border-t border-secondary/20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:20px_20px]">
        <div className="font-display-lg text-display-lg text-on-surface/10 absolute opacity-20 -bottom-10 -left-10 pointer-events-none select-none">E-DRIFT</div>
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-20 relative z-10">
          {/* Footer Top: Branding & Newsletter */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-20">
            <div className="lg:col-span-4 space-y-8">
              <h2 className="font-headline-md text-headline-md text-secondary tracking-tighter">E-DRIFT MOTORS</h2>
              <p className="text-on-surface-variant font-body-md max-w-sm">
                The frontier of electric street motorsport. Engineered in the garage, proven on the asphalt. Join the drift revolution.
              </p>
              <div className="flex gap-4">
                <a className="text-secondary hover:text-white transition-colors" href="#"><span className="material-symbols-outlined">public</span></a>
                <a className="text-secondary hover:text-white transition-colors" href="#"><span className="material-symbols-outlined">chat</span></a>
                <a className="text-secondary hover:text-white transition-colors" href="#"><span className="material-symbols-outlined">play_circle</span></a>
              </div>
            </div>
            <div className="lg:col-span-8 flex flex-col justify-center">
              <div className="bg-surface-container p-8 border border-white/5 rounded-lg">
                <h3 className="font-label-bold text-label-bold text-white uppercase tracking-[0.2em] mb-6">TRANSMISSION ENROLLMENT</h3>
                <form className="flex flex-col md:flex-row gap-4">
                  <input className="flex-grow bg-black border border-white/10 rounded px-6 py-4 text-secondary focus:outline-none focus:border-secondary transition-colors font-label-bold uppercase tracking-widest text-xs" placeholder="ENTER COORDS (EMAIL)" type="email" />
                  <button className="bg-[#c4f731] text-black px-10 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded hover:brightness-110 active:scale-95 transition-all">SIGN UP</button>
                </form>
                <p className="text-[10px] text-on-surface-variant mt-4 uppercase tracking-widest">By enrolling, you accept the protocol terms and data decryption policies.</p>
              </div>
            </div>
          </div>
          {/* Footer Mid: Sitemap */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-20 border-y border-white/5 py-16">
            <div className="space-y-6">
              <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">CATALOG</h4>
              <nav className="flex flex-col gap-3">
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">ELECTRIC TRIKES</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">GAS POWERED</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">GRAVITY SLIDERS</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">CHASSIS ONLY</a>
              </nav>
            </div>
            <div className="space-y-6">
              <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">SUPPORT</h4>
              <nav className="flex flex-col gap-3">
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">TECH MANUALS</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">SHIPPING LOGS</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">WARRANTY PROTOCOL</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">FAQ SYSTEM</a>
              </nav>
            </div>
            <div className="space-y-6">
              <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">COMPANY</h4>
              <nav className="flex flex-col gap-3">
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">OUR GARAGE</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">TEAM PILOTS</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">CAREERS</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">PRESS RELEASES</a>
              </nav>
            </div>
            <div className="space-y-6">
              <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">LEGAL</h4>
              <nav className="flex flex-col gap-3">
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">PRIVACY</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">TERMS OF USE</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">SAFETY WARNINGS</a>
                <a className="text-on-surface-variant font-body-md hover:text-secondary transition-colors text-sm" href="#">COOKIE LOGS</a>
              </nav>
            </div>
          </div>
          {/* Footer Bottom: Trust Marks & Copyright */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-6 opacity-40 hover:opacity-80 transition-opacity grayscale hover:grayscale-0">
              <img alt="Visa" className="h-4" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDueLJ3tM92j6K9V5BeJIrHhYT-PtY4VdxaQx0_jxdrN_wDUwFWdVEnL1LJFi8HsN0jFiPQipnNgB6-8SUoDBBD_j7ZtdW0wYo0_IN6kFNd7ch5T29-1yPUvvGMyOHfE1H7f1j8HNlCuhVAVPzepm5fG8Rcbl3qYCH-yEwNDOAzPS83Sf2_dtekyUMZCoQrQQJfd5RCHcyr6Ad80mmzxJ7nfXnqDLRT4yPRH3cMJ-boROGISHZ-PI8lQg" />
              <img alt="Mastercard" className="h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1Q42tQAUEh_pM2JJdWL9BWK8cdvwo6FyPTYMVNRE9DPhnxmNWnilgxcEFMzV57Ub2BQ_kKO2-70TzT7oS-ogzpb3338bqH1Z6d3P0yoGt9eM0WT6Qx3Q6liOwJWBErxowOKlHFRDPcX6KuxETDBLyPVwrqmpWoIswNfxgO2RX3DpEQBSrRtPVYj8ushpJ8As3xarFIwjb2Uo7vOLMNTOKOl6GiIFKESHCDPsShwAJVWSwVITp1WMtnA" />
              <img alt="PayPal" className="h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDphz4Qm8a7plEVAJlyTcZYy92YfZm5wScV_X807nxoP2hkrQ71LEuYnYD54uTSvYWBD1jpWcAW8cbti73ZYeR9p7kAhT4ZGJtCaKCz7_9uIiU04zQXYnwn_dmJJxAKWOqPZKMhfHNW6OfP8JnbK-k61TtPOo729IrK8kckIbROK1RBqLnFSKCXP5ExVTD69_F4DPdBKbTUibT6USHRyu8YYv6ZoHX-9o4hhKA9gi1BGnT0cZcuXOhpEw" />
              <img alt="Apple Pay" className="h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7WFj37rYfyA1ZYjPjYGaP03GJGKuK3BvOig38HMfItBvAppAspzrFdJcdq-QVamUFRBL2QjSqdDeDNH8TvAkiS4apLCB63Rc3ozlGj1k0JRBk_GTwjhMcL_6Fsv-P2Sq2OeOjD8iWwrBxXPqSAR79tmwpLNgm1fH6Jo8bY1z06AgU-PtLJ2UTR8G4Go2tsnBYcbdW0OA81ED54MvcVFPTui2JDIoVnzXq_WlpLx4Yc3QDZNaxy6kHpQ" />
            </div>
            <div className="flex flex-col md:items-end gap-2 text-on-surface-variant font-label-bold text-[10px] tracking-[0.2em] uppercase">
              <span>© 2024 E-DRIFT MOTORS. ENGINEERED FOR ADRENALINE.</span>
              <div className="flex gap-6">
                <span>MADE IN THE GARAGE</span>
                <span className="text-secondary">0-60MPH: SYSTEM_ERR</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
