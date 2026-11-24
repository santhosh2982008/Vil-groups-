import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import type { Enquiry } from '../types';
import { Field, Icon, PageHeader } from '../components/ui';
import { isValidEmail, isValidPhone } from '../utils';

const GENERAL = 'General enquiry';
const QUOTE = 'Custom manufacturing quote';

interface Form {
  name: string;
  phone: string;
  email: string;
  topic: string;
  equipment: string;
  preferredDate: string;
  message: string;
}

export function ServiceEnquiry() {
  const { services, company, session, prefill, setPrefill, submitEnquiry } = useApp();
  const topics = [...services.map((s) => s.name), QUOTE, GENERAL];

  const [form, setForm] = useState<Form>({
    name: session?.name ?? '',
    phone: '',
    email: session?.email ?? '',
    topic: prefill || topics[0],
    equipment: '',
    preferredDate: '',
    message: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [done, setDone] = useState<Enquiry | null>(null);

  useEffect(() => {
    if (prefill) {
      setForm((f) => ({ ...f, topic: prefill }));
      setPrefill('');
    }
  }, [prefill, setPrefill]);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof Form, string>> = {};
    if (form.name.trim().length < 2) next.name = 'Enter your name.';
    if (!isValidPhone(form.phone)) next.phone = 'Enter a phone number with at least 10 digits.';
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (form.message.trim().length < 10) next.message = 'Describe the problem or requirement in a few words.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setDone(submitEnquiry({ ...form, name: form.name.trim(), message: form.message.trim() }));
  };

  if (done) {
    return (
      <>
        <PageHeader eyebrow="Service Enquiry" title="Enquiry received" />
        <div className="wrap mt-10 max-w-2xl">
          <div className="panel p-8">
            <Icon name="check" className="h-10 w-10 text-ok" />
            <h2 className="mt-3 text-3xl font-semibold">Thank you, {done.name}.</h2>
            <p className="mt-2 text-ink-700">
              Our team will call you on <span className="font-mono">{done.phone}</span> during working hours ({company.hours}).
            </p>
            <p className="mt-4 font-mono text-sm">
              Reference <strong>{done.id}</strong>
            </p>
            <button
              type="button"
              className="btn-dark mt-6"
              onClick={() => {
                setDone(null);
                setForm((f) => ({ ...f, equipment: '', preferredDate: '', message: '' }));
              }}
            >
              Send another enquiry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Service Enquiry"
        title="Tell us what needs fixing, or building"
        lead="Fill in the form and a service engineer will call you the same working day."
      />

      <div className="wrap mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <form className="panel min-w-0 space-y-5 p-6" onSubmit={submit} noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name" htmlFor="enq-name" error={errors.name}>
              <input id="enq-name" className="field" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="enq-phone" error={errors.phone}>
              <input id="enq-phone" className="field" inputMode="tel" autoComplete="tel" placeholder="+91" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
          </div>

          <Field label="Email" htmlFor="enq-email" error={errors.email}>
            <input id="enq-email" type="email" className="field" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Enquiry type" htmlFor="enq-topic">
              <select id="enq-topic" className="field" value={form.topic} onChange={(e) => set('topic', e.target.value)}>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Preferred date (optional)" htmlFor="enq-date">
              <input id="enq-date" type="date" className="field" value={form.preferredDate} onChange={(e) => set('preferredDate', e.target.value)} />
            </Field>
          </div>

          <Field label="Equipment or part (optional)" htmlFor="enq-equipment" hint="Make, model, rating or part number helps us quote faster.">
            <input id="enq-equipment" className="field" placeholder="e.g. 15 kW pump motor, Crompton" value={form.equipment} onChange={(e) => set('equipment', e.target.value)} />
          </Field>

          <Field label="Describe the problem or requirement" htmlFor="enq-message" error={errors.message}>
            <textarea id="enq-message" rows={5} className="field" value={form.message} onChange={(e) => set('message', e.target.value)} />
          </Field>

          <button type="submit" className="btn-primary">
            Submit enquiry
          </button>
        </form>

        <aside className="min-w-0 space-y-4">
          <div className="bg-ink p-6 text-white">
            <h2 className="text-2xl font-semibold uppercase tracking-wide">Prefer to call?</h2>
            <p className="mt-3 font-mono text-lg">{company.phone}</p>
            {company.altPhone ? <p className="font-mono text-lg">{company.altPhone}</p> : null}
            <p className="mt-2 text-sm text-steel-200">{company.hours}</p>
          </div>
          <div className="panel p-5 text-sm text-ink-700">
            <p className="font-semibold text-ink">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>We log your enquiry and give it a reference number.</li>
              <li>An engineer calls to confirm the details.</li>
              <li>You receive a written quote or a visit date.</li>
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
