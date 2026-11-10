import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // 1. Importar el servicio de Storage

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAM96TYBWm-yRxOOwQtYIWq-ZYrPG6vmkA",
  authDomain: "aircraft-damage-mapping.firebaseapp.com",
  projectId: "aircraft-damage-mapping",
  storageBucket: "aircraft-damage-mapping.firebasestorage.app",
  messagingSenderId: "621049222999",
  appId: "1:621049222999:web:67fed0fa1d6229c16c9012",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
const db = getFirestore(app);
const storage = getStorage(app); // 2. Inicializar Storage usando la app

// Exportar base de datos y almacenamiento
export { db, storage };