import { subscribe } from "../../../lib/hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          controller.enqueue(encoder.encode("data: update\n\n"));
        } catch {
          close();
        }
      };
      const close = () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
      };
      send();
      unsubscribe = subscribe(send);
      heartbeat = setInterval(send, 15_000);
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
