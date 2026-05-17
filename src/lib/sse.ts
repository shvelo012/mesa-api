import { EventEmitter } from "events";

interface SSEClient {
  restaurantId: string;
  send: (event: string, data: unknown) => void;
}

class SSEBroadcaster extends EventEmitter {
  private clients = new Map<string, SSEClient>();

  add(clientId: string, restaurantId: string, send: (event: string, data: unknown) => void) {
    this.clients.set(clientId, { restaurantId, send });
  }

  remove(clientId: string) {
    this.clients.delete(clientId);
  }

  broadcast(restaurantId: string, event: string, data: unknown) {
    for (const [, client] of this.clients) {
      if (client.restaurantId === restaurantId) {
        try {
          client.send(event, data);
        } catch {
          // client disconnected, will be cleaned up on close
        }
      }
    }
  }
}

export const sseBroadcaster = new SSEBroadcaster();
