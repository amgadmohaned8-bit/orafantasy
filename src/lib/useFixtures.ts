"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchFixtures,
  getErrorMessage,
  type FixturesData,
} from "./fixtures";

const EMPTY: FixturesData = {
  matches: [],
  season: "2026/2027",
  leagueName: "Egyptian Premier League",
};

export function useFixtures(refreshMs = 60_000) {
  const [data, setData] = useState<FixturesData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await fetchFixtures(signal);

      if (signal?.aborted) {
        return;
      }

      setData(next);
      setError("");
    } catch (err) {
      if (signal?.aborted) {
        return;
      }

      console.error("Fixtures error:", err);
      setError(getErrorMessage(err));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    const interval = window.setInterval(() => {
      void load(controller.signal);
    }, refreshMs);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load, refreshMs]);

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { ...data, loading, error, reload };
}
