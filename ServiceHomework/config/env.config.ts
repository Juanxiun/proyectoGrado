import { load } from "@std/dotenv";

await load({
  envPath: new URL("../.env", import.meta.url).pathname,
  export: true,
});
