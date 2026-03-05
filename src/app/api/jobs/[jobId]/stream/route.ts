import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getLogs } from "@/lib/queue";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { jobId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let cursor = 0;
      let done = false;

      while (!done) {
        const entries = await getLogs(jobId, cursor);

        for (const entry of entries) {
          const parsed = JSON.parse(entry);
          if (parsed.type === "done") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            done = true;
            break;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
          cursor++;
        }

        if (!done) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
