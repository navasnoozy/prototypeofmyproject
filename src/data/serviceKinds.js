import { CalendarCheckIcon, PhoneCallIcon, WrenchIcon } from 'lucide-react';

// The words of the Service area. Sources are our own study (sections D.3 and
// K.4) and the standards it names; where a UAE rule could not be read, the
// screens say "sample".

export const JOB_KINDS = {
  planned_visit: {
    label: 'Planned visit',
    icon: CalendarCheckIcon,
    blurb: 'A visit of a contract\'s visit plan: inspect and test what is due.',
  },
  call_out: {
    label: 'Call-out',
    icon: PhoneCallIcon,
    blurb: 'A customer reports a fault: attend, fix it or report it.',
  },
  repair: {
    label: 'Repair',
    icon: WrenchIcon,
    blurb: 'Work from an accepted repair quotation, or a repair under a contract.',
  },
};

export const JOB_STATUS_TEXT = {
  upcoming: 'Upcoming',
  unplanned: 'Needs planning',
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  report_sent: 'Report sent',
  cancelled: 'Cancelled',
};

export const CALL_VIA = { phone: 'Phone call', email: 'Email', whatsapp: 'WhatsApp', walk_in: 'Walk-in', portal: 'Customer portal' };

export const WINDOWS = {
  morning: 'Morning (08:00 to 12:00)',
  afternoon: 'Afternoon (13:00 to 17:00)',
  night: 'Night (23:00 to 05:00)',
  all_day: 'All day',
};

export const CHECK_RESULTS = { pass: 'Pass', fail: 'Fail', not_tested: 'Not tested' };

// The three classes of NFPA 25 (2011 and later): what the standard calls
// noncritical deficiency, critical deficiency and impairment. Which words UAE
// technicians and customers use is still open (study, section R).
export const SEVERITY = {
  noncritical: { label: 'Non-critical', tone: 'blue', blurb: 'The system still works as designed. Correct it at the next opportunity.' },
  critical: { label: 'Critical', tone: 'orange', blurb: 'The system may not work as designed. Correct it soon.' },
  impairment: { label: 'Impairment', tone: 'red', blurb: 'A system or a part is out of order. Tell the owner at once.' },
};

// Where the repair of a deficiency stands. Separate from the severity: a
// critical deficiency can be new or repaired (study, section D.3).
export const DEFICIENCY_STATUS = {
  found: ['blue', 'Found'],
  reported: ['violet', 'Reported to customer'],
  quoted: ['orange', 'Quoted'],
  approved: ['blue', 'Approved by customer'],
  repaired: ['green', 'Repaired'],
  verified: ['green', 'Verified and closed'],
  declined: ['neutral', 'Declined by customer'],
};
export const DEFICIENCY_STEPS = ['found', 'reported', 'quoted', 'approved', 'repaired', 'verified'];

// Civil Defence approval of a maintenance contract. Sample: how each emirate
// approves contracts is confirmed in the research of phase 2.
export const CD_STATUS = {
  not_needed: ['neutral', 'Not needed'],
  to_submit: ['neutral', 'To submit'],
  submitted: ['orange', 'Waiting for the authority'],
  approved: ['green', 'Approved'],
  rejected: ['red', 'Refused'],
};

export const CONTRACT_STATUS = {
  draft: ['neutral', 'Draft'],
  awaiting_approval: ['orange', 'Waiting for approval'],
  active: ['green', 'Active'],
  expiring: ['orange', 'Ends soon'],
  ended: ['neutral', 'Ended'],
};

// The requirement a deficiency breaks, by kind of system (for the form's hint).
export const REQUIREMENT = {
  fire_alarm: 'NFPA 72, chapter 14: devices must be tested at the set frequency and work as designed.',
  sprinkler: 'NFPA 25: water-based systems must be inspected, tested and kept in working order.',
  fire_pump: 'NFPA 25: the fire pump must start and deliver its rated flow and pressure.',
  hydrant_hose: 'NFPA 25: hydrants, hose reels and valves must be accessible and work.',
  extinguishers: 'NFPA 10: each extinguisher must be inspected, maintained and tagged.',
  emergency_lighting: 'BS 5266: emergency lights must work for their rated time.',
  clean_agent: 'NFPA 2001: the agent, the release and the room integrity must be kept ready.',
  kitchen_hood: 'NFPA 17A and 96: the suppression system must work and the hood must be clean.',
  smoke_control: 'NFPA 92: fans and dampers must work as designed.',
  voice_alarm: 'EN 54-16: the voice alarm must announce in every zone.',
};
