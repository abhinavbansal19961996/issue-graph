import { llmsIndex } from "@/lib/discovery";
import { textResponse } from "@/lib/text-response";

export const dynamic = "force-dynamic";

export function GET() {
  return textResponse(llmsIndex(), "/llms.txt", "text/plain; charset=utf-8");
}
