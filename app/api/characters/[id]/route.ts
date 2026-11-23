import { NextResponse } from "next/server";
import {
  claimIfSeeded,
  deleteCharacter,
  getCharacter,
  updateCharacter,
} from "@/lib/db";
import { getOwner } from "@/lib/owner";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getOwner();
  const { id } = await params;
  const row = await getCharacter(id, owner);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await claimIfSeeded(row, owner);
  return NextResponse.json({ id: row.id, name: row.name, data: row.data });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getOwner();
  const { id } = await params;
  const body = (await req.json()) as { data: Record<string, unknown> };
  if (!body.data) {
    return NextResponse.json({ error: "data required" }, { status: 400 });
  }
  const ok = await updateCharacter(id, owner, body.data);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getOwner();
  const { id } = await params;
  const ok = await deleteCharacter(id, owner);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
