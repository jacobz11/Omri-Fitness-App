import { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-expo";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../configs/FirebaseConfig";
import { Colors } from "../constants/Colors";
import { useAuthContext } from "./AuthContext";

const ThemeContext = createContext({ primaryColor: Colors.PRIMARY });

export function ThemeProvider({ children }) {
  const [primaryColor, setPrimaryColor] = useState(Colors.PRIMARY);
  const { user, isLoaded } = useUser();
  const { isAdmin, isDemoMode } = useAuthContext();

  useEffect(() => {
    if (!isLoaded || isAdmin || isDemoMode || !user?.id) return;

    const fetchGender = async () => {
      try {
        const userEmail = user.primaryEmailAddress?.emailAddress;
        let gender = null;

        // Try to find user doc by email
        if (userEmail) {
          const q = query(
            collection(db, "Users"),
            where("email", "==", userEmail),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            gender = snap.docs[0].data()?.boarding?.gender;
          }
        }

        // Fallback: try by Clerk user id as doc id
        if (!gender) {
          const docSnap = await getDoc(doc(db, "Users", user.id));
          if (docSnap.exists()) {
            gender = docSnap.data()?.boarding?.gender;
          }
        }

        setPrimaryColor(
          gender === "נקבה" ? Colors.PRIMARY_FEMALE : Colors.PRIMARY,
        );
      } catch (error) {
        console.error("Error fetching gender for theme:", error);
      }
    };

    fetchGender();
  }, [isLoaded, user?.id, isAdmin, isDemoMode, user?.primaryEmailAddress?.emailAddress]);

  // Call this immediately after saving gender (e.g. in StudentOnboarding)
  // so the color updates without waiting for a re-fetch
  const setGender = (gender) => {
    setPrimaryColor(gender === "נקבה" ? Colors.PRIMARY_FEMALE : Colors.PRIMARY);
  };

  return (
    <ThemeContext.Provider value={{ primaryColor, setGender }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
