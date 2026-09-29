import { useState } from 'react';
import { EllipsisIcon, PlusIcon } from 'lucide-react';
import { DOC_KINDS } from '@/data/projectKinds.js';
import { fmtDate } from '@/lib/dates.js';
import { addDocument, removeDocument, setDocumentStatus } from '@/store/projectActions.js';
import { toast } from '@/store/toast.js';
import { Status } from '@/ui/Badge.jsx';
import { Button, IconButton } from '@/ui/Button.jsx';
import { Field, Select, TextInput, useForm } from '@/ui/Form.jsx';
import { Menu } from '@/ui/Floating.jsx';
import { Drawer } from '@/ui/Overlay.jsx';
import { Card } from '@/ui/Page.jsx';

function DocumentDrawer({ p, onClose }) {
  const form = useForm({ kind: 'submittal', title: '', ref: '', rev: '' }, (v) => (v.title.trim().length >= 3 ? {} : { title: 'Give the document a title.' }));
  const save = form.submit((v) => {
    addDocument(p.id, { kind: v.kind, title: v.title.trim(), ref: v.ref.trim(), rev: v.rev.trim() });
    toast('Document added');
    onClose();
  });
  return (
    <Drawer open onClose={onClose} title="Add a document" subtitle={p.number}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add document</Button></>}>
      <form onSubmit={save} className="grid grid-cols-1 gap-4">
        <Field label="Kind"><Select {...form.bind('kind')} options={Object.entries(DOC_KINDS).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Title" required error={form.error('title')}><TextInput {...form.bind('title')} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reference"><TextInput {...form.bind('ref')} autoComplete="off" /></Field>
          <Field label="Revision"><TextInput {...form.bind('rev')} autoComplete="off" /></Field>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}

const ACTIONS = { draft: 'In preparation', submitted: 'Submit to the consultant', approved: 'Approved', rejected: 'Rejected', issued: 'Issued to the customer' };

export function ProjectDocuments({ p, manage }) {
  const [adding, setAdding] = useState(false);
  const editable = manage && p.phase !== 'complete';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-600">
          The papers of the project. Drawings, calculations and material submittals go to the consultant for approval; the approval of the drawings by the Civil Defence is needed before installation; as-builts, manuals, warranties and test reports are issued to the customer at handover.
        </p>
        {editable && <Button icon={PlusIcon} onClick={() => setAdding(true)}>Add a document</Button>}
      </div>
      <Card bodyClassName="!px-2 !pt-2">
        <ul className="divide-y divide-slate-100">
          {p.documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3">
              <span className="min-w-0 flex-1 basis-64">
                <span className="block text-sm font-medium text-slate-900">{d.title}</span>
                <span className="block text-xs text-slate-500">{DOC_KINDS[d.kind]}{d.rev ? ` · Rev ${d.rev}` : ''}{d.ref ? ` · ${d.ref}` : ''}</span>
              </span>
              <span className="w-24 shrink-0 text-xs tabular-nums text-slate-500">{d.on ? fmtDate(d.on) : ''}</span>
              <Status kind="document" value={d.status} dot={false} />
              {editable && (
                <Menu
                  button={(props) => <IconButton icon={EllipsisIcon} label={`Actions for ${d.title}`} size="xs" {...props} />}
                  items={[
                    ...Object.entries(ACTIONS).filter(([status]) => status !== d.status).map(([status, label]) => ({ label, onClick: () => setDocumentStatus(p.id, d.id, status) })),
                    { separator: true },
                    { label: 'Remove', tone: 'danger', onClick: () => removeDocument(p.id, d.id) },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>
      {adding && <DocumentDrawer p={p} onClose={() => setAdding(false)} />}
    </div>
  );
}
