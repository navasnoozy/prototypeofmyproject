// The phone frame shows this same application inside an iframe, opened with
// "?frame=1&as=<person>". Such a copy keeps its "signed in" person in memory
// only, so the office window and the phone window can show different people
// while sharing one set of data.
const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);

export const EMBEDDED = params.has('frame');
export const EMBED_USER = params.get('as') ?? '';
