"use client";

// The cohort graph and your connections in it, for any screen that needs them. Local mode
// works it out from the fixtures as you go; live mode asks the backend whenever your snapshot
// changes.

import { useEffect, useMemo, useState } from "react";
import type { Connection, Graph } from "@/contract/residency";
import { useR } from "@/lib/f/residency";
import * as api from "./api";

const EMPTY = { graph: { nodes: [], edges: [] } as Graph, mine: [] as Connection[] };

export function useCohort(): { graph: Graph; mine: Connection[]; failed: boolean } {
  const snapshot = useR((s) => s.snapshot);
  const mine = useR((s) => s.mine);
  const local = useMemo(() => (api.live ? null : api.localGraph(snapshot, mine)), [snapshot, mine]);
  const [remote, setRemote] = useState<{ v: typeof EMPTY; failed: boolean }>({ v: EMPTY, failed: false });
  useEffect(() => {
    if (!api.live) return;
    let on = true;
    api.graph(snapshot).then(
      (v) => on && setRemote({ v, failed: false }),
      () => on && setRemote((x) => ({ ...x, failed: true })),
    );
    return () => {
      on = false;
    };
  }, [snapshot]);
  return local ? { ...local, failed: false } : { ...remote.v, failed: remote.failed };
}

// The resident on the other end of one of your connections.
export const otherIn = (c: Connection, me: string) => (c.source === `person_${me}` ? c.target : c.source).replace(/^person_/, "");
