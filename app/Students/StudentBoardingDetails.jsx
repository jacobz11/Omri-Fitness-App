import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../configs/FirebaseConfig";
import { Colors } from "../../constants/Colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import StudentHeaderPage from "./StudentHeaderPage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../components/ThemeContext";

export default function StudentBoardingDetails() {
  const router = useRouter();
  const item = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [boardingData, setBoardingData] = useState(null);
  const { primaryColor } = useTheme();

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (item.id) {
        LoadBoardingData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id]),
  );

  useEffect(() => {
    if (item.id) {
      LoadBoardingData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.back();
        return true;
      },
    );

    return () => backHandler.remove();
  }, [router]);

  const LoadBoardingData = async () => {
    try {
      setLoading(true);
      const userRef = doc(db, "Users", item.id);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.boarding) {
          setBoardingData(userData.boarding);
        }
      }
    } catch (error) {
      console.error("Error loading boarding data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate age from birthday
  const calculateAge = (birthdayString) => {
    if (!birthdayString) return null;

    // Parse DD/MM/YYYY format
    const [day, month, year] = birthdayString.split("/").map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();

    const years = today.getFullYear() - birthDate.getFullYear();
    const months = today.getMonth() - birthDate.getMonth();
    const days = today.getDate() - birthDate.getDate();

    // Calculate precise age
    let ageYears = years;
    let ageMonths = months;

    if (days < 0) {
      ageMonths--;
    }

    if (ageMonths < 0) {
      ageYears--;
      ageMonths += 12;
    }

    // Return whole number if it's exactly on the birth month and day
    if (ageMonths === 0 && days >= 0) {
      return ageYears.toString();
    }

    // Otherwise return decimal (e.g., 28.6)
    const decimalAge = ageYears + ageMonths / 12;
    if (decimalAge < 0) return "0";
    return decimalAge.toFixed(1);
  };

  const age = calculateAge(boardingData?.birthday);

  if (loading) {
    return (
      <SafeAreaView style={styles.mainContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </SafeAreaView>
    );
  }

  if (!boardingData) {
    return (
      <SafeAreaView style={styles.mainContainer}>
        <StudentHeaderPage title={strings.title} imgUrl={item?.imgUrl} />
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>{strings.noData}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleEditDetails = () => {
    router.push({
      pathname: "/Students/StudentOnboarding",
      params: {
        ...item,
        editMode: "true",
        boardingData: JSON.stringify(boardingData),
      },
    });
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StudentHeaderPage
        title={boardingData?.fullName || item?.fullName || item?.name}
        imgUrl={item?.imgUrl}
      />
      <View style={styles.container}>
        <TouchableOpacity style={styles.editButton} onPress={handleEditDetails}>
          <MaterialIcons name="edit" size={22} color={primaryColor} />
          <Text style={styles.editButtonText}>{strings.editDetails}</Text>
        </TouchableOpacity>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {boardingData?.birthday && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <FontAwesome6
                  name="cake-candles"
                  size={20}
                  color={primaryColor}
                />
              </View>
              <Text style={styles.detailLabel}>{strings.birthday}:</Text>
              <Text style={styles.detailValue}>{boardingData.birthday}</Text>
            </View>
          )}
          {age && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="person" size={20} color={primaryColor} />
              </View>
              <Text style={styles.detailLabel}>{strings.age}:</Text>
              <Text style={styles.detailValue}>{age}</Text>
            </View>
          )}
          {boardingData?.gender && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <FontAwesome6
                  name="venus-mars"
                  size={20}
                  color={primaryColor}
                />
              </View>
              <Text style={styles.detailLabel}>{strings.gender}:</Text>
              <Text style={styles.detailValue}>{boardingData.gender}</Text>
            </View>
          )}
          {boardingData?.height && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <FontAwesome6
                  name="ruler-vertical"
                  size={20}
                  color={primaryColor}
                />
              </View>
              <Text style={styles.detailLabel}>{strings.height}:</Text>
              <Text style={styles.detailValue}>
                {boardingData.height} {strings.cm}
              </Text>
            </View>
          )}
          {boardingData?.weight && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <FontAwesome6
                  name="weight-scale"
                  size={20}
                  color={primaryColor}
                />
              </View>
              <Text style={styles.detailLabel}>{strings.weight}:</Text>
              <Text style={styles.detailValue}>
                {boardingData.weight} {strings.kg}
              </Text>
            </View>
          )}
          {boardingData?.workoutGoals && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="flag" size={20} color={primaryColor} />
              </View>
              <Text style={styles.detailLabel}>{strings.workoutGoals}:</Text>
              <Text style={styles.detailValue}>
                {Array.isArray(boardingData.workoutGoals)
                  ? boardingData.workoutGoals.join(", ")
                  : boardingData.workoutGoals}
              </Text>
            </View>
          )}
          {boardingData?.trainingFrequency && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <FontAwesome6
                  name="calendar-days"
                  size={20}
                  color={primaryColor}
                />
              </View>
              <Text style={styles.detailLabel}>
                {strings.trainingFrequency}:
              </Text>
              <Text style={styles.detailValue}>
                {boardingData.trainingFrequency}
              </Text>
            </View>
          )}
          {boardingData?.trainingDays &&
            boardingData.trainingDays.length > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.iconContainer}>
                  <FontAwesome6
                    name="calendar-check"
                    size={20}
                    color={primaryColor}
                  />
                </View>
                <Text style={styles.detailLabel}>{strings.trainingDays}:</Text>
                <Text style={styles.detailValue}>
                  {Array.isArray(boardingData.trainingDays)
                    ? boardingData.trainingDays.join(", ")
                    : boardingData.trainingDays}
                </Text>
              </View>
            )}
          {boardingData?.trainingPlace && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <MaterialIcons
                  name="location-on"
                  size={20}
                  color={primaryColor}
                />
              </View>
              <Text style={styles.detailLabel}>{strings.trainingPlace}:</Text>
              <Text style={styles.detailValue}>
                {boardingData.trainingPlace}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const strings = {
  title: "פרטי מתאמן",
  birthday: "תאריך לידה",
  age: "גיל",
  gender: "מין",
  height: "גובה",
  weight: "משקל",
  workoutGoals: "מטרות אימון",
  trainingFrequency: "תדירות אימון",
  trainingPlace: "מקום אימון",
  trainingDays: "ימי אימון",
  cm: "ס״מ",
  kg: "ק״ג",
  noData: "אין מידע זמין",
  editDetails: "ערוך פרטי מתאמן",
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 10,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noDataText: {
    fontSize: 18,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  detailRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  iconContainer: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#404040",
  },
  detailValue: {
    flex: 1,
    fontSize: 16,
    color: "#606060",
    textAlign: "right",
  },
  editButton: {
    alignSelf: "center",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  editButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
