export const metadata = { title: "Checkout" };

export default function Page() {
  return (
    <div className="bg-background text-on-surface font-body-md selection:bg-secondary selection:text-on-secondary-fixed min-h-screen">
      {/* TopNavBar */}
      <nav className="w-full top-0 sticky z-50 bg-surface dark:bg-surface-container-lowest border-b border-white/10">
        <div className="flex justify-between items-center w-full px-margin-desktop py-4 max-w-max-width mx-auto">
          <div className="font-headline-md text-headline-md text-secondary tracking-tighter">E-DRIFT</div>
          <div className="hidden md:flex gap-8 items-center">
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">TRIKES</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">PARTS</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">GEAR</a>
            <a className="font-label-bold text-label-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors" href="#">THE GARAGE</a>
          </div>
          <div className="flex items-center gap-6">
            <button className="material-symbols-outlined text-on-surface hover:text-secondary transition-colors" data-icon="shopping_cart">shopping_cart</button>
            <button className="material-symbols-outlined text-on-surface hover:text-secondary transition-colors" data-icon="person">person</button>
          </div>
        </div>
      </nav>
      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <div className="flex flex-col lg:flex-row gap-gutter relative">
          {/* Left Column: Checkout Form */}
          <div className="flex-1 space-y-12">
            {/* Header */}
            <header>
              <h1 className="font-headline-xl text-headline-xl uppercase text-white mb-2">SECURE CHECKOUT</h1>
              <p className="text-on-surface-variant font-label-bold uppercase tracking-widest">ENCRYPTED PERFORMANCE PROTOCOL</p>
            </header>
            {/* Express Checkout */}
            <section className="bg-surface-container-low p-8 border border-white/10 rounded-lg">
              <h2 className="font-label-bold text-label-bold uppercase mb-6 tracking-widest text-secondary">EXPRESS CHECKOUT</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="bg-black text-white h-12 rounded flex items-center justify-center hover:bg-zinc-900 transition-all active:scale-95">
                  <span className="font-bold">Apple Pay</span>
                </button>
                <button className="bg-white text-black h-12 rounded flex items-center justify-center hover:bg-zinc-200 transition-all active:scale-95">
                  <span className="font-bold">Google Pay</span>
                </button>
                <button className="bg-[#0070ba] text-white h-12 rounded flex items-center justify-center hover:bg-[#005ea6] transition-all active:scale-95">
                  <span className="font-bold italic">PayPal</span>
                </button>
              </div>
              <div className="relative flex items-center justify-center my-8">
                <div className="border-t border-white/10 w-full" />
                <span className="absolute bg-surface-container-low px-4 text-xs font-label-bold text-on-surface-variant tracking-widest uppercase">OR CONTINUE WITH CARD</span>
              </div>
              {/* Step 1: Contact */}
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <span className="w-8 h-8 flex items-center justify-center border border-secondary text-secondary font-label-bold text-xs rounded-full">01</span>
                  <h3 className="font-label-bold text-label-bold uppercase tracking-widest">CONTACT INFORMATION</h3>
                </div>
                <div className="space-y-4">
                  <div className="group">
                    <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">EMAIL ADDRESS</label>
                    <input className="w-full bg-surface-container-highest border border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" placeholder="RACER@EDRIFT.COM" type="email" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 bg-surface-container-highest border-white/20 text-secondary focus:ring-secondary rounded-sm" type="checkbox" />
                      <span className="text-sm text-on-surface-variant group-hover:text-white transition-colors uppercase font-label-bold tracking-tight">SAVE INFO FOR FASTER CHECKOUT</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input defaultChecked className="w-5 h-5 bg-surface-container-highest border-white/20 text-secondary focus:ring-secondary rounded-sm" type="checkbox" />
                      <span className="text-sm text-on-surface-variant group-hover:text-white transition-colors uppercase font-label-bold tracking-tight">RECEIVE TUNING UPDATES &amp; RACE INVITES</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>
            {/* Step 2: Shipping */}
            <section className="bg-surface-container-low p-8 border border-white/10 rounded-lg">
              <div className="flex items-center gap-4 mb-8">
                <span className="w-8 h-8 flex items-center justify-center border border-secondary text-secondary font-label-bold text-xs rounded-full">02</span>
                <h3 className="font-label-bold text-label-bold uppercase tracking-widest">SHIPPING LOGISTICS</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">COUNTRY / REGION</label>
                  <select className="w-full bg-surface-container-highest border border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded appearance-none">
                    <option>UNITED STATES</option>
                    <option>GERMANY</option>
                    <option>JAPAN</option>
                    <option>UNITED KINGDOM</option>
                    <option>CANADA</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">FIRST NAME</label>
                  <input className="w-full bg-surface-container-highest border border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" type="text" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">LAST NAME</label>
                  <input className="w-full bg-surface-container-highest border border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" type="text" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">ADDRESS (STREET, NO.)</label>
                  <input className="w-full bg-surface-container-highest border border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" placeholder="AUTOCOMPLETE ACTIVE..." type="text" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">CITY</label>
                  <input className="w-full bg-surface-container-highest border border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" type="text" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">POSTAL CODE</label>
                  <input className="w-full bg-surface-container-highest border border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" type="text" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-label-bold text-on-surface-variant uppercase mb-1 tracking-widest">PHONE NUMBER (FOR DELIVERY ALERTS)</label>
                  <input className="w-full bg-surface-container-highest border border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" placeholder="+1" type="tel" />
                </div>
              </div>
            </section>
            {/* Step 3: Shipping Method */}
            <section className="bg-surface-container-low p-8 border border-white/10 rounded-lg">
              <div className="flex items-center gap-4 mb-8">
                <span className="w-8 h-8 flex items-center justify-center border border-secondary text-secondary font-label-bold text-xs rounded-full">03</span>
                <h3 className="font-label-bold text-label-bold uppercase tracking-widest">SHIPPING METHOD</h3>
              </div>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-surface-container-highest border border-secondary/50 rounded cursor-pointer hover:border-secondary transition-all">
                  <div className="flex items-center gap-4">
                    <input defaultChecked className="w-5 h-5 text-secondary focus:ring-secondary" name="shipping" type="radio" />
                    <div>
                      <p className="font-label-bold text-white uppercase tracking-tight">WORLDWIDE STEALTH SHIPPING</p>
                      <p className="text-xs text-on-surface-variant">5-7 BUSINESS DAYS</p>
                    </div>
                  </div>
                  <span className="font-bold text-secondary">$35.00</span>
                </label>
                <label className="flex items-center justify-between p-4 bg-surface-container-highest border border-white/5 rounded cursor-pointer hover:border-secondary/30 transition-all">
                  <div className="flex items-center gap-4">
                    <input className="w-5 h-5 text-secondary focus:ring-secondary" name="shipping" type="radio" />
                    <div>
                      <p className="font-label-bold text-on-surface-variant uppercase tracking-tight">OVERNIGHT AIR FREIGHT</p>
                      <p className="text-xs text-on-surface-variant/60">1-2 BUSINESS DAYS</p>
                    </div>
                  </div>
                  <span className="font-bold text-on-surface-variant">$125.00</span>
                </label>
              </div>
              <div className="mt-6 flex gap-3 p-4 bg-blue-900/20 border border-blue-500/30 rounded">
                <span className="material-symbols-outlined text-blue-400" data-icon="info">info</span>
                <p className="text-xs text-blue-200">International orders may be subject to customs duties and taxes upon arrival. These are the responsibility of the recipient.</p>
              </div>
            </section>
            {/* Step 4: Payment */}
            <section className="bg-surface-container-low p-8 border border-white/10 rounded-lg relative overflow-hidden">
              <div className="technical-grid absolute inset-0 opacity-10 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 flex items-center justify-center border border-secondary text-secondary font-label-bold text-xs rounded-full">04</span>
                    <h3 className="font-label-bold text-label-bold uppercase tracking-widest">SECURE PAYMENT</h3>
                  </div>
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-green-400 text-sm" data-icon="lock" data-weight="fill">lock</span>
                    <span className="text-[10px] text-on-surface-variant font-label-bold uppercase tracking-widest">256-BIT SSL</span>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="p-4 bg-surface-container-highest border border-white/10 rounded">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-label-bold text-[10px] text-on-surface-variant uppercase tracking-widest">CREDIT CARD</span>
                      <div className="flex gap-1 opacity-60">
                        <span className="material-symbols-outlined" data-icon="credit_card">credit_card</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="relative">
                        <input className="w-full bg-surface border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" placeholder="CARD NUMBER" type="text" />
                        <div className="absolute right-4 top-4 flex gap-2">
                          <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">VISA</div>
                          <div className="w-8 h-5 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">MC</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input className="bg-surface border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" placeholder="MM / YY" type="text" />
                        <div className="relative">
                          <input className="w-full bg-surface border-white/10 text-white p-4 font-body-md focus:border-secondary transition-colors rounded" placeholder="CVC" type="text" />
                          <span className="absolute right-4 top-4 material-symbols-outlined text-on-surface-variant text-sm" data-icon="help">help</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input defaultChecked className="w-5 h-5 bg-surface-container-highest border-white/20 text-secondary focus:ring-secondary rounded-sm" type="checkbox" />
                    <span className="text-sm text-on-surface-variant group-hover:text-white transition-colors uppercase font-label-bold tracking-tight">BILLING SAME AS SHIPPING</span>
                  </label>
                </div>
              </div>
            </section>
            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8 py-8 opacity-40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" data-icon="verified_user">verified_user</span>
                <span className="text-[10px] font-label-bold uppercase">100% SECURE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" data-icon="package">package</span>
                <span className="text-[10px] font-label-bold uppercase">STEALTH DELIVERY</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" data-icon="support_agent">support_agent</span>
                <span className="text-[10px] font-label-bold uppercase">24/7 RACE SUPPORT</span>
              </div>
            </div>
          </div>
          {/* Right Column: Order Summary (Sticky) */}
          <aside className="lg:w-[420px]">
            <div className="lg:sticky lg:top-28 space-y-6">
              <section className="bg-surface-container p-8 border-l-4 border-secondary rounded-r-lg shadow-2xl">
                <h2 className="font-headline-md text-headline-md text-white uppercase mb-8">ORDER SUMMARY</h2>
                {/* Line Items */}
                <div className="space-y-6 mb-8">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-surface-container-highest rounded border border-white/10 p-2 overflow-hidden flex-shrink-0">
                      <img className="w-full h-full object-cover" data-alt="Close-up of a high-performance electric drift trike frame with carbon fiber parts and neon hazard lime accents. The machine is shot in a clinical industrial studio with dramatic high-contrast lighting emphasizing the metallic textures and electric engineering details. Background shows subtle engineering technical grid lines." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKhlj8dVEdMWG_9ydDiwKnCY8bfwMe62O_sbkesOfabHmEbi70XTQ9usSSHDMPy8CQiifmnex_ex73dkBg0T50fguG6whWqC4USdthGnoVwSzNfA31Q_aby3UHxwAnWiRAYPgvio2trOSHuU00ksoNb4H4Kczl0abYop1muOK_Mp5hr4DEtmzCFyX2GvmCgRnzVuMmrru-Y_xxyH351tE7BtVkPrv2wmgGWz47AdvyLUT57dSY77FF2Q" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h4 className="font-label-bold text-white uppercase">VOLT-S1 PRO</h4>
                        <span className="font-bold">$2,849.00</span>
                      </div>
                      <p className="text-xs text-on-surface-variant uppercase mt-1">EDITION: CARBON STEALTH</p>
                      <p className="text-xs text-on-surface-variant uppercase">QTY: 01</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-surface-container-highest rounded border border-white/10 p-2 overflow-hidden flex-shrink-0">
                      <img className="w-full h-full object-cover" data-alt="High-tech performance drifting wheels for an electric trike, featuring specialized rubber texture and a hazard lime alloy rim. Professional studio photography with technical blueprints visible in the blurred background. Moody electric atmosphere." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhSgdKyIYL1Y6N9-HeeeUuXISBMGtBxQZv-JcCwiZ5_k28OhayO6wTdV_sQvYfARxX1dmkAsdVsmlOFnuYqmk0RJpz8-BKZxrFi3jOqkA1a_jG1LuEqotj9FrmRTjOJoXu609_fzZ9SzNxqh1OcnNi0RLNf5ajiuq_l4fSGJZ_PAYuc2g-92c7Zf7Jy9mbSUscdaM74ugq6IbkTK-zxh6wrSfux9AX6hHLEmGJ0hZ6ivHtYskD8jMwyg" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h4 className="font-label-bold text-white uppercase">G-FORCE TIRE SET</h4>
                        <span className="font-bold">$120.00</span>
                      </div>
                      <p className="text-xs text-on-surface-variant uppercase mt-1">COMPOUND: EXTRA SLICK</p>
                      <p className="text-xs text-on-surface-variant uppercase">QTY: 01</p>
                    </div>
                  </div>
                </div>
                {/* Discount Code */}
                <div className="flex gap-2 mb-8">
                  <input className="flex-1 bg-surface-container-highest border-white/10 text-white p-3 font-body-md text-sm focus:border-secondary transition-colors rounded" placeholder="DISCOUNT CODE" type="text" />
                  <button className="px-4 bg-white/10 text-white font-label-bold uppercase text-[10px] tracking-widest hover:bg-white/20 transition-all rounded">APPLY</button>
                </div>
                {/* Totals */}
                <div className="space-y-4 border-t border-white/10 pt-6">
                  <div className="flex justify-between text-sm text-on-surface-variant">
                    <span className="uppercase font-label-bold tracking-tight">SUBTOTAL</span>
                    <span>$2,969.00</span>
                  </div>
                  <div className="flex justify-between text-sm text-on-surface-variant">
                    <span className="uppercase font-label-bold tracking-tight">SHIPPING</span>
                    <span>$35.00</span>
                  </div>
                  <div className="flex justify-between text-sm text-on-surface-variant">
                    <span className="uppercase font-label-bold tracking-tight">TAXES &amp; DUTIES</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between text-xl font-headline-md text-white border-t border-white/10 pt-4">
                    <span className="uppercase tracking-tighter">TOTAL</span>
                    <span className="text-secondary">$3,004.00</span>
                  </div>
                </div>
                {/* Main CTA */}
                <button className="w-full mt-10 bg-secondary text-on-secondary-fixed py-6 font-label-bold text-lg uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(196,247,49,0.2)] rounded">
                  PLACE ORDER
                </button>
                <p className="text-center text-[10px] text-on-surface-variant mt-4 font-label-bold uppercase tracking-widest">BY CLICKING, YOU AGREE TO THE PERFORMANCE TERMS OF SERVICE.</p>
              </section>
              {/* Trust Box */}
              <div className="bg-surface-container-lowest p-6 border border-white/5 rounded-lg text-xs space-y-3">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-secondary" data-icon="security">security</span>
                  <p className="text-on-surface-variant leading-relaxed">Your transaction is protected by bank-level security. We never store full credit card details on our servers.</p>
                </div>
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-secondary" data-icon="local_shipping">local_shipping</span>
                  <p className="text-on-surface-variant leading-relaxed">Global logistics handled by Elite Stealth Network. Tracking active upon dispatch.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full relative overflow-hidden bg-surface-container-lowest dark:bg-black border-t border-secondary/20 mt-12">
        <div className="style_separation_logic pointer-events-none absolute inset-0 opacity-10" />
        <div className="font-display-lg text-display-lg text-on-surface/10 absolute opacity-20 -bottom-10 -right-10 pointer-events-none">E-DRIFT</div>
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-desktop py-16 gap-gutter max-w-max-width mx-auto relative z-10">
          <div className="space-y-6">
            <div className="font-headline-md text-headline-md text-secondary">E-DRIFT MOTORS</div>
            <p className="text-on-surface-variant max-w-xs text-sm uppercase tracking-wider font-label-bold">
              ENGINEERED FOR ADRENALINE. <br />DRIVEN BY PRECISION.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            <div className="flex flex-col gap-4">
              <h5 className="text-secondary font-label-bold uppercase text-xs tracking-widest">SUPPORT</h5>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">FAQ</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">MANUALS</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">CONTACT</a>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="text-secondary font-label-bold uppercase text-xs tracking-widest">LEGAL</h5>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">PRIVACY</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">TERMS</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">SHIPPING</a>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="text-secondary font-label-bold uppercase text-xs tracking-widest">SOCIAL</h5>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">INSTAGRAM</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">YOUTUBE</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">DISCORD</a>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="text-secondary font-label-bold uppercase text-xs tracking-widest">TECH</h5>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">VOLT-SYSTEM</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">BATTERY CORE</a>
              <a className="text-on-surface-variant hover:text-primary transition-colors text-sm" href="#">TELEMETRY</a>
            </div>
          </div>
        </div>
        <div className="w-full px-margin-desktop py-8 border-t border-white/5 max-w-max-width mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-label-bold uppercase tracking-widest text-on-surface-variant/40">
          <div>© 2024 E-DRIFT MOTORS. ENGINEERED FOR ADRENALINE.</div>
          <div className="flex gap-6">
            <span>ALL RIGHTS RESERVED</span>
            <span>SYSTEM VERSION 4.2.0-PRO</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
