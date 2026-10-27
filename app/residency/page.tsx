"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import Frame from "@/components/f/Frame";
import { f } from "@/lib/f/store";
import { r } from "@/lib/f/residency";

const App = dynamic(() => import("@/components/f/App"), { ssr: false });

// The residency build: you arrive as someone new, so memory starts empty.
// ?reset=1 starts the way in again.
export default function Residency() {
  useEffect(() => {
    f.setDemo("new");
    if (new URLSearchParams(window.location.search).get("reset") === "1") r.reset();
    if (process.env.NODE_ENV !== "production") (window as unknown as { __f: typeof f }).__f = f;
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Frame>
        <App residency />
      </Frame>
    </MotionConfig>
  );
}
