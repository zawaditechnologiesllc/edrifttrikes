-- Shipping fee settings (admin-controlled flat rate or free shipping) and the
-- complete Tech Lab article set. Run after 0003. Safe to re-run — articles are
-- upserted by slug, columns added only if missing.

-- ---------------------------------------------------------------------------
-- Shipping: one flat, constant fee for every order, editable in
-- /admin/settings — or tick free_shipping and every order ships free.
-- ---------------------------------------------------------------------------
alter table public.site_settings
  add column if not exists shipping_cents int not null default 5000,
  add column if not exists free_shipping boolean not null default false;

-- ---------------------------------------------------------------------------
-- Tech Lab: six complete articles (replaces the seed stubs by slug).
-- ---------------------------------------------------------------------------
insert into public.articles (slug, title, excerpt, body, cover_url, category, author, read_minutes, published)
values
(
  'sleeve-fitting',
  'DIY Guide: PVC Slide Sleeve Fitting',
  'Swap your rear sleeves in under 20 minutes with basic tools — here''s the full walkthrough, torque specs included.',
  'Slide sleeves are the single most consumable part of a drift trike. Every session grinds a little more material off the rear, and once the wall thickness drops below about 5 mm the slide gets unpredictable — grippy one moment, washing out the next. The good news: replacing them is a 20-minute job with tools you already own.

WHAT YOU NEED

A 6 mm hex key, a rubber mallet, a heat gun or hair dryer, dish soap, and your new sleeve set. We recommend UHMWPE sleeves over plain PVC — they run quieter, last roughly three times longer, and their wear is far more linear, so the trike behaves the same on day one and day thirty.

STEP 1 — LIFT AND STRIP

Get the rear axle off the ground on a stand or a pair of blocks. Pull the retaining clips at the outer edge of each rear hub with the hex key. Keep the clips somewhere safe; they are the only thing standing between your sleeve and the scenery.

STEP 2 — REMOVE THE WORN SLEEVES

Worn sleeves usually slide off by hand. If yours have heat-welded themselves to the hub after a long summer, warm the sleeve evenly with the heat gun for 60–90 seconds and tap it off with the mallet, working around the circumference. Never pry from one point — you''ll gouge the hub face.

STEP 3 — INSPECT THE HUB

With the sleeve off, check the hub surface for ridges or melted streaks. Light scoring is normal; smooth it with 240-grit paper. Deep grooves mean the sleeve was run too thin — replace the hub before it eats sleeves for breakfast.

STEP 4 — FIT THE NEW SET

Wipe a thin film of soapy water inside the new sleeve, line it up square to the hub, and drive it home with the mallet against a wood block. It should seat with a firm, even shoulder contact all the way around. Refit the retaining clips and confirm they sit fully in their grooves.

STEP 5 — BED THEM IN

Fresh sleeves are slick. Take the first two or three runs at 60 percent — wide lines, gentle throttle — until the surface scuffs in and the slide becomes progressive. After that, you''re back to full commitment.

WHEN TO REPLACE

Check wall thickness monthly with calipers. Above 7 mm: ride. 5–7 mm: order the next set. Below 5 mm: park it until the new set arrives. Sleeves are cheap; collarbones are not.',
  '/assets/mechanic-sleeve-install.jpg', 'DIY Guide', 'The Garage', 8, true
),
(
  'choosing-your-hub-motor',
  'Choosing Your 72V Hub Motor',
  'Torque, winding count and thermal limits — how to pick the right motor for the way you actually ride.',
  'Not all hub motors are equal, and the spec sheet numbers most shops quote — peak watts, top speed — tell you the least about how a motor drifts. Here is what actually matters when you choose a 72V hub for a drift build.

WINDING COUNT BEATS WATTAGE

Two motors can both say "3000W" and feel completely different. A high-turn winding trades top speed for low-end torque: it breaks the rear loose the instant you crack the throttle, which is exactly what a drift build wants. A low-turn winding revs out further but arrives at its torque gently — great for commuting, useless for snapping into a slide. If the seller can''t tell you the turn count, walk away.

TORQUE AT ZERO RPM

Drifting lives below 20 mph. What you feel in a slide is torque at near-zero RPM, and that is set by winding, magnet grade and controller current — not by peak power. Our reference spec is 150 Nm peak from a custom-wound 72V unit; anything above roughly 120 Nm will break loose reliably on asphalt with a 90 kg rider.

THERMAL MASS IS YOUR SESSION LENGTH

Sustained slides dump current into the stator for seconds at a time, which is far harsher than cruising. A motor with more copper and a finned side plate stays out of thermal rollback longer. If you routinely ride 30-minute sessions, prioritise thermal mass over 2 mph of top speed. A motor that cuts power mid-slide isn''t a safety feature you want to meet at full lock.

SENSORED, ALWAYS

Hall-sensored motors start smoothly from a dead stop and recover cleanly when the wheel speed and ground speed disagree — which is the definition of a drift. Sensorless commutation stutters at low RPM. For drift duty, sensored is not optional.

MATCH THE CONTROLLER

The motor only makes the torque the controller lets it. Pair the winding with a controller rated for at least 1.5x the motor''s continuous phase current, and set your battery-side current limit to what the pack can actually deliver without sagging below 62V under load. Sag is the silent killer of break-loose feel.

THE SHORT VERSION

High turn count, 120 Nm or more at the wheel, hall sensors, generous thermal mass, and a controller with headroom. Ignore top speed bragging rights — the fastest trike through a corner is the one that is still making torque at the apex.',
  '/assets/motor-72v-hub.jpg', 'Tech', 'Lead Engineering', 6, true
),
(
  'first-drift-garage',
  'Building Your First Drift Garage',
  'The bench, the tools and the workflow behind a home garage that keeps a drift fleet alive.',
  'You don''t need a race shop to maintain a drift trike — you need a corner of a garage, a plan, and about a weekend of setup. Here is the layout we run and recommend.

THE BENCH

A solid bench at hip height is the heart of the space. Bolt it to the wall if you can: pressing bearings and seating sleeves puts real side-load into the surface. Cover one end with a rubber mat for electrical work — it protects connectors and stops small screws rolling into another dimension.

THE WALL

Shadow-board your tools. A sheet of pegboard, an outline pen, and thirty minutes means you will never again end a session hunting for the 6 mm hex that is somehow always missing. Dedicate one rail to consumables: sleeves, brake pads, spare clips, zip ties, and a box of the exact fasteners your trike uses.

POWER AND CHARGING

Give charging its own circuit and its own shelf — steel or cement board, never wood, never carpet. Chargers live where you can see them, smoke alarms live directly above, and packs are never charged unattended overnight. A simple wall timer that cuts power after four hours is cheap insurance.

THE ELECTRICAL CORNER

A soldering station, flux, adhesive-lined heat shrink, a crimper for ring terminals, and a multimeter cover 95 percent of drift trike electrical work. Keep a printed wiring diagram of your own build taped inside a cabinet door; future-you at 11 pm with a dead throttle will be grateful.

LIFTING AND HOLDING

A motorcycle stand or two milk crates and a plank — either way, get the rear axle off the ground for sleeve and wheel work. Add a cheap torque wrench: axle nuts on a drift trike see vibration that laughs at hand-tight.

THE WORKFLOW

The habit that separates a garage from a pile of tools: every session ends with a five-minute reset. Trike on the stand, quick visual of sleeves and spokes, batteries to storage charge, tools back on their shadows. When everything starts where it belongs, every job starts halfway done.

START SMALL

Bench, board, charge shelf, stand. Everything else — the compressor, the parts washer, the second trike — arrives on its own schedule. A garage is never finished; it just gets more capable every month you ride.',
  '/assets/garage-workshop-night.jpg', 'Community', 'The Garage', 5, true
),
(
  'battery-care-72v',
  '72V Battery Care: Charge Habits That Double Pack Life',
  'Lithium packs don''t die of old age — they die of bad habits. Five rules that keep a 72V pack strong for years.',
  'A 72V lithium pack is the most expensive consumable on your trike, and the difference between a pack that fades in a year and one that''s still strong after four comes down to habits, not luck. These are the five that matter.

RULE 1 — STOP CHARGING AT 90 PERCENT

Every hour a cell sits at maximum voltage costs calendar life. Unless you need every mile of range tomorrow morning, set your charger to stop at 90 percent (most smart chargers have this option; ours ships with it on by default). The last 10 percent of range costs more pack life than the first 90 combined.

RULE 2 — NEVER STORE FULL, NEVER STORE EMPTY

Parking the trike for more than a week? Leave the pack at 40–60 percent. A full pack in a hot garage ages fastest of all; an empty one risks dropping below the protection cutoff, and a pack that sits below cutoff for weeks may never wake up again. Storage charge is the single biggest lever you have on longevity.

RULE 3 — RESPECT TEMPERATURE

Lithium hates charging below 5°C and hates everything above 45°C. In winter, bring the pack indoors and let it reach room temperature before charging — charging a cold pack plates lithium onto the anode, and that damage is permanent. In summer, charge in the shade and never right after a hard session; give it twenty minutes to cool first.

RULE 4 — SAG IS A WARNING, NOT A PERSONALITY

If your voltage display dives hard under throttle and rebounds at rest, the pack is telling you its internal resistance is climbing — from age, cold, or one weak parallel group. Persistent sag below 62V under load on a 72V pack deserves investigation before it strands you mid-session.

RULE 5 — BALANCE ONCE A MONTH

Give the pack one full charge to 100 percent every four to six weeks and let it sit on the charger for an extra hour after it finishes. That is when the battery management system quietly evens out the cell groups. Skip it for months and the weakest group starts deciding your range.

THE PAYOFF

Riders who follow these five rules routinely report 80 percent capacity after 500-plus cycles — roughly double what careless charging delivers. Ten seconds of thought per charge, years of extra pack. That is the best tuning money can''t buy.',
  '/assets/volt-s1-pro-cockpit.jpg', 'Tech', 'Lead Engineering', 7, true
),
(
  'first-slide-technique',
  'Your First Slide: Drift Technique for Beginners',
  'From first wobble to controlled full-lock — the progression that gets you sliding safely in one afternoon.',
  'Everyone remembers their first real slide — the moment the rear lets go and, instead of panic, something clicks. Getting there isn''t talent; it''s progression. Here is the one we teach.

BEFORE YOU START

Full-face helmet, gloves, knee and elbow pads. Find a wide, empty stretch of smooth asphalt with a very slight downhill and zero traffic — an empty parking lot on a Sunday morning is perfect. Check your sleeves, your brakes, and your tyre pressure. Nerves are normal; skipping the checklist is not.

STAGE 1 — ROLL AND LEAN (15 MINUTES)

Before any throttle games, learn the chassis. Ride slow figure-eights and feel how the trike leans, where the pedals are at full lock, and how far you can turn the bars before the geometry pushes back. Boring, and worth every minute.

STAGE 2 — THE LIFT-OFF SLIDE

Carry moderate speed into a wide turn, then snap the throttle closed mid-corner. The weight shifts forward, the rear unloads, and the sleeves let go — a small, short slide that ends on its own. Repeat until the letting-go feeling stops spiking your heart rate. You are teaching your inner ear that a sliding rear is information, not emergency.

STAGE 3 — CATCH IT WITH YOUR EYES

The secret every drifter learns eventually: you steer where you look. As the rear steps out, look far down the path you want, and let your hands follow. Counter-steer happens almost by itself when your eyes lead. If you stare at the thing you''re afraid of hitting, you will hit it — target fixation is undefeated.

STAGE 4 — POWER OVER

Now add throttle mid-corner instead of cutting it. The rear breaks loose under power and, unlike the lift-off slide, it keeps sliding as long as you feed it. Start with short bursts: break loose, hold for half a second, roll off, straighten. Lengthen the hold as your hands and eyes sync up.

STAGE 5 — LINK TWO CORNERS

The graduation exercise: exit one slide directly into the entry of the next, using the pendulum of the first to initiate the second. The first time you link two corners clean, you will understand why this sport is a lifestyle.

THE HONEST TIMELINE

Most riders get through Stage 4 in one focused afternoon. Linking comes in week two or three. Full-lock, throttle-steered laps take a season. Every expert you follow started with Stage 1 — the only rider you need to beat is yesterday''s.',
  '/assets/action-360-slide.jpg', 'Riding', 'The Garage', 6, true
),
(
  'pre-ride-safety-checklist',
  'The 5-Minute Pre-Ride Safety Checklist',
  'Five minutes, ten checks — the routine that catches problems in the garage instead of mid-corner.',
  'Almost every mechanical incident we hear about was visible in the garage before the ride. This is the checklist we run before every session — it takes five minutes with the trike on the ground and no tools.

1 — SLEEVES

Look and feel. Even wear, no cracks at the edges, wall thickness comfortably above 5 mm. A sleeve that lets go mid-corner is the most avoidable crash in the sport.

2 — TYRE AND FRONT END

Front tyre pressure to spec, valve cap on, no cords showing. Grab the front wheel and rock it side to side: any click or play means the headset or axle needs attention before you ride, not after.

3 — BARS AND LEVERS

Stand over the front wheel and try to twist the bars out of line. They shouldn''t move. Brake lever pulls firm and returns crisply — a lever that reaches the grip has air in the line or worn pads.

4 — BRAKE BITE

Roll the trike forward and apply the brake hard. It should stop the wheel decisively. Do it once more. Two clean bites in the garage beats discovering fade at 30 mph.

5 — FASTENER SCAN

Ten seconds per wheel: axle nuts, brake caliper bolts, seat mount. Drift vibration backs fasteners out gradually — a witness mark of paint across each nut lets you spot movement at a glance.

6 — BATTERY SEATED AND LOCKED

Physically tug the pack. Latched, strapped, connector fully home. A pack that shifts in a slide changes the trike''s balance at the worst possible moment.

7 — THROTTLE RETURN

Twist and release. It must snap back instantly from every angle of the bars. A sticky throttle is a no-ride fault, full stop.

8 — LIGHTS AND CUTOFF

If you run lights, check them. Test the kill switch or brake cutoff actually cuts the motor — it exists for exactly one moment, and that moment is a bad time to learn it''s unplugged.

9 — VOLTAGE

Check the display. Enough charge for the session plus the ride home, and no unexplained overnight drop — a pack that self-discharged noticeably has a problem worth finding indoors.

10 — YOU

Helmet buckled, gloves on, pads where pads go. Ride within the day''s conditions: damp asphalt halves your grip and doubles your stopping distance, and the session is only good if you''re fit to ride the next one.

Print it, tape it to the garage wall, run it every time. Five minutes is cheap; the alternative never is.',
  '/assets/action-mid-slide.jpg', 'Safety', 'The Garage', 4, true
)
on conflict (slug) do update set
  title=excluded.title, excerpt=excluded.excerpt, body=excluded.body,
  cover_url=excluded.cover_url, category=excluded.category, author=excluded.author,
  read_minutes=excluded.read_minutes, published=excluded.published;
