import { ABSENCE_KINDS } from '@/data/projectKinds.js';
import { addAbsence } from '@/store/scheduleActions.js';
import { fieldStaff } from '@/store/scheduleSelectors.js';
import { useStore } from '@/store/store.js';
import { toast } from '@/store/toast.js';
import { Button } from '@/ui/Button.jsx';
import { Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Drawer } from '@/ui/Overlay.jsx';

// The days a person is not available. Schedule only knows "not available":
// leave and working hours are matters for HR, later (study, K.6).
export function AbsenceDrawer({ staffId = '', date, onClose }) {
  const s = useStore();
  const form = useForm(
    { staffId, kind: 'leave', from: date, to: date, note: '' },
    (v) => ({
      ...(v.staffId ? {} : { staffId: 'Choose the person.' }),
      ...(v.from ? {} : { from: 'Choose the first day.' }),
      ...(v.to && v.to >= v.from ? {} : { to: 'The last day cannot be before the first.' }),
    }),
  );
  const save = form.submit((v) => {
    addAbsence({ staffId: v.staffId, from: v.from, to: v.to, kind: v.kind, note: v.note.trim() });
    toast('Marked as not available');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Not available" subtitle="The board will not take work on these days without a warning"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Person" required error={form.error('staffId')}>
          <Select {...form.bind('staffId')} placeholder="Choose a person" options={fieldStaff(s).map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
        <Field label="Why"><Select {...form.bind('kind')} options={Object.entries(ABSENCE_KINDS).map(([value, label]) => ({ value, label }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First day" required error={form.error('from')}><TextInput type="date" {...form.bind('from')} /></Field>
          <Field label="Last day" required error={form.error('to')}><TextInput type="date" {...form.bind('to')} /></Field>
        </div>
        <Field label="Note"><TextInput {...form.bind('note')} autoComplete="off" /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
