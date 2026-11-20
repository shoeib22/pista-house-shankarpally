import type { components } from "./schema";
export type Product = components["schemas"]["Product"];
export type Order = components["schemas"]["Order"];
export type Status = Order["status"];
export type Rider = components["schemas"]["Rider"];
export type AccountSession = components["schemas"]["AccountSession"];
export type TeamMember = components["schemas"]["TeamMember"];
export type Invitation = components["schemas"]["Invitation"];
export type IssuedInvitation = components["schemas"]["IssuedInvitation"];
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export class Api {
  constructor(
    public token = "",
    public base = "/api",
  ) {}
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(data.message || "Request failed", response.status);
    return data;
  }
}
