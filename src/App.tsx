import { useState } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";

// Smoke test only: proves React 19 + Vercel UI SDK (Tabs, Select) build and
// run together. The real sheet is built in stages on top of this scaffold.
export default function App() {
  const [character, setCharacter] = useState<string | null>("james");
  return (
    <main>
      <h1>D&D character sheet — React version</h1>
      <Select value={character} onValueChange={(value) => setCharacter(value)}>
        <SelectLabel>Character</SelectLabel>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="james">James</SelectItem>
          <SelectItem value="tempest">Tempest Lightning Mage (Lv 8 Build)</SelectItem>
        </SelectContent>
      </Select>
      <p>Selected: {character}</p>
      <Tabs defaultValue="core">
        <TabsList aria-label="Character sheet sections">
          <TabsTab value="core">Core</TabsTab>
          <TabsTab value="spells">Spells</TabsTab>
        </TabsList>
        <TabsPanel value="core">Core panel</TabsPanel>
        <TabsPanel value="spells">Spells panel</TabsPanel>
      </Tabs>
    </main>
  );
}
