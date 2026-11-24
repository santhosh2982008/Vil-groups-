import { useApp } from '../store';
import { go } from '../router';
import { Icon, PageHeader } from '../components/ui';

const PROCESS = [
  { title: 'Drawing review', text: 'Our engineers check tolerances, materials and quantity, and flag anything that drives cost.' },
  { title: 'Material procurement', text: 'Certified stock is ordered or drawn from inventory against the bill of materials.' },
  { title: 'Fabrication and machining', text: 'Cutting, welding, turning and milling on the shop floor with in-process checks.' },
  { title: 'Assembly and finishing', text: 'Sub-assemblies are fitted, tested and finished to the specified coating.' },
  { title: 'Final inspection', text: 'Dimensional report and test certificates are prepared before packing.' },
  { title: 'Dispatch', text: 'Packed and shipped with a GST invoice and delivery tracking.' },
];

export function Manufacturing() {
  const { company, setPrefill } = useApp();
  const m = company.manufacturing;

  return (
    <>
      <PageHeader eyebrow="Vel Manufacturing Company" title="Built to your drawing" lead={m.intro}>
        <button
          type="button"
          className="btn-primary mt-6"
          onClick={() => {
            setPrefill('Custom manufacturing quote');
            go('service-enquiry');
          }}
        >
          Request a manufacturing quote
        </button>
      </PageHeader>

      <section className="border-b border-steel-200 bg-white">
        <dl className="wrap grid grid-cols-2 gap-y-6 py-8 md:grid-cols-4">
          {m.stats.map((s) => (
            <div key={s.label} className="min-w-0 border-l-2 border-forge pl-4">
              <dd className="font-display text-4xl font-semibold tabular-nums">{s.value}</dd>
              <dt className="text-sm text-ink-500">{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap mt-14 grid gap-10 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="eyebrow">Capabilities</p>
          <h2 className="mt-1 text-4xl font-semibold">What the shop floor does</h2>
          <ul className="mt-5 grid gap-px border border-steel-200 bg-steel-200 sm:grid-cols-2">
            {m.capabilities.map((c) => (
              <li key={c} className="flex items-start gap-3 bg-white p-4">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-forge" />
                <span className="font-medium">{c}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <p className="eyebrow">Quality</p>
          <h2 className="mt-1 text-4xl font-semibold">Documented and inspected</h2>
          <ul className="mt-5 space-y-3">
            {m.certifications.map((c) => (
              <li key={c} className="panel flex items-center gap-3 p-4">
                <Icon name="shield" className="h-6 w-6 shrink-0 text-ink-500" />
                <span className="font-medium">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="wrap mt-14">
        <p className="eyebrow">Production flow</p>
        <h2 className="mt-1 text-4xl font-semibold">From drawing to dispatch</h2>
        <ol className="mt-6 grid gap-px border border-steel-200 bg-steel-200 md:grid-cols-2 lg:grid-cols-3">
          {PROCESS.map((p, i) => (
            <li key={p.title} className="bg-white p-5">
              <span className="font-mono text-xs text-forge-dark">STAGE {i + 1} OF {PROCESS.length}</span>
              <h3 className="mt-1 text-xl font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-ink-700">{p.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap mt-14">
        <div className="grid gap-6 bg-ink p-8 text-white md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-3xl font-semibold md:text-4xl">Send a drawing or a worn sample</h2>
            <p className="mt-1 text-steel-200">
              Our engineering desk replies with a quote and lead time. Call <span className="font-mono">{company.phone}</span> to
              talk it through.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setPrefill('Custom manufacturing quote');
              go('service-enquiry');
            }}
          >
            Start a quote request
          </button>
        </div>
      </section>
    </>
  );
}
