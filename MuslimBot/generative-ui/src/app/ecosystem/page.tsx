"use client";

import { MuslimBotEcosystem } from "../../components/MuslimBotEcosystem";

export default function EcosystemPage() {
  return (
    <MuslimBotEcosystem
      onEnterAdmin={() => {
        window.location.href = "/";
      }}
    />
  );
}
