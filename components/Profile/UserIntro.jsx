import { View, Text, Image, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../configs/FirebaseConfig";
import { Colors } from "../../constants/Colors";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthContext } from "../AuthContext";

export default function UserIntro({ user }) {
  const { isAdmin, isDemoMode } = useAuthContext();
  const [boarding, setBoarding] = useState(null);

  useEffect(() => {
    // In demo mode, don't fetch from database
    if (isDemoMode) {
      setBoarding(null);
      return;
    }
    fetchBoardingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemoMode]);

  const fetchBoardingData = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;

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
          setBoarding(data.boarding);
        }
      }
    } catch (error) {
      console.error("Error fetching boarding data:", error);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify().damping(50)}
      style={styles.container}
    >
      <Image
        source={
          isDemoMode
            ? require("../../assets/images/logo.png")
            : { uri: user?.imageUrl }
        }
        style={styles.imgProf}
      />
      {isAdmin ? (
        <View>
          <View style={styles.usrNmeWithAdmin}>
            <Text style={styles.usrNme}>
              {boarding?.fullName || user?.fullName}
            </Text>
            <Text style={styles.usrNmeAdmn}>{"(" + strings.admin + ")"}</Text>
          </View>
          <Text style={styles.usrEmail}>
            {user?.primaryEmailAddress?.emailAddress}
          </Text>
        </View>
      ) : (
        <View style={styles.contNoAdmin}>
          <Text style={styles.usrNme}>
            {boarding?.fullName || user?.fullName}
          </Text>
          <Text style={styles.usrEmail}>
            {user?.primaryEmailAddress?.emailAddress}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const strings = {
  admin: "מנהל",
};
const styles = StyleSheet.create({
  imgProf: {
    width: 100,
    height: 100,
    borderRadius: 99,
  },
  container: {
    display: "flex",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 30,
    backgroundColor: Colors.light.background,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: "60%",
    maxWidth: "90%",
  },

  usrNme: {
    fontSize: 20,
    fontWeight: "700",
  },

  usrEmail: {
    fontSize: 16,
  },
  usrNmeAdmn: {
    fontSize: 18,
  },
  usrNmeWithAdmin: {
    display: "flex",
    flexDirection: "row-reverse",
    justifyContent: "center",
  },

  contNoAdmin: {
    alignItems: "center",
  },
});
