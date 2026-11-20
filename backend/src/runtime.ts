export const betaEnabled = () =>
  process.env.NODE_ENV === "staging" &&
  process.env.PISTA_BETA_MODE === "true" &&
  process.env.DEV_ADAPTERS === "false";
export function validateRuntime(env: NodeJS.ProcessEnv = process.env) {
  if (
    env.NODE_ENV === "production" &&
    (env.DEV_ADAPTERS === "true" || env.PISTA_BETA_MODE === "true")
  )
    throw new Error("Test adapters are prohibited in production");
  const database = env.DATABASE_URL ? new URL(env.DATABASE_URL).pathname : "";
  if (env.PISTA_BETA_MODE === "true") {
    if (
      env.NODE_ENV !== "staging" ||
      env.DEV_ADAPTERS !== "false" ||
      database !== "/pista_beta" ||
      (env.HOST && env.HOST !== "127.0.0.1")
    )
      throw new Error(
        "Beta requires staging mode, disabled development access, loopback hosting and the isolated pista_beta database",
      );
  } else if (database === "/pista_beta")
    throw new Error("The beta database requires explicit beta mode");
}
