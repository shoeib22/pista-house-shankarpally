import { Inject, OnModuleDestroy } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { Socket, Server } from "socket.io";
import { Tracking } from "./tracking";

@WebSocketGateway({
  path: "/api/tracking/socket.io",
  transports: ["websocket"],
  maxHttpBufferSize: 8192,
  connectTimeout: 10000,
})
export class TrackingGateway
  implements OnGatewayConnection, OnModuleDestroy, OnGatewayInit
{
  constructor(@Inject(Tracking) private tracking: Tracking) {}
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private clients = new Map<string, Set<string>>();
  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const origin = socket.handshake.headers.origin;
        if (origin && origin !== process.env.DASHBOARD_ORIGIN)
          throw new Error();
        const actor = await this.tracking.authenticate(
          socket.handshake.auth?.token,
        );
        if (!["customer", "rider", "owner", "counter"].includes(actor.role))
          throw new Error();
        next();
      } catch {
        next(new Error("Tracking authentication failed"));
      }
    });
  }
  async handleConnection(socket: Socket) {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && origin !== process.env.DASHBOARD_ORIGIN)
        throw new Error("Origin not allowed");
      const user = await this.tracking.authenticate(
        socket.handshake.auth?.token,
      );
      if (!socket.connected) return;
      const clients = this.clients.get(user.id) ?? new Set<string>();
      if (clients.size >= 8) throw new Error("Too many tracking connections");
      clients.add(socket.id);
      this.clients.set(user.id, clients);
      let window = Date.now(),
        messages = 0;
      socket.use((_packet, next) => {
        if (Date.now() - window > 1000) {
          window = Date.now();
          messages = 0;
        }
        if (++messages > 5) {
          socket.disconnect(true);
          return;
        }
        next();
      });
      let inFlight = false;
      const timer = setInterval(async () => {
        if (inFlight) return;
        inFlight = true;
        try {
          const actor = await this.tracking.authenticate(
            socket.handshake.auth?.token,
          );
          if (socket.data.orderId) {
            const data = await this.tracking.snapshot(
              actor,
              socket.data.orderId,
              socket.data.lease,
            );
            if (socket.connected) socket.emit("tracking:snapshot", data);
          }
        } catch {
          socket.emit("tracking:ended", { reason: "Tracking access ended" });
          socket.disconnect(true);
        } finally {
          inFlight = false;
        }
      }, 2000);
      timer.unref();
      this.timers.set(socket.id, timer);
      socket.on("disconnect", (reason) => {
        clearInterval(timer);
        this.timers.delete(socket.id);
        clients.delete(socket.id);
        if (!clients.size) this.clients.delete(user.id);
        if (
          socket.data.publisher &&
          [
            "client namespace disconnect",
            "server namespace disconnect",
          ].includes(reason)
        ) {
          void this.tracking
            .stop(user, socket.data.publisher.id, socket.data.publisher.lease)
            .catch(() => {});
        }
      });
    } catch {
      socket.emit("tracking:ended", { reason: "Sign in again" });
      socket.disconnect(true);
    }
  }
  @SubscribeMessage("tracking:watch") async watch(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    try {
      const id = (body as any)?.orderId;
      if (typeof id !== "string" || id.length > 100) throw new Error();
      const actor = await this.tracking.authenticate(
        socket.handshake.auth?.token,
      );
      const lease = (body as any)?.lease;
      if (
        lease !== undefined &&
        (typeof lease !== "string" || lease.length > 100)
      )
        throw new Error();
      const snapshot = await this.tracking.snapshot(actor, id, lease);
      socket.data.orderId = id;
      socket.data.lease = lease;
      socket.emit("tracking:snapshot", snapshot);
      return { ok: true };
    } catch {
      return { ok: false, message: "Order unavailable" };
    }
  }
  @SubscribeMessage("tracking:position") async position(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ) {
    try {
      return await this.tracking.publish(
        await this.tracking.authenticate(socket.handshake.auth?.token),
        body,
      );
    } catch {
      return {
        ok: false,
        message:
          "Location not accepted. Check the active delivery and GPS accuracy.",
      };
    }
  }
  @SubscribeMessage("tracking:start") async begin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: any,
  ) {
    try {
      const actor = await this.tracking.authenticate(
        socket.handshake.auth?.token,
      );
      const result = await this.tracking.begin(actor, body?.assignmentId);
      socket.data.publisher = { id: body.assignmentId, lease: result.lease };
      return result;
    } catch {
      return { ok: false, message: "No active delivery to share" };
    }
  }
  @SubscribeMessage("tracking:stop") async stop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: any,
  ) {
    try {
      if (typeof body?.assignmentId !== "string") throw new Error();
      return await this.tracking.stop(
        await this.tracking.authenticate(socket.handshake.auth?.token),
        body.assignmentId,
        body.lease,
      );
    } catch {
      return { ok: false };
    }
  }
  onModuleDestroy() {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
    this.clients.clear();
  }
}
