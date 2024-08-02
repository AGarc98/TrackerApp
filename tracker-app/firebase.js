// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore} from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {

    apiKey: "AIzaSyBixqtS61QJWaebQR6bS6RMy6UacsCa6fY",
  
    authDomain: "tracker-app-ba4d1.firebaseapp.com",
  
    projectId: "tracker-app-ba4d1",
  
    storageBucket: "tracker-app-ba4d1.appspot.com",
  
    messagingSenderId: "161870901847",
  
    appId: "1:161870901847:web:d04538c2899a1988f2a912",
  
    measurementId: "G-9S21K2GFHZ"
  
  };
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
const firestore = getFirestore(app);
const db = getFirestore(app);

export { firestore, db }