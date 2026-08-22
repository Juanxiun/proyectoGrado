import { loadSync } from "@std/dotenv";

let envPath = new URL("../../.env", import.meta.url).pathname;
if (Deno.build.os === "windows" && envPath.startsWith("/")) {
  envPath = envPath.substring(1);
}

loadSync({
  envPath,
  export: true,
});
