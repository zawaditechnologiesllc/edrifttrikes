export const metadata = { title: "DIY Guide: Sleeve Fitting" };

export default function Page() {
  return (
    <div className="bg-background text-on-surface font-body-md selection:bg-secondary-fixed selection:text-on-secondary-fixed min-h-screen">
      {/* Progress Bar Anchor */}
      <div className="fixed top-0 left-0 w-full h-1 z-[100] bg-surface-container-highest">
        <div className="h-full bg-secondary shadow-[0_0_10px_#c4f731]" id="progress-bar" />
      </div>
      {/* Navigation Header */}
      <nav className="w-full top-0 sticky z-[90] border-b border-outline-variant bg-background/95 backdrop-blur-md">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-max-width mx-auto">
          <div className="font-display-lg text-headline-md text-primary tracking-tighter italic">VOLT DRIFT</div>
          <div className="hidden md:flex items-center gap-8">
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold" href="#">TRIKES</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold" href="#">UPGRADES</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold" href="#">GEAR</a>
            <a className="text-secondary-fixed font-bold border-b-2 border-secondary-fixed pb-1 font-label-bold" href="#">TECH</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors font-label-bold" href="#">GARAGE</a>
          </div>
          <div className="flex items-center gap-6">
            <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">shopping_cart</button>
            <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">account_circle</button>
          </div>
        </div>
      </nav>
      {/* Header Section */}
      <header className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop mt-12 md:mt-24 mb-12">
        <div className="flex flex-col items-center text-center">
          <span className="bg-secondary text-on-secondary px-4 py-1 font-label-bold uppercase tracking-widest text-[12px] rounded-sm mb-6 inline-block">DIY BUILDS</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-8 max-w-4xl leading-tight">HOW TO FIT PRO DRIFT SLEEVES</h1>
          <div className="flex flex-wrap justify-center items-center gap-6 text-on-surface-variant border-t border-b border-outline-variant/30 py-4 w-full max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">person</span>
              <span className="font-label-bold text-xs uppercase tracking-wider text-on-surface">DR. DRIFT</span>
            </div>
            <div className="w-1 h-1 bg-outline rounded-full" />
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">calendar_today</span>
              <span className="font-label-bold text-xs uppercase tracking-wider">OCT 24, 2024</span>
            </div>
            <div className="w-1 h-1 bg-outline rounded-full" />
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">schedule</span>
              <span className="font-label-bold text-xs uppercase tracking-wider">12 MIN READ</span>
            </div>
          </div>
        </div>
      </header>
      {/* Hero Image */}
      <section className="w-full relative h-[60vh] md:h-[80vh] overflow-hidden">
        <img alt="Technical DIY installation" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHlm9L14L2yxsiG13bEJL382g8uxb5RQ37YZkvdLfSN_h3pfEIZcQzW1WRl98E_47uRCgCe-LUvloh7IJ5P8hcYMsB9insnVLTtc3y7gDjIakgNw46idD6mQ_V1pj8zMaWmm3R519o1M5uBJaaOP8qE7BOzNMcpSG8SHpclJb6B4mI58hvVNV7X_msznEYp4JP5PYu0ICLMszaahluB_ECLmgD1iiZGNF2QyHdFneNgm1e5Us9AKJ3Ow" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </section>
      {/* Content Area */}
      <main className="relative z-10 -mt-20 md:-mt-32 max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left Sidebar (Desktop Only) */}
          <aside className="hidden lg:block lg:col-span-2 pt-24 sticky top-24 h-fit">
            <div className="flex flex-col gap-8">
              <div className="text-on-surface-variant uppercase font-label-bold text-[10px] tracking-widest mb-4">SHARE THE BUILD</div>
              <div className="flex flex-col gap-6">
                <a className="w-10 h-10 border border-outline-variant flex items-center justify-center hover:bg-secondary-container hover:text-on-secondary-container transition-all" href="#"><span className="material-symbols-outlined text-sm">share</span></a>
                <a className="w-10 h-10 border border-outline-variant flex items-center justify-center hover:bg-secondary-container hover:text-on-secondary-container transition-all" href="#"><span className="material-symbols-outlined text-sm">link</span></a>
                <a className="w-10 h-10 border border-outline-variant flex items-center justify-center hover:bg-secondary-container hover:text-on-secondary-container transition-all" href="#"><span className="material-symbols-outlined text-sm">mail</span></a>
              </div>
            </div>
          </aside>
          {/* Main Column */}
          <article className="lg:col-span-7 bg-surface-bright p-8 md:p-16 border border-outline-variant shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 font-display-lg text-display-lg-mobile -mr-8 -mt-8 select-none">V-DRIFT</div>
            <div className="space-y-8 relative z-10">
              <p className="font-body-lg text-body-lg text-on-surface/90 leading-relaxed first-letter:text-5xl first-letter:font-display-lg first-letter:text-secondary first-letter:mr-3 first-letter:float-left">
                Drifting isn't just about the machine; it's about the connection between the rubber and the asphalt. Or in our case, the PVC and the track. Installing your Pro Drift Sleeves correctly is the difference between a clinical 360-degree rotation and a catastrophic mechanical failure.
              </p>
              <h2 className="font-headline-md text-headline-md text-primary pt-6 border-b border-outline-variant pb-2">01. PREPARATION &amp; TOOLS</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Before you start torqueing down your axle nuts, ensure your workshop environment is controlled. You'll need the following technical arsenal:
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <li className="flex items-center gap-3 p-4 bg-surface-container-low border-l-4 border-secondary">
                  <span className="w-2 h-2 bg-secondary flex-shrink-0" />
                  <span className="font-label-bold text-sm text-on-surface uppercase tracking-tight">Heavy Duty Heat Gun</span>
                </li>
                <li className="flex items-center gap-3 p-4 bg-surface-container-low border-l-4 border-secondary">
                  <span className="w-2 h-2 bg-secondary flex-shrink-0" />
                  <span className="font-label-bold text-sm text-on-surface uppercase tracking-tight">Rubber Mallet (Soft)</span>
                </li>
                <li className="flex items-center gap-3 p-4 bg-surface-container-low border-l-4 border-secondary">
                  <span className="w-2 h-2 bg-secondary flex-shrink-0" />
                  <span className="font-label-bold text-sm text-on-surface uppercase tracking-tight">Axle Grease</span>
                </li>
                <li className="flex items-center gap-3 p-4 bg-surface-container-low border-l-4 border-secondary">
                  <span className="w-2 h-2 bg-secondary flex-shrink-0" />
                  <span className="font-label-bold text-sm text-on-surface uppercase tracking-tight">Microfiber Degreaser</span>
                </li>
              </ul>
              {/* Callout Box */}
              <div className="bg-on-secondary-fixed/10 border border-secondary-fixed p-6 rounded-lg flex gap-4 items-start my-12">
                <span className="material-symbols-outlined text-secondary-fixed text-3xl shrink-0">bolt</span>
                <div>
                  <span className="font-label-bold text-secondary-fixed text-xs uppercase block mb-1">PRO TIP: THERMAL EXPANSION</span>
                  <p className="font-body-md text-body-md text-on-surface/80">
                    Heat the sleeve uniformly for 2-3 minutes before attempting installation. This expands the PVC molecular structure slightly, allowing it to glide over the hub with 40% less resistance.
                  </p>
                </div>
              </div>
              <h2 className="font-headline-md text-headline-md text-primary pt-6">02. THE INSTALLATION PROCESS</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Follow these steps with surgical precision. Misalignment at this stage can cause high-speed vibration.
              </p>
              <div className="space-y-12 py-6">
                <div className="flex gap-6 group">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-2 border-outline flex items-center justify-center font-display-lg text-lg text-outline group-hover:border-secondary group-hover:text-secondary transition-colors">1</div>
                    <div className="w-px h-full bg-outline-variant my-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="font-label-bold text-on-surface text-lg mb-2 uppercase">Degrease the Wheel Hub</h3>
                    <p className="text-on-surface-variant">Remove all existing factory oils or dust. The interior of the sleeve requires a clean friction surface to anchor properly.</p>
                  </div>
                </div>
                <div className="flex gap-6 group">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-2 border-outline flex items-center justify-center font-display-lg text-lg text-outline group-hover:border-secondary group-hover:text-secondary transition-colors">2</div>
                    <div className="w-px h-full bg-outline-variant my-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="font-label-bold text-on-surface text-lg mb-2 uppercase">Thermal Activation</h3>
                    <p className="text-on-surface-variant">Using your heat gun, apply circular motion heat. Avoid focusing on a single spot to prevent melting or warping the Hazard Lime finish.</p>
                  </div>
                </div>
                <div className="flex gap-6 group">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-2 border-outline flex items-center justify-center font-display-lg text-lg text-outline group-hover:border-secondary group-hover:text-secondary transition-colors">3</div>
                  </div>
                  <div className="pb-8">
                    <h3 className="font-label-bold text-on-surface text-lg mb-2 uppercase">Seating the Sleeve</h3>
                    <p className="text-on-surface-variant">Align the sleeve flush with the outer rim lip. Use a rubber mallet to tap gently around the circumference until fully seated.</p>
                  </div>
                </div>
              </div>
              {/* Inline Product Callout */}
              <div className="tech-grid p-1 border-2 border-primary-container group relative">
                <div className="bg-surface-container-low p-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                  <div className="w-full md:w-1/3 aspect-square relative bg-surface-container-highest rounded-lg overflow-hidden">
                    <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="A studio product shot of a Hazard Lime PVC drift sleeve, isolated on a dark technical background with subtle blue rim lighting and technical specs text overlays. High performance aesthetic, 8k resolution." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnMEza6Yc9Mn0RcdXMhMmcD9fcTcTyCLUx9JctGlzVaxTgzHsw9rz_nBnioAZPYVyhmZ3u86SZkxHNQRVGxAI-OFuwpbrpOYsGWOdTGY7xZ-KHVAKWRFV0k9LvUWJYzTLq7wmlSqYFArTIXWDuEK0wHGTt-Gz_qM0nGl-NFxQjkeXObf-sBlPpIM8bq6eWtUBBWAwwTCW9kZkdcs74SzYih05jBx8Sc4n2F_iOfHMm6Te3oU6FeDkIEw" />
                    <div className="absolute top-2 left-2 bg-secondary text-on-secondary px-2 py-0.5 font-label-bold text-[10px] rounded-sm">NEW GEAR</div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="font-headline-md text-headline-md text-on-surface">PRO DRIFT SLEEVES</h4>
                      <div className="text-secondary-fixed font-label-bold uppercase tracking-widest text-xs">COLOUR: HAZARD LIME</div>
                    </div>
                    <p className="text-on-surface-variant font-body-md">Precision-molded 12mm PVC for maximum slide endurance and consistent thermal dissipation.</p>
                    <div className="flex items-center justify-between">
                      <span className="font-display-lg text-3xl text-on-surface">$89.00</span>
                      <button className="bg-primary-container text-on-primary-container px-8 py-3 font-label-bold uppercase tracking-widest hover:bg-primary transition-all active:scale-95 flex items-center gap-2">
                        ADD TO CART
                        <span className="material-symbols-outlined">shopping_cart</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-8 italic border-l-4 border-outline-variant pl-4">
                "If the sleeve doesn't fit after heating, do not force it. Check your hub dimensions against the VOLT DRIFT compatibility chart available in the Technical Manuals section."
              </p>
            </div>
          </article>
          {/* Right Sidebar (Metadata/Ads) */}
          <aside className="lg:col-span-3 space-y-12">
            <div className="p-6 border border-outline-variant bg-surface-container-lowest">
              <h5 className="font-label-bold text-on-surface-variant uppercase text-xs mb-6 tracking-widest border-b border-outline-variant pb-2">CONTRIBUTOR</h5>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-surface-container-highest border border-outline overflow-hidden">
                  <img className="w-full h-full object-cover" data-alt="A portrait of a male mechanic in his late 30s with short hair and safety goggles resting on his forehead, looking directly at the camera with a confident, expert expression. Workshop background." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDzW3uGDJ-CplyenZUgiU9IKAbqgFHMG3Dg1vylhFeKAbJjKF2vrfOYVeR8osO90D4O4UebLd7MdytNkkYMUMv5AaM8nRYhKNdjrpoFhvrGvx4E_Tzz-VqvEFlIxFKtvQRspXjUCKV0dR5yqMv8T4UsMEQHlmKuCJy_-9jJOgT_tO80UczC2IPYuzvaMXzyum-nX4flsiDQsqRphDCr1KVbcMZtWNPwrzF-MxL2uNu85NCZjxVPfoYd3Q" />
                </div>
                <div>
                  <div className="font-label-bold text-on-surface">ELIAS "DR. DRIFT" VANCE</div>
                  <div className="text-xs text-on-surface-variant">Master Engineer</div>
                </div>
              </div>
            </div>
            <div className="p-6 border border-outline-variant bg-surface-container-lowest overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
              <h5 className="font-label-bold text-on-surface-variant uppercase text-xs mb-6 tracking-widest border-b border-outline-variant pb-2">SPECS</h5>
              <div className="space-y-4">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">DIFFICULTY</span>
                  <span className="text-secondary-fixed">MODERATE</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">EST. TIME</span>
                  <span className="text-on-surface">45 MINUTES</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">MATERIAL</span>
                  <span className="text-on-surface">HIGH-DEN PVC</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      {/* Related Guides Section */}
      <section className="mt-24 bg-surface-container-lowest py-24 relative overflow-hidden">
        <div className="tech-grid absolute inset-0 opacity-20" />
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
          <h2 className="font-display-lg text-headline-xl text-on-surface mb-12">RELATED GUIDES</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Related Card 1 */}
            <div className="group cursor-pointer">
              <div className="aspect-[16/10] bg-surface-container-highest mb-4 overflow-hidden relative">
                <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Action shot of an electric drift trike performing a high-speed slide on a wet asphalt track at night. Neon lights reflect off the surface. Cinematic wide shot, professional automotive photography." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBD4fqJFy_v6o7Te7hD2kj5FKKphA2EpxNUqAlFMm396yxuJZyTCmzmIctfEc7eJ5sp1KNuVzYj40CnlxLfzaKExjmuchbeijS0jdKBYivJI4Kz25itcOquM7d8ybC26QdoMIZDxDeEd-qwgZzchMK4E1B7dIXmqBfkJmDLx_itsJYhZLpkQEVjZRRDKf5ZUYPFzpXbDirTH2eyUA7prS0fpY_ux3Ref3UDKrD03WMByfKpogW4SB0VQQ" />
                <div className="absolute bottom-0 left-0 bg-secondary text-on-secondary font-label-bold text-[10px] px-3 py-1">TECH GUIDE</div>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2 group-hover:text-secondary transition-colors">ADJUSTING AXLE WIDTH</h3>
              <p className="text-on-surface-variant text-sm line-clamp-2">Learn how to tune your stance for maximum stability during aggressive turns.</p>
            </div>
            {/* Related Card 2 */}
            <div className="group cursor-pointer">
              <div className="aspect-[16/10] bg-surface-container-highest mb-4 overflow-hidden relative">
                <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Technical close-up of a brushless electric motor with its outer casing removed, showing high-precision copper windings and silver components. Industrial macro photography, clean lighting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDvUylrczKftHrgkzmVYcCJhtwtS2-x55pwgn5utYsYaaUSS9q3OjO8FyzNAds1RhdIecddezXJIq_Z4D4fScldqWgPntejoZqlG2jTKeP1Jg2czUGmE_2eZHW_K0Md8g1CsmYCH6ZS29uVNBs9sowE16qr0HnCpi9iAXu3lIuvgSimsDGKUK49plL-uZTT7lyMuoeRKGAKJHsuIec59TvqjOenoTDrop5aBVOycl3LXuEQhL94wlUhw" />
                <div className="absolute bottom-0 left-0 bg-secondary text-on-secondary font-label-bold text-[10px] px-3 py-1">DIY BUILD</div>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2 group-hover:text-secondary transition-colors">MOTOR COOLING MODS</h3>
              <p className="text-on-surface-variant text-sm line-clamp-2">Overclock your drift sessions without overheating your power core.</p>
            </div>
            {/* Related Card 3 */}
            <div className="group cursor-pointer">
              <div className="aspect-[16/10] bg-surface-container-highest mb-4 overflow-hidden relative">
                <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="Close-up of a handlebar set with high-tech digital display, leather grips, and various control buttons. Shot in a minimalist white-walled garage environment. Sharp focus, clean lines." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgFx0W6oXCv1uwM4jmNhFiibHr3E3JsaTUw2vi4TSP8asdAPL4v-PpWvuMVcXbJ8nb5tEPM4SHJpFsW0qbRV0OZxBeuwsofaWUkhPd3W6LvCzyZHKGoInBZ4QtDjfIKxHlH6dqLbKCWk1l_VNn_I6UgasBXSwA6rMsYEYmoymDew_iMR1qmM4bQYBMhCeKfa8JnoWVdRJrauBUvrbJyIno-25QyZCSpLj3XiPc6oJNXBvzUdJTS8mYug" />
                <div className="absolute bottom-0 left-0 bg-secondary text-on-secondary font-label-bold text-[10px] px-3 py-1">UPGRADES</div>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2 group-hover:text-secondary transition-colors">PRECISION STEERING</h3>
              <p className="text-on-surface-variant text-sm line-clamp-2">The ultimate guide to upgrading your headset bearings and fork geometry.</p>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="w-full relative bg-surface-container-lowest border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-start w-full px-margin-mobile md:px-margin-desktop py-12 max-w-max-width mx-auto gap-gutter">
          <div className="space-y-6 max-w-sm">
            <div className="font-display-lg text-headline-xl text-on-surface">VOLT DRIFT</div>
            <p className="text-on-surface-variant text-sm">Pioneering the future of electric motorsport. Engineered for those who live life sideways.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-12">
            <div className="flex flex-col gap-4">
              <span className="font-label-bold text-xs text-secondary-fixed uppercase tracking-widest">SUPPORT</span>
              <a className="text-on-surface-variant hover:text-secondary transition-colors text-sm font-label-bold" href="#">TECHNICAL MANUALS</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors text-sm font-label-bold" href="#">WARRANTY</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors text-sm font-label-bold" href="#">SHIPPING POLICY</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="font-label-bold text-xs text-secondary-fixed uppercase tracking-widest">COMMUNITY</span>
              <a className="text-on-surface-variant hover:text-secondary transition-colors text-sm font-label-bold" href="#">TRACK FINDER</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors text-sm font-label-bold" href="#">DEALERS</a>
              <a className="text-on-surface-variant hover:text-secondary transition-colors text-sm font-label-bold" href="#">FORUMS</a>
            </div>
          </div>
        </div>
        <div className="w-full px-margin-mobile md:px-margin-desktop py-8 border-t border-outline-variant/10 max-w-max-width mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-on-surface-variant text-[10px] font-label-bold tracking-widest">
            <span>© 2024 VOLT DRIFT MOTORSPORTS. ENGINEERED FOR PRECISION.</span>
            <div className="flex gap-6">
              <span>PRIVACY</span>
              <span>TERMS</span>
              <span>COOKIE POLICY</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
