import { Link } from 'react-router';
import { Kbd, modKey } from '@/ui/Badge.jsx';

// The help card: how to use the prototype. Real product help comes later.
export function HelpContent({ onNavigate, inline = false }) {
  return (
    <div className={inline ? 'space-y-3 text-sm text-slate-700' : 'space-y-3 p-5 text-sm text-slate-700'}>
      <h2 className="text-sm font-semibold text-slate-900">How to use this prototype</h2>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Everything is clickable. Changes are saved in this browser only.</li>
        <li>
          <strong className="font-semibold text-slate-900">View as</strong> (top bar) shows the product as
          another person sees it. Every role has its own Home.
        </li>
        <li>
          <strong className="font-semibold text-slate-900">Journeys</strong> are five whole stories, step by
          step, with the person who does each step.
        </li>
        <li>
          The <strong className="font-semibold text-slate-900">i</strong> button on each screen explains what
          the screen is for and what is only assumed.
        </li>
        <li className="flex flex-wrap items-center gap-1.5">
          Search anything with <span className="flex gap-1"><Kbd>{modKey()}</Kbd><Kbd>K</Kbd></span>
        </li>
        <li>
          <strong className="font-semibold text-slate-900">Reset demo data</strong> (account menu) puts back
          the first sample data.
        </li>
      </ul>
      <p>
        <Link to="/journeys" onClick={onNavigate} className="font-medium text-slate-900 underline underline-offset-2">
          Open the journeys
        </Link>{' '}
        to follow a story from the first step to the last.
      </p>
    </div>
  );
}
