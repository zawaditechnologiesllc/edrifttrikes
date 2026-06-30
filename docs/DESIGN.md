---
name: Voltage Drift
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#c3c5d9'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#8d90a2'
  outline-variant: '#434656'
  surface-tint: '#b7c4ff'
  primary: '#b7c4ff'
  on-primary: '#002681'
  primary-container: '#1e5bff'
  on-primary-container: '#ecedff'
  inverse-primary: '#004cec'
  secondary: '#c4f731'
  on-secondary: '#273500'
  secondary-container: '#a9da00'
  on-secondary-container: '#455c00'
  tertiary: '#ffb59e'
  on-tertiary: '#5e1700'
  tertiary-container: '#c53a00'
  on-tertiary-container: '#ffeae4'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b5'
  secondary-fixed: '#c1f42e'
  secondary-fixed-dim: '#a6d700'
  on-secondary-fixed: '#151f00'
  on-secondary-fixed-variant: '#3a4d00'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59e'
  on-tertiary-fixed: '#3a0b00'
  on-tertiary-fixed-variant: '#852400'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
typography:
  display-lg:
    fontFamily: Anton
    fontSize: 84px
    fontWeight: '400'
    lineHeight: '1.0'
    letterSpacing: 0.02em
  display-lg-mobile:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
  headline-xl:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
  headline-md:
    fontFamily: Anton
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  max-width: 1440px
---

## Brand & Style
The design system is engineered for high-performance electric drifting, capturing the raw energy of street motorsport and the precision of electric engineering. The brand personality is bold, authoritative, and unapologetically "expert." It moves with a sense of kinetic urgency—fast, loud, and technically advanced.

The aesthetic blends **Industrial Minimalism** with **High-Contrast Boldness**. We leverage a "Shift" concept: dark, high-adrenaline marketing layers transition into clean, clinical, high-conversion shopping environments. Design elements should incorporate diagonal "speed lines" (15-degree slants) and subtle technical grids to reinforce the electric-motorsport narrative.

## Colors
The palette is built on extreme contrast to mirror the "E-Drift" lifestyle. 

- **Charcoal Black (#0E0E11)**: The foundation for the "Garage" mode—used for high-impact hero sections, footers, and technical specs.
- **Off-White (#F6F6F3)**: The foundation for the "Showroom" mode—used for clean e-commerce listings and checkout flows to ensure maximum readability and focus.
- **Voltage Blue (#1E5BFF)**: The primary action color. It represents electric power and precision. Use for primary buttons and active states.
- **Hazard Lime (#CBFF3A)**: A high-energy accent used sparingly to highlight "New" arrivals or performance peaks. It should feel like a neon spark.
- **Signal Orange (#FF5A1F)**: Reserved for urgency, "Sale" indicators, and critical alerts.
- **Slate Gray (#6B7280)**: Used for secondary metadata and technical descriptions to provide hierarchy without visual clutter.

## Typography
The typography system uses a "Mechanical vs. Technical" pairing. 

- **Headlines**: 'Anton' is the voice of the brand. It must always be ALL-CAPS. It is condensed, heavy, and impactful, mimicking the verticality of urban architecture and the speed of the track. Use tight letter-spacing for large displays.
- **Body**: 'Inter' provides the technical balance. It is neutral and highly legible, ensuring that complex specs and shopping details are clear. 
- **Utility**: Labels and navigation items should use Inter Bold in uppercase with slight tracking to maintain the industrial feel even at small sizes.

## Layout & Spacing
This design system utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

- **The Power Slant**: Layout sections should occasionally be separated by 15-degree diagonal dividers rather than horizontal lines to create a sense of forward motion.
- **Rhythm**: Use a 4px/8px baseline grid. Large components should be separated by aggressive whitespace (64px+) to allow the bold typography room to breathe.
- **Technical Insets**: Use technical grid lines (1px width, 10% opacity) in the background of dark sections to evoke blueprint and engineering aesthetics.

## Elevation & Depth
Elevation in this system is communicated through **Tonal Stacking** and **Tactile Borders** rather than heavy shadows.

- **Dark Mode Depth**: On #0E0E11, use slightly lighter charcoal surfaces (#1A1A1E) to indicate elevation. Borders should be 1px solid at 20% white opacity.
- **Light Mode Depth**: Use soft, diffused shadows (0px 4px 20px rgba(0,0,0,0.05)) only on hover states for product cards.
- **Industrial Accents**: Use 1px "Hazard Lime" or "Voltage Blue" borders on active components to signify "Power On" states. Avoid rounded shadows; keep depth effects crisp and intentional.

## Shapes
The shape language is "Precision Industrial." 

- **Radius**: A standard 8px (0.5rem) radius is applied to buttons and cards to balance modern tech with rugged durability.
- **The Cut-Corner**: For badges and decorative tags, use a 45-degree "clipped corner" effect on the top-right and bottom-left to mimic industrial VIN plates or racing decals.
- **Tire Tread**: Vertical or diagonal repeating line patterns can be used as subtle border treatments or dividers.

## Components
- **Buttons**: All buttons use 8px corner radius and bold uppercase labels. 
  - *Primary*: Solid Voltage Blue with White text.
  - *Energy*: Solid Hazard Lime with Black text (used for "Pre-Order" or "Launch").
  - *Ghost*: 1px White/Black border with transparent center.
- **Cards**: In light areas, use thin 1px Slate Gray borders and 8px radius. On hover, apply a soft shadow and a 2px Voltage Blue bottom-border "accent line."
- **Badges**: Use the "Cut-corner" pill style. Hazard Lime for 'NEW' or 'IN STOCK'; Signal Orange for 'SALE' or 'LOW STOCK'.
- **Input Fields**: Sharp, 1px bordered boxes with 4px radius. Active state features a Voltage Blue glow (2px outer stroke).
- **Lists**: Technical specs should be presented in a two-column grid with subtle 1px horizontal dividers and "Hazard Lime" bullet points (small squares, not circles).
- **Touch Targets**: All interactive elements must maintain a minimum 44x44px hit area to support use in rugged or mobile environments.