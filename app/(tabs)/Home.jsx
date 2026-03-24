import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";
import BodyParts from "./../../components/BodyParts";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import TrainingsList from "../Students/StudentTrainingsHome/TrainingsList";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../configs/FirebaseConfig";
import { useAuthContext } from "../../components/AuthContext";
import { useNetworkStatus } from "../../utils/useNetworkStatus";
import { useTheme } from "../../components/ThemeContext";

export default function Home() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const { isAdmin, user, isDemoMode } = useAuthContext();
  const [boardingData, setBoardingData] = useState(null);
  const { isConnected } = useNetworkStatus({ showToast: false });
  const { primaryColor } = useTheme();
  const router = useRouter();

  useEffect(() => {
    fetchBoardingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isConnected]);

  const fetchBoardingData = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;
    if (!isConnected) return;

    try {
      const q = query(
        collection(db, "Users"),
        where("email", "==", user?.primaryEmailAddress?.emailAddress),
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const data = userDoc.data();
        if (data.boarding) {
          setBoardingData(data.boarding);
        }
      }
    } catch (error) {
      console.error("Error fetching boarding data:", error);
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.profile}
          onPress={() => router.push("/(tabs)/Profile")}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            {!imageLoaded && (
              <ActivityIndicator
                size="small"
                color={primaryColor}
                style={styles.loader}
              />
            )}
            <Image
              source={
                isDemoMode
                  ? require("../../assets/images/logo.png")
                  : { uri: user?.imageUrl }
              }
              style={[styles.avatar, !imageLoaded && styles.hidden]}
              onLoadEnd={() => setImageLoaded(true)}
            />
          </View>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>{strings.welcome}</Text>
            <Text style={styles.nameText}>
              {boardingData?.fullName || user?.fullName}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          {!logoLoaded && (
            <ActivityIndicator
              size="small"
              color={primaryColor}
              style={styles.loaderLogo}
            />
          )}
          <Image
            source={require("../../assets/images/logo.png")}
            style={[
              {
                width: "100%",
                height: "100%",
                resizeMode: "cover",
              },
              !logoLoaded && styles.hidden,
            ]}
            onLoadEnd={() => setLogoLoaded(true)}
          />
        </View>
      </View>
      {/* <Test /> */}
      {/* <TestFillExerciseData /> */}
      {/* <TestFillBoarding /> */}
      {/* <TestFillTrainingsArchive /> */}
      {/* <TestDeleteGifsVideos /> */}
      {/* <TestFirebaseOutput /> */}
      {!isAdmin && <TrainingsList />}
      {/* Test Onboarding Button: */}
      {/* <TouchableOpacity
        onPress={() => router.push("/Students/StudentOnboarding")}
        style={{
          padding: 10,
          backgroundColor: "lightgray",
          alignItems: "center",
          margin: 10,
          borderRadius: 5,
        }}
      >
        <Text style={{ fontSize: 16 }}>Test Onboarding</Text>
      </TouchableOpacity> */}
      {/* End Test Onboarding Button */}
      <View style={styles.bodyPartCont}>
        <BodyParts />
      </View>
    </SafeAreaView>
  );
}
const strings = {
  welcome: "שלום לך,",
};
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  container: {
    display: "flex",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    height: hp(8.5),
  },
  logoContainer: {
    width: hp(7.5),
    height: hp(7.5),
    borderRadius: hp(7.5) / 2,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  profile: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  avatarContainer: {
    width: hp(6),
    height: hp(6),
    borderRadius: 99,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    height: hp(6),
    width: hp(6),
    borderRadius: 99,
  },
  hidden: {
    opacity: 0,
  },
  loader: {
    position: "absolute",
  },
  loaderLogo: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -10 }, { translateY: -10 }],
  },
  welcomeContainer: {
    alignItems: "flex-end",
  },
  welcomeText: {
    fontSize: hp(2),
    fontWeight: "500",
  },
  nameText: {
    fontSize: hp(2),
    fontWeight: "700",
    marginRight: 3,
  },
  bodyPartCont: {
    flex: 1,
  },
});
