// src/lib/authPersistence.ts
//
// Makes the login stay logged in across browser restarts, so the user
// doesn't have to type their email/password every time.
//
// HOW TO USE:
// Wherever you currently call signInWithEmailAndPassword(auth, email, password)
// in your login page/component, replace that call with loginWithRememberMe(...)
// from this file (or just copy the two lines below into your existing
// sign-in handler, right before the sign-in call).

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  type UserCredential,
} from "firebase/auth";
import { auth } from "@/src/firebase"; // adjust path if your firebase.ts is elsewhere

/**
 * Signs the user in and makes the session persist in this browser
 * (localStorage-backed) until they explicitly log out.
 */
export async function loginWithRememberMe(
  email: string,
  password: string
): Promise<UserCredential> {
  // Must be called BEFORE signInWithEmailAndPassword.
  // browserLocalPersistence = survives closing the tab / browser.
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}