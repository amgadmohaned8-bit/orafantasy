// src/lib/authPersistence.ts
//
// Controls whether a signed-in session survives closing the browser
// (Remember me ON -> localStorage-backed) or ends when the tab/browser
// closes (Remember me OFF -> session-only). Used by both the login and
// the signup flow in app/page.tsx, so either one keeps the user signed
// in on the dashboard until they explicitly log out.

import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  type UserCredential,
} from "firebase/auth";
import { auth } from "@/src/firebase"; // adjust path if your firebase.ts is elsewhere

/**
 * Sets how the NEXT sign-in on this auth instance will persist.
 * Call this before createUserWithEmailAndPassword too (e.g. on signup),
 * not just before signing in an existing user.
 */
export async function setAuthPersistence(remember: boolean): Promise<void> {
  await setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence
  );
}

/**
 * Signs the user in, first setting persistence based on `remember`.
 * remember = true  -> stays signed in across browser restarts (default).
 * remember = false -> signed out automatically when the browser closes.
 */
export async function loginWithRememberMe(
  email: string,
  password: string,
  remember: boolean = true
): Promise<UserCredential> {
  await setAuthPersistence(remember);
  return signInWithEmailAndPassword(auth, email, password);
}