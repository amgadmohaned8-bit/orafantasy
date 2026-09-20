"use client";

import AppShell, { displayFont } from "../../src/components/AppShell";
import { StateMessage } from "../../src/components/MatchCard";

export default function LeaguesPage() {
  return (
    <AppShell title="Leagues" subtitle="Compete with friends">
      <div className="mx-auto max-w-[760px]">
        <h1
          className="text-[28px] font-semibold leading-none lg:hidden"
          style={displayFont}
        >
          Leagues
        </h1>

        <section className="mt-4 overflow-hidden rounded-2xl border border-ora-gold/20 bg-ora-card lg:mt-0">
          <div className="ora-nile-band" aria-hidden="true" />

          <div className="px-5 py-8">
            <StateMessage
              title="You haven't joined a league yet"
              text="Private leagues are coming soon. You will be able to create one, share its code with friends and see everyone's points here."
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
