import type { Metadata } from "next";
import Script from "next/script";
import { DEMO_SITE_ID } from "@/lib/demo";

export const metadata: Metadata = { title: "Brightside Dental Studio (demo)", robots: { index: false } };

/**
 * Fictional landing page used by the seed data and the heatmap viewer.
 * Section heights are fixed on desktop (1440px wide → 3000px tall) so seeded
 * click coordinates line up with real elements.
 */
export default function DemoPage() {
  return (
    <div className="bg-white text-slate-900">
      <Script src="/tracker.js" data-site-id={DEMO_SITE_ID} strategy="afterInteractive" />

      <header className="flex items-center justify-between border-b px-6 py-4 lg:h-[72px] lg:px-[120px] lg:py-0">
        <span className="text-lg font-bold text-teal-700">Brightside Dental</span>
        <nav className="hidden gap-8 text-sm font-medium md:flex">
          <a href="#services">Services</a>
          <a href="#pricing">Pricing</a>
          <a href="#reviews">Reviews</a>
        </nav>
        <a href="#contact" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white">
          Book now
        </a>
      </header>

      <section className="flex flex-col items-center justify-center px-6 py-20 text-center lg:h-[640px] lg:py-0">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight lg:text-6xl">Calm, modern dentistry in the heart of the city</h1>
        <p className="mt-6 max-w-xl text-lg text-slate-600">Same-week appointments, transparent pricing and a team that actually explains things.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#contact" className="rounded-md bg-teal-700 px-6 py-3 font-semibold text-white">
            Book a free consult
          </a>
          <a href="#pricing" className="rounded-md border border-slate-300 px-6 py-3 font-semibold">
            See pricing
          </a>
        </div>
      </section>

      <section id="services" className="bg-slate-50 px-6 py-16 lg:h-[560px] lg:px-[120px] lg:py-16">
        <h2 className="text-center text-3xl font-bold">Services</h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {[
            ["Check-ups & cleaning", "Thorough exams, gentle cleaning and digital X-rays."],
            ["Invisalign", "Clear aligners planned with a 3D scan, no messy moulds."],
            ["Whitening", "In-chair or take-home whitening with lasting results."],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col rounded-xl border bg-white p-6 lg:h-[320px]">
              <h3 className="text-xl font-semibold">{t}</h3>
              <p className="mt-3 flex-1 text-slate-600">{d}</p>
              <a href="#contact" className="mt-6 font-semibold text-teal-700">
                Learn more →
              </a>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="px-6 py-16 lg:h-[680px] lg:px-[120px]">
        <h2 className="text-center text-3xl font-bold">Simple pricing</h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {[
            ["Essentials", "$89", "Exam, clean and X-rays"],
            ["Membership", "$29/mo", "Two visits a year + 15% off treatment"],
            ["Smile Plus", "$249", "Essentials + whitening session"],
          ].map(([t, p, d], i) => (
            <div key={t} className={`flex flex-col rounded-xl border p-8 lg:h-[440px] ${i === 1 ? "border-teal-700 ring-2 ring-teal-700" : ""}`}>
              <h3 className="text-lg font-semibold">{t}</h3>
              <p className="mt-4 text-4xl font-bold">{p}</p>
              <p className="mt-4 flex-1 text-slate-600">{d}</p>
              <a href="#contact" data-track-conversion={`pricing_${i}`} className="rounded-md bg-teal-700 px-4 py-3 text-center font-semibold text-white">
                Choose {t}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section id="reviews" className="bg-slate-50 px-6 py-16 text-center lg:h-[360px] lg:px-[120px]">
        <h2 className="text-3xl font-bold">4.9 ★ from 1,200+ patients</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">&ldquo;The first dentist I don&apos;t dread visiting. Clear prices, no upselling, and they ran on time.&rdquo;</p>
      </section>

      <section id="contact" className="px-6 py-16 lg:h-[520px]">
        <h2 className="text-center text-3xl font-bold">Book your visit</h2>
        <form data-track-conversion="booking_form" className="mx-auto mt-8 grid max-w-xl gap-4">
          <label className="sr-only" htmlFor="demo-name">
            Name
          </label>
          <input id="demo-name" className="rounded-md border px-4 py-3" placeholder="Your name" />
          <label className="sr-only" htmlFor="demo-email">
            Email
          </label>
          <input id="demo-email" type="email" className="rounded-md border px-4 py-3" placeholder="Email" />
          <button type="submit" className="rounded-md bg-teal-700 px-4 py-3 font-semibold text-white">
            Request appointment
          </button>
        </form>
      </section>

      <footer className="border-t px-6 py-10 text-center text-sm text-slate-500 lg:h-[168px] lg:py-0 lg:leading-[168px]">
        Brightside Dental Studio is a fictional business used for demo data.
      </footer>
    </div>
  );
}
