import { ClerkProvider, SignedIn, SignedOut, useUser } from "@clerk/clerk-expo";
import LoginScreen from "./LoginScreen";
import * as SecureStore from "expo-secure-store";
import {
  I18nManager,
  ActivityIndicator,
  View,
  Image,
  Text,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { AuthProvider, useAuthContext } from "../components/AuthContext";
import { useEffect, useState } from "react";
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
import Toast from "react-native-toast-message";
import Entypo from "@expo/vector-icons/Entypo";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";
import { useNetworkStatus } from "../utils/useNetworkStatus";
import { runWeeklyResetIfNeeded } from "../utils/weeklyReset";
import { ThemeProvider, useTheme } from "../components/ThemeContext";

const tokenCache = {
  async getToken(key) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (_err) {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (_err) {
      return;
    }
  },
};

// Helper function to add timeout to Firebase queries
const withTimeout = (promise, timeoutMs = 3000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs),
    ),
  ]);
};

function AppContent() {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [checkingBoarding, setCheckingBoarding] = useState(true);
  const { user, isLoaded } = useUser();
  const { isAdmin, isCheckingAdmin } = useAuthContext();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();
  const { primaryColor } = useTheme();

  // Check if user has boarding data
  useEffect(() => {
    const checkBoardingData = async () => {
      try {
        // Wait for loading states to complete
        if (!isLoaded || isCheckingAdmin) {
          setCheckingBoarding(true);
          return;
        }

        // Admin users don't need boarding data
        if (isAdmin) {
          setCheckingBoarding(false);
          return;
        }

        if (!user?.id) {
          setCheckingBoarding(false);
          return;
        }

        // If no internet connection, skip boarding check and show login
        if (!isConnected) {
          setCheckingBoarding(false);
          return;
        }

        const userEmail = user.primaryEmailAddress?.emailAddress;
        const userId = user.id;

        if (!userEmail && !userId) {
          setCheckingBoarding(false);
          return;
        }

        // Find the user document by email or id with timeout
        let querySnapshot;
        if (userEmail) {
          const q = query(
            collection(db, "Users"),
            where("email", "==", userEmail),
          );
          try {
            querySnapshot = await withTimeout(getDocs(q), 2000);
          } catch (_timeoutError) {
            console.log("Query timeout, stopping check");
            setCheckingBoarding(false);
            return;
          }
        }

        // If not found by email, try by clerk user id field
        if (!querySnapshot || querySnapshot.empty) {
          const q = query(
            collection(db, "Users"),
            where("clerkUserId", "==", userId),
          );
          try {
            querySnapshot = await withTimeout(getDocs(q), 2000);
          } catch (_timeoutError) {
            console.log("Query timeout, stopping check");
            setCheckingBoarding(false);
            return;
          }
        }

        // If still not found, try loading the doc directly by clerk user id (doc id)
        let userDoc;
        if (!querySnapshot || querySnapshot.empty) {
          const directRef = doc(db, "Users", userId);
          try {
            const directSnap = await withTimeout(getDoc(directRef), 2000);
            if (directSnap.exists()) {
              userDoc = directSnap;
            }
          } catch (_timeoutError) {
            console.log("Direct doc fetch timeout, stopping check");
            setCheckingBoarding(false);
            return;
          }
        } else {
          userDoc = querySnapshot.docs[0];
        }

        if (userDoc) {
          const userData = userDoc.data();
          const hasBoarding =
            userData.boarding && Object.keys(userData.boarding).length > 0;

          // If no boarding data, redirect to onboarding
          if (!hasBoarding) {
            setTimeout(() => {
              router.replace("/Students/StudentOnboarding");
            }, 100);
          }
        } else {
          setTimeout(() => {
            router.replace("/Students/StudentOnboarding");
          }, 100);
        }

        setCheckingBoarding(false);
      } catch (error) {
        console.error("Error checking boarding data:", error);
        // Always stop the spinner even if there's an error
        setCheckingBoarding(false);
      }
    };

    checkBoardingData();
  }, [isLoaded, user, isAdmin, isCheckingAdmin, isConnected, router]);

  // Run weekly Saturday-noon reset for the logged-in student
  useEffect(() => {
    if (!user?.id || isAdmin || !isConnected) return;
    runWeeklyResetIfNeeded(user.id);
  }, [user?.id, isAdmin, isConnected]);

  useEffect(() => {
    const checkDemoMode = async () => {
      try {
        const demoMode = await SecureStore.getItemAsync("isDemoMode");
        setIsDemoMode(demoMode === "true");
      } catch (error) {
        console.error("Error checking demo mode:", error);
      }
    };

    checkDemoMode();

    // Listen for demo mode changes
    const interval = setInterval(async () => {
      const demoMode = await SecureStore.getItemAsync("isDemoMode");
      setIsDemoMode(demoMode === "true");
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Show loading while checking boarding data
  if (checkingBoarding && !isDemoMode) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (isDemoMode) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    );
  }

  return (
    <>
      <SignedIn>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SignedIn>
      <SignedOut>
        <LoginScreen />
      </SignedOut>
    </>
  );
}

export default function Layout() {
  if (I18nManager.isRTL) {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  }

  const toastConfig = {
    success: ({ text1, text2 }) => (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          borderRadius: 50,
          paddingVertical: 8,
          paddingHorizontal: 14,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
          gap: 8,
          alignSelf: "center",
        }}
      >
        <Image
          source={require("../assets/images/logo.png")}
          style={{ width: 28, height: 28, borderRadius: 14 }}
        />
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: hp(1.7),
              fontWeight: "600",
              color: "#10b981",
              textAlign: "center",
            }}
          >
            {text1}
          </Text>
          {text2 && (
            <Text
              style={{
                fontSize: hp(1.4),
                color: "#666",
                textAlign: "center",
                marginTop: 2,
              }}
            >
              {text2}
            </Text>
          )}
        </View>
      </View>
    ),
    error: ({ text1, text2 }) => (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          borderRadius: 50,
          paddingVertical: 8,
          paddingHorizontal: 14,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
          gap: 8,
          alignSelf: "center",
        }}
      >
        <Image
          source={require("../assets/images/logo.png")}
          style={{ width: 28, height: 28, borderRadius: 14 }}
        />
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: hp(1.7),
              fontWeight: "600",
              color: "#ef4444",
              textAlign: "center",
            }}
          >
            {text1}
          </Text>
          {text2 && (
            <Text
              style={{
                fontSize: hp(1.4),
                color: "#666",
                textAlign: "center",
                marginTop: 2,
              }}
            >
              {text2}
            </Text>
          )}
        </View>
      </View>
    ),
    errorWithIcon: ({ text1, text2 }) => (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          borderRadius: 50,
          paddingVertical: 8,
          paddingHorizontal: 14,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
          gap: 8,
          alignSelf: "center",
        }}
      >
        <Image
          source={require("../assets/images/logo.png")}
          style={{ width: 28, height: 28, borderRadius: 14 }}
        />
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontSize: hp(1.7),
              fontWeight: "600",
              color: "#ef4444",
              textAlign: "center",
            }}
          >
            {text1}
          </Text>
          {text2 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <Entypo name="info" size={14} color={Colors.PRIMARY} />
              <Text
                style={{
                  fontSize: hp(1.4),
                  color: "#666",
                  textAlign: "center",
                }}
              >
                {text2}
              </Text>
            </View>
          )}
        </View>
      </View>
    ),
  };

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <AuthProvider>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </AuthProvider>
      </ClerkProvider>
      <Toast config={toastConfig} />
    </>
  );
}
