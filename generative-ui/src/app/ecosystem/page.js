"use client";

import { MuslimBotEcosystem } from "../../pages/MuslimBotEcosystem";

export default function EcosystemPage() {
  return (
    <MuslimBotEcosystem
      onEnterAdmin={() => {
        window.location.href = "/";
      }}
    />
  );
}
