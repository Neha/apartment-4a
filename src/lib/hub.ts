type Listener = () => void;

const globalHub = globalThis as unknown as { agentRoomHub?: Set<Listener> };

function listeners(): Set<Listener> {
  if (!globalHub.agentRoomHub) globalHub.agentRoomHub = new Set();
  return globalHub.agentRoomHub;
}

export function publish(): void {
  for (const listener of listeners()) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners().add(listener);
  return () => listeners().delete(listener);
}
