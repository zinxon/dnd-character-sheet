import { NextResponse } from "next/server";
import { createCharacter, getCharacter, listCharacters } from "@/lib/db";
import { getOwner } from "@/lib/owner";
import { blankCharacter, parseClasses, totalLevel } from "@/lib/sheet";

export async function GET() {
  const owner = await getOwner();
  const rows = await listCharacters(owner);
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      classLevel: String(r.data.classlevel ?? ""),
      classes: parseClasses(r.data),
      level: totalLevel(r.data),
      hpcur: r.data.hpcur ?? "",
      hpmax: r.data.hpmax ?? "",
      updatedAt: r.updated_at,
    })),
  );
}

export async function POST(req: Request) {
  const owner = await getOwner();
  const body = (await req.json()) as {
    name?: string;
    data?: Record<string, unknown>;
    duplicateFrom?: string;
  };

  if (body.duplicateFrom) {
    const src = await getCharacter(body.duplicateFrom, owner);
    if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });
    const copy = { ...src.data, charname: `${src.name} (copy)` };
    const row = await createCharacter(owner, `${src.name} (copy)`, copy);
    return NextResponse.json({ id: row.id }, { status: 201 });
  }

  if (body.data) {
    const name = String(body.data.charname ?? body.name ?? "Unnamed");
    const row = await createCharacter(owner, name, body.data);
    return NextResponse.json({ id: row.id }, { status: 201 });
  }

  const name = body.name?.trim() || "Unnamed";
  const row = await createCharacter(owner, name, blankCharacter(name));
  return NextResponse.json({ id: row.id }, { status: 201 });
}
