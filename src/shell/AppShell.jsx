import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useSession } from '@/store/session.js';
import { Toaster } from '@/ui/Toaster.jsx';
import { HelpCapsule, PhoneBar, Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

// The frame around every page (record 37): the brand capsule and the top bar,
// the sidebar's two capsules and the content panel over the canvas. On
// desktops only the content panel scrolls; on phones the page scrolls and the
// bottom bar stays.
export function AppShell() {
  const { areas } = useSession();
  const { pathname } = useLocation();

  // A new page starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>
      <div className="grid min-h-dvh grid-cols-1 gap-2 p-2 md:h-dvh md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)] md:gap-3 md:p-3 print:block print:p-0">
        <TopBar />
        <nav aria-label="Main" className="no-print hidden min-h-0 w-20 flex-col gap-3 md:flex">
          <Sidebar areas={areas} />
          <HelpCapsule />
        </nav>
        <main
          id="content"
          tabIndex={-1}
          className="mb-20 flex min-h-0 min-w-0 flex-col rounded-3xl bg-white shadow-float outline-none md:mb-0 md:overflow-hidden print:mb-0 print:rounded-none print:shadow-none"
        >
          <div key={pathname} className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>
      <PhoneBar areas={areas} />
      <Toaster />
    </>
  );
}
