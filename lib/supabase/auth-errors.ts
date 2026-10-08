import type { AuthError } from "@supabase/supabase-js"

export function authErrorMessage(error: AuthError, action: "sign-in" | "sign-up" | "verify" | "resend") {
  if (error.status === 429 || error.code?.includes("rate_limit")) {
    return "Too many attempts. Please wait a minute before trying again."
  }
  if (error.code === "email_address_not_authorized") {
    return "Email delivery is not configured for this address. Please contact the campus administrator."
  }
  if (error.code === "weak_password") {
    return "Choose a stronger password that meets the project’s password requirements."
  }
  if (error.code === "email_not_confirmed") {
    return "Verify your college email before signing in."
  }
  if (action === "verify" && (error.code === "otp_expired" || error.status === 403)) {
    return "This code is invalid or has expired. Try again or request a new code."
  }
  if (error.code === "invalid_credentials" || error.code === "user_not_found") {
    return "Invalid email or password."
  }
  if (action === "sign-up" && (error.code === "user_already_exists" || error.code === "email_exists")) {
    return "Unable to create an account with these details. Try signing in instead."
  }
  return action === "verify"
    ? "Unable to verify your email. Please try again."
    : action === "resend"
      ? "Unable to send a new code. Please try again later."
      : "Unable to complete authentication. Please try again later."
}
