import {Resend} from "send";

const resend = new Resend(Deno.env.get("SEND")!);

export default resend;