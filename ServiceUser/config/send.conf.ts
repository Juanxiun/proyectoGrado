import "./env.config.ts";
import { Resend } from "resend";

const apiKey = Deno.env.get("SEND") || "re_mock_placeholder_key";
export const resend = new Resend(apiKey);
export const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "AcademyShalom@test.shalom";