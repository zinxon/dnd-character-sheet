import { NextResponse } from "next/server";
import { buildCharacter, type BuildInput } from "@/lib/autobuild";

// Features, spells and actions for a class build + race (see lib/autobuild).
export async function POST(req: Request) {
  const body = (await req.json()) as BuildInput;
  if (!Array.isArray(body.classes) || body.classes.length === 0) {
    return NextResponse.json({ error: "classes required" }, { status: 400 });
  }
  return NextResponse.json(buildCharacter(body));
}
