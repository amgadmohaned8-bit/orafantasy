import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3vgg8t-1Hg9DDxrUMc0G7iZ14oXXsfnU",
  authDomain: "fantasy-ora.firebaseapp.com",
  projectId: "fantasy-ora",
  storageBucket: "fantasy-ora.firebasestorage.app",
  messagingSenderId: "34430325890",
  appId: "1:34430325890:web:fbf6bc87fcc8f66155509b",
  measurementId: "G-Z6SBPLVTHV",
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);