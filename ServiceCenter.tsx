import { useApp } from '../store';
import { go } from '../router';
import { Icon, PageHeader } from '../components/ui';
import { inr } from '../utils';

const STEPS = [
  { title: 'Report the fault', text: 'Call or send an enquiry with the machine, location and symptoms.' },
  { title: 'Diagnose and quote', text: 'An engineer inspects on site or in our workshop and issues a written quote.' },
  { title: 'Repair', text: 'Work starts after approval. Replaced parts are returned on request.' },
  { title: 'Test and report', text: 'Load test, readings and a service report are handed over with the machine.' },
];

export function ServiceCenter() {
  const { services, company, setPrefill } = useApp();

  return (
    <>
      <PageHeader
        eyebrow="Vel Service Center"
        title="Repair, overhaul and on-site support"
        lead="Factory-trained engineers for motors, hydraulics, machine tools and fabricated equipment."
      />

      <div className="wrap mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="min-w-0" aria-label="Services">
          <ul className="panel divide-y divide-steel-200">
            {services.length === 0 ? (
              <li className="p-6 text-ink-500">No services are listed right now. Please call {company.phone}.</li>
            ) : null}
            {services.map((s) => (
              <li key={s.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold">{s.name}</h2>
                  <p className="mt-1 max-w-2xl text-ink-700">{s.description}</p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {s.coverage.map((c) => (
                      <li key={c} className="rounded-sm bg-steel-100 px-2 py-0.5 font-mono text-xs text-ink-700">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between gap-6 md:flex-col md:items-end md:justify-center">
                  <p className="text-left md:text-right">
                    <span className="block text-xs text-steel-500">Starting at</span>
                    <span className="text-2xl font-bold tabular-nums">{inr(s.priceFrom)}</span>
                    <span className="block font-mono text-xs text-ink-500">{s.turnaround}</span>
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setPrefill(s.name);
                      go('service-enquiry');
                    }}
                  >
                    Request this service
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 text-3xl font-semibold">How a service job runs</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="panel p-5">
                <span className="font-mono text-xs text-forge-dark">STEP {i + 1}</span>
                <h3 className="mt-1 text-xl font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-700">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <aside className="min-w-0 lg:sticky lg:top-32 lg:self-start">
          <div className="bg-ink p-6 text-white">
            <h2 className="text-2xl font-semibold uppercase tracking-wide">Service desk</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-2">
                <Icon name="phone" className="mt-0.5 h-4 w-4 shrink-0 text-[#F2B26B]" />
                <span className="font-mono">{company.phone}</span>
              </li>
              <li className="flex gap-2">
                <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-[#F2B26B]" />
                {company.hours}
              </li>
              <li className="flex gap-2">
                <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-[#F2B26B]" />
                {company.address}
              </li>
            </ul>
            <a href="#service-enquiry" className="btn-primary mt-5 w-full">
              Send a service enquiry
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}
