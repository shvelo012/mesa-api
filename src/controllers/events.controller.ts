import { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AuthRequest, getRestaurantForUser } from "../middleware/auth";
import { verifyAccess } from "../lib/jwt";
import { sseBroadcaster } from "../lib/sse";
import { createSseToken, consumeSseToken } from "../lib/sseTokens";

export async function issueToken(req: AuthRequest, res: Response) {
  const token = createSseToken(req.user!.userId);
  res.json({ token });
}

export async function streamEvents(req: AuthRequest, res: Response) {
  let userId: string | null = null;
  const queryToken = req.query.token as string | undefined;

  if (queryToken) {
    userId = consumeSseToken(queryToken);
    if (!userId) {
      res.status(401).json({ error: "Invalid or expired SSE token" });
      return;
    }
  } else {
    const header = req.headers.authorization;
    const jwtToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!jwtToken) {
      res.status(401).json({ error: "No token" });
      return;
    }
    try {
      const payload = verifyAccess(jwtToken);
      userId = payload.userId;
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
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
