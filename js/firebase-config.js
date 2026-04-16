// Initialize Firebase (Compat Mode)
const firebaseConfig = {
  apiKey: "AIzaSyC100nV8gNXzl8MFsSql-OKDJlMqlr7aSo",
  authDomain: "email-4e646.firebaseapp.com",
  projectId: "email-4e646",
  storageBucket: "email-4e646.firebasestorage.app",
  messagingSenderId: "244909096018",
  appId: "1:244909096018:web:4c5a8c029279851863338b",
  measurementId: "G-KDR936M87R"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
