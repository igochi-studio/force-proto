"use client";

import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import Frame from "@/components/f/Frame";

const GraphStage = dynamic(() => import("@/components/r/GraphStage"), { ssr: false });

// The residency's graph, for the pitch: shown at the end, not part of anyone's flow. In the
// phone, like /residency.
export default function ResidencyGraph() {
  return (
    <MotionConfig reducedMotion="user">
      <Frame>
        <GraphStage />
      </Frame>
    </MotionConfig>
  );
}
