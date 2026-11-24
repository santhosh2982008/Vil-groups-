import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import type { Courier, RateCard, ShippingRules } from '../types';
import { INDIAN_STATES } from '../config';
import { seedShipping } from '../seed';
import { Field, Icon, PageHeader } from '../components/ui';
import { inr, rateCardFor, weightCharge } from '../utils';

const DEFAULT_KEY = '__default';

/** Number box that lets you type "0." or an empty value without fighting the cursor. */
function NumInput({ value, onChange, label, id, className = 'field' }: { value: number; onChange: (n: number) => void; label: string; id?: string; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      className={className}
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

function problems(rules: ShippingRules, couriers: Courier[]): string[] {
  const out: string[] = [];
  if (!(rules.boxWeightKg >= 0)) out.push('Box weight must be 0 or more.');
  const check = (name: string, c: RateCard) => {
    if (c.slabs.length === 0) out.push(`${name}: add at least one weight slab.`);
    const seen = new Set<number>();
    for (const sl of c.slabs) {
      if (!(sl.upToKg > 0)) out.push(`${name}: every slab needs a weight above 0 kg.`);
      else if (seen.has(sl.upToKg)) out.push(`${name}: two slabs end at ${sl.upToKg} kg.`);
      seen.add(sl.upToKg);
      if (!(sl.charge >= 0)) out.push(`${name}: charges cannot be negative.`);
    }
    if (!(c.extraPerKg >= 0)) out.push(`${name}: extra per kg cannot be negative.`);
  };
  check('Default rates', rules.defaultRate);
  for (const [n, c] of Object.entries(rules.states)) check(n, c);
  for (const c of couriers) if (c.weightBased && !(Number(c.multiplier) > 0)) out.push(`${c.name}: the multiplier must be above 0.`);
  return Array.from(new Set(out)).slice(0, 6);
}

/** Owner-only page: switch weight-based courier charges on, and edit the state-wise slab rates. */
export function CourierCharges() {
  const { settings, saveSettings, products } = useApp();
  const [rules, setRules] = useState<ShippingRules>(settings.shipping);
  const [couriers, setCouriers] = useState<Courier[]>(settings.couriers);
  const [stateKey, setStateKey] = useState<string>('Tamil Nadu');
  const [copyFrom, setCopyFrom] = useState('');
  const [confirm, setConfirm] = useState<'' | 'all' | 'reset'>('');
  const [errs, setErrs] = useState<string[]>([]);
  const [calc, setCalc] = useState({ state: 'Tamil Nadu', kg: 10 });
  const [search, setSearch] = useState('');

  const dirty = JSON.stringify(rules) !== JSON.stringify(settings.shipping) || JSON.stringify(couriers) !== JSON.stringify(settings.couriers);
  const card: RateCard = stateKey === DEFAULT_KEY ? rules.defaultRate : rules.states[stateKey] ?? rules.defaultRate;
  const setCard = (c: RateCard) =>
    setRules((r) => (stateKey === DEFAULT_KEY ? { ...r, defaultRate: c } : { ...r, states: { ...r.states, [stateKey]: c } }));
  const noWeight = products.filter((p) => !p.weightKg).length;

  const save = () => {
    const p = problems(rules, couriers);
    setErrs(p);
    if (p.length > 0) return;
    const sortCard = (c: RateCard): RateCard => ({ ...c, slabs: [...c.slabs].sort((a, b) => a.upToKg - b.upToKg) });
    const states: Record<string, RateCard> = {};
    for (const [n, c] of Object.entries(rules.states)) states[n] = sortCard(c);
    saveSettings({ ...settings, shipping: { ...rules, defaultRate: sortCard(rules.defaultRate), states }, couriers });
  };

  const sampleWeights = [1, 5, 10, 25, 50, 100];
  const rows = INDIAN_STATES.filter((st) => st.toLowerCase().includes(search.trim().toLowerCase()));
  const calcKg = Math.max(0, calc.kg);
  const calcCard = rateCardFor(rules, calc.state);
  const optionList = couriers.filter((c) => c.enabled);
  const calcTotalKg = calcKg + (calcKg > 0 || rules.boxWeightKg > 0 ? rules.boxWeightKg : 0);

  const sortedSlabs = useMemo(() => card.slabs.map((sl, i) => ({ sl, i })), [card]);

  return (
    <>
      <PageHeader eyebrow="Management" title="Courier Charge Management" lead="Courier charge = (products' net weight + box weight) matched to the destination state's weight slabs." />
      <div className="wrap mt-6 space-y-6 pb-24">
        <section className="panel space-y-4 p-5">
          <h2 className="text-2xl font-semibold">Calculation</h2>
          <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="cc-enabled">
            <input id="cc-enabled" type="checkbox" className="h-4 w-4 accent-[#B45309]" checked={rules.enabled} onChange={(e) => setRules({ ...rules, enabled: e.target.checked })} />
            Calculate courier charges from weight and destination state
          </label>
          <p className="text-xs text-ink-500">When off, every delivery option uses its flat charge from Shipping &amp; tax.</p>
          <Field label="Packing box weight (kg)" htmlFor="cc-box" hint="Added once to the net weight of the products in every order.">
            <NumInput id="cc-box" value={rules.boxWeightKg} onChange={(n) => setRules({ ...rules, boxWeightKg: n })} label="Packing box weight in kg" className="field w-40" />
          </Field>
          {noWeight > 0 ? (
            <p className="bg-forge-tint px-3 py-2 text-sm font-medium" role="status">
              {noWeight} product{noWeight === 1 ? ' has' : 's have'} no net weight set. Add it in each product so charges are accurate.
            </p>
          ) : null}

          <h3 className="pt-2 text-xl font-semibold">Delivery options</h3>
          <ul className="space-y-2">
            {couriers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-steel-200 p-3 text-sm">
                <span className="min-w-[12rem] flex-1 font-semibold">{c.name}{c.enabled ? '' : ' (disabled)'}</span>
                <label className="flex items-center gap-2" htmlFor={`cc-wb-${c.id}`}>
                  <input id={`cc-wb-${c.id}`} type="checkbox" className="h-4 w-4 accent-[#B45309]" checked={Boolean(c.weightBased)} onChange={(e) => setCouriers((l) => l.map((x) => (x.id === c.id ? { ...x, weightBased: e.target.checked } : x)))} />
                  Weight and state based
                </label>
                {c.weightBased ? (
                  <label className="flex items-center gap-2" htmlFor={`cc-mul-${c.id}`}>
                    Rate multiplier
                    <NumInput id={`cc-mul-${c.id}`} value={c.multiplier ?? 1} onChange={(n) => setCouriers((l) => l.map((x) => (x.id === c.id ? { ...x, multiplier: n } : x)))} label={`Multiplier for ${c.name}`} className="field w-24" />
                  </label>
                ) : (
                  <span className="font-mono text-xs text-ink-500">Flat {inr(c.charge)}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-500">A multiplier of 1.8 makes that option cost 1.8 times the rate card (for example express).</p>
        </section>

        <section className="panel space-y-4 p-5">
          <h2 className="text-2xl font-semibold">State rates</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="State" htmlFor="cc-state">
              <select id="cc-state" className="field" value={stateKey} onChange={(e) => setStateKey(e.target.value)}>
                <option value={DEFAULT_KEY}>Default (states without own rates)</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Copy rates from" htmlFor="cc-copy">
              <select id="cc-copy" className="field" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                <option value="">Choose a state</option>
                {INDIAN_STATES.filter((st) => st !== stateKey).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" className="btn-ghost" disabled={!copyFrom} onClick={() => { setCard(structuredClone(rateCardFor(rules, copyFrom))); setCopyFrom(''); }}>
              Copy
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-steel-100 text-left text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-3 py-2">Total weight up to (kg)</th>
                  <th className="px-3 py-2">Charge (₹)</th>
                  <th className="px-3 py-2 text-right">Remove</th>
                </tr>
              </thead>
              <tbody>
                {sortedSlabs.map(({ sl, i }) => (
                  <tr key={i} className="border-t border-steel-200">
                    <td className="px-3 py-2">
                      <NumInput value={sl.upToKg} label={`Slab ${i + 1} up to kg`} className="field w-32" onChange={(n) => setCard({ ...card, slabs: card.slabs.map((x, j) => (j === i ? { ...x, upToKg: n } : x)) })} />
                    </td>
                    <td className="px-3 py-2">
                      <NumInput value={sl.charge} label={`Slab ${i + 1} charge`} className="field w-32" onChange={(n) => setCard({ ...card, slabs: card.slabs.map((x, j) => (j === i ? { ...x, charge: n } : x)) })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-sm font-semibold text-bad hover:underline" onClick={() => setCard({ ...card, slabs: card.slabs.filter((_, j) => j !== i) })} aria-label={`Remove slab ${i + 1}`}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <button type="button" className="btn-ghost" onClick={() => setCard({ ...card, slabs: [...card.slabs, { upToKg: (Math.max(0, ...card.slabs.map((x) => x.upToKg)) || 0) + 25, charge: 0 }] })}>
              <Icon name="plus" className="h-4 w-4" /> Add slab
            </button>
            <Field label="Beyond the last slab, add ₹ per extra kg" htmlFor="cc-extra">
              <NumInput id="cc-extra" value={card.extraPerKg} label="Extra charge per kg" className="field w-32" onChange={(n) => setCard({ ...card, extraPerKg: n })} />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-steel-200 pt-4 text-sm">
            {confirm === 'all' ? (
              <>
                <span className="font-semibold">Replace the rates of every state with these?</span>
                <button type="button" className="btn-danger !px-3 !py-1" onClick={() => { setRules((r) => ({ ...r, states: Object.fromEntries(INDIAN_STATES.map((st) => [st, structuredClone(card)])) })); setConfirm(''); }}>Yes, apply to all</button>
                <button type="button" className="font-semibold hover:underline" onClick={() => setConfirm('')}>Cancel</button>
              </>
            ) : confirm === 'reset' ? (
              <>
                <span className="font-semibold">Restore the sample zone rates for all states?</span>
                <button type="button" className="btn-danger !px-3 !py-1" onClick={() => { setRules((r) => ({ ...r, defaultRate: seedShipping().defaultRate, states: seedShipping().states })); setConfirm(''); }}>Yes, restore</button>
                <button type="button" className="font-semibold hover:underline" onClick={() => setConfirm('')}>Cancel</button>
              </>
            ) : (
              <>
                <button type="button" className="btn-ghost" onClick={() => setConfirm('all')}>Apply these rates to all states</button>
                <button type="button" className="btn-ghost" onClick={() => setConfirm('reset')}>Restore sample rates</button>
              </>
            )}
          </div>
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="text-2xl font-semibold">Test a shipment</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Destination state" htmlFor="cc-calc-state">
              <select id="cc-calc-state" className="field" value={calc.state} onChange={(e) => setCalc({ ...calc, state: e.target.value })}>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Products' net weight (kg)" htmlFor="cc-calc-kg">
              <NumInput id="cc-calc-kg" value={calc.kg} label="Net weight in kg" className="field w-32" onChange={(n) => setCalc({ ...calc, kg: n })} />
            </Field>
          </div>
          <p className="font-mono text-sm" data-testid="calc-total">
            {calcKg} kg + {rules.boxWeightKg} kg box = {calcTotalKg.toFixed(1)} kg → rate card {inr(weightCharge(calcCard, calcTotalKg))}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {optionList.map((c) => (
              <li key={c.id} className="flex justify-between border border-steel-200 px-3 py-2 text-sm">
                <span>{c.name}</span>
                <span className="font-mono font-semibold tabular-nums">
                  {rules.enabled && c.weightBased ? inr(Math.round(weightCharge(calcCard, calcTotalKg) * (c.multiplier ?? 1))) : `${inr(c.charge)} flat`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">All states at a glance</h2>
            <input className="field max-w-xs" placeholder="Search state" aria-label="Search state" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="mt-1 text-xs text-ink-500">Rate card charge for a total shipment weight (box included), before option multipliers.</p>
          <div className="mt-3 max-h-96 overflow-auto border border-steel-200">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-steel-100 text-left text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-3 py-2">State</th>
                  {sampleWeights.map((w) => (
                    <th key={w} className="px-3 py-2 text-right">{w} kg</th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((st) => (
                  <tr key={st} className="border-t border-steel-200">
                    <td className="px-3 py-1.5">{st}</td>
                    {sampleWeights.map((w) => (
                      <td key={w} className="px-3 py-1.5 text-right font-mono tabular-nums">{inr(weightCharge(rateCardFor(rules, st), w))}</td>
                    ))}
                    <td className="px-3 py-1.5 text-right">
                      <button type="button" className="text-sm font-semibold hover:underline" onClick={() => { setStateKey(st); document.getElementById('cc-state')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} aria-label={`Edit rates for ${st}`}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-steel-200 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 text-sm">
            {errs.length > 0 ? (
              <ul className="font-medium text-bad" role="alert">
                {errs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <span className={dirty ? 'font-semibold text-forge-dark' : 'text-ink-500'}>{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" disabled={!dirty} onClick={() => { setRules(settings.shipping); setCouriers(settings.couriers); setErrs([]); }}>
              Discard
            </button>
            <button type="button" id="cc-save" className="btn-primary" disabled={!dirty} onClick={save}>
              Save courier charges
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
