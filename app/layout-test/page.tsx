import SheetClient from "@/components/sheet/SheetClient";
import seed from "@/scripts/seed-tempest.json";
import type { CharData } from "@/lib/sheet";
export default function T() {
  return <SheetClient id="00000000-0000-0000-0000-000000000000" initialData={seed as CharData} spellDetails={{}} />;
}
