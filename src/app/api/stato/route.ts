import { NextResponse } from "next/server";
import { aiDisponibile } from "@/lib/ai";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ai: aiDisponibile() });
}
