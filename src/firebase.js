import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCdkov7c1v_bR5pqwbGNAN8WB1dN99orjM",
  authDomain: "class-tracker-15c2c.firebaseapp.com",
  projectId: "class-tracker-15c2c",
  storageBucket: "class-tracker-15c2c.firebasestorage.app",
  messagingSenderId: "572686826311",
  appId: "1:572686826311:web:1634a14e89f9babc88aa62",
  measurementId: "G-SLV98V3C04"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
