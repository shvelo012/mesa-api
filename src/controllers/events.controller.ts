import { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AuthRequest, getRestaurantForUser } from "../middleware/auth";
import { verifyAccess } from "../lib/jwt";
import { sseBroadcaster } from "../lib/sse";

export async function streamEvents(req: AuthRequest, res: Response) {
  // Accept token from Authorization header OR query param (EventSource can't set headers)
  let userId: string | null = null;
  const header = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  const token = header?.startsWith("Bearer ") ? header.slice(7) : queryToken;
  if (!token) {
    res.status(401).json({ error: "No token" });
    return;
  }
  try {
    const payload = verifyAccess(token);
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const restaurant = await getRestaurantForUser(userId);
  if (!restaurant) {
    res.status(404).json({ error: "No restaurant" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const clientId = uuidv4();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sseBroadcaster.add(clientId, restaurant.id, send);

  send("connected", { restaurantId: restaurant.id });

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseBroadcaster.remove(clientId);
  });
}
