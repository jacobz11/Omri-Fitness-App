import { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-expo";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../configs/FirebaseConfig";
import * as SecureStore from "expo-secure-store";
import { useNetworkStatus } from "../utils/useNetworkStatus";

// Helper function to add timeout to Firebase queries
const withTimeout = (promise, timeoutMs = 2000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs),
    ),
  ]);
};

const AuthContext = createContext();

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Demo user data for Apple reviewers
const DEMO_USER = {
  fullName: "Demo Reviewer",
  primaryEmailAddress: {
    emailAddress: "demo@reviewermode.com",
  },
  imageUrl: "https://via.placeholder.com/150",
  id: "demo_user_id",
  // Add boarding data for demo user
  boarding: {
    fullName: "Demo Reviewer",
    birthday: "1990-01-01",
    gender: "male",
    height: 180,
    weight: 75,
  },
};

export const AuthProvider = ({ children }) => {
  const { user, isLoaded } = useUser();
  const { isConnected } = useNetworkStatus();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoModeChecked, setDemoModeChecked] = useState(false);
  const [demoViewAsAdmin, setDemoViewAsAdmin] = useState(true); // Toggle for demo mode view

  // Check for demo mode on mount
  useEffect(() => {
    const checkDemoMode = async () => {
      try {
        const demoMode = await SecureStore.getItemAsync("isDemoMode");
        setIsDemoMode(demoMode === "true");
      } catch (error) {
        console.error("Error checking demo mode:", error);
      } finally {
        setDemoModeChecked(true);
      }
    };

    checkDemoMode();

    // Listen for demo mode changes with a more frequent interval
    const interval = setInterval(async () => {
      try {
        const demoMode = await SecureStore.getItemAsync("isDemoMode");
        setIsDemoMode(demoMode === "true");
      } catch (error) {
        console.error("Error checking demo mode:", error);
      }
    }, 100); // Check every 100ms for faster response

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkAdminStatus = async () => {
      // In demo mode, use the toggle to determine admin status
      if (isDemoMode) {
        setIsAdmin(demoViewAsAdmin);
        setIsCheckingAdmin(false);
        return;
      }

      if (!isLoaded || !user) {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }

      // Skip admin check if no internet connection
      if (!isConnected) {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }

      try {
        setIsCheckingAdmin(true);
        const q = query(
          collection(db, "Admins"),
          where("email", "==", user.primaryEmailAddress.emailAddress),
        );
        const querySnapshot = await withTimeout(getDocs(q), 2000);

        setIsAdmin(!querySnapshot.empty);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    if (demoModeChecked) {
      checkAdminStatus();
    }
  }, [
    user,
    isLoaded,
    isDemoMode,
    demoModeChecked,
    demoViewAsAdmin,
    isConnected,
  ]);

  const toggleDemoView = () => {
    setDemoViewAsAdmin(!demoViewAsAdmin);
  };

  const effectiveUser = isDemoMode ? DEMO_USER : user;
  const props = {
    isAdmin,
    isCheckingAdmin,
    user: effectiveUser,
    isDemoMode,
    demoViewAsAdmin,
    toggleDemoView,
  };

  return <AuthContext.Provider value={props}>{children}</AuthContext.Provider>;
};
