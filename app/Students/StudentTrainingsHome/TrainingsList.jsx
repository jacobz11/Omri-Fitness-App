import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../../configs/FirebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import TrainingCard from "./TrainingCard";
import AntDesign from "@expo/vector-icons/AntDesign";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useAuthContext } from "../../../components/AuthContext";
import { useTheme } from "../../../components/ThemeContext";

export default function TrainingsList() {
  const { user } = useUser();
  const { isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [trainings, setTrainings] = useState([]);
  const [showTrainings, setShowTrainings] = useState(true);
  const params = useLocalSearchParams();
  const studentData = params.item ? JSON.parse(params.item) : null;
  const { primaryColor } = useTheme();

  useFocusEffect(
    useCallback(() => {
      LoadUserTrainings();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const iconRotation = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: withTiming(showTrainings ? "0deg" : "90deg", {
            duration: 200,
          }),
        },
      ],
    };
  });

  const LoadUserTrainings = async () => {
    setLoading(true);
    try {
      // Get user data - use student email if admin is viewing, otherwise use logged in user
      const targetEmail =
        isAdmin && studentData
          ? studentData.email
          : user?.primaryEmailAddress?.emailAddress;

      if (!targetEmail) {
        setLoading(false);
        return;
      }

      const q = query(collection(db, "Users"));
      const querySnapshot = await getDocs(q);
      let userData = null;

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data.email === targetEmail) {
          userData = { id: docSnapshot.id, ...data };
        }
      });

      if (!userData || !userData.trainings) {
        setLoading(false);
        return;
      }

      // Load training program to get day mapping
      const dayTrainingMap = userData.trainingProgram?.dayTrainingMap || {};
      // Build {trainingId: hebrewDay} lookup from new structure { english: { day, trainingId } }
      const trainingToDayMap = {};
      Object.values(dayTrainingMap).forEach((entry) => {
        if (entry?.trainingId && entry?.day) {
          trainingToDayMap[entry.trainingId] = entry.day;
        }
      });

      // Get all body parts data
      const bodyPartsQuery = query(collection(db, "BodyParts"));
      const bodyPartsSnapshot = await getDocs(bodyPartsQuery);
      const bodyParts = {};
      bodyPartsSnapshot.forEach((doc) => {
        bodyParts[doc.id] = { id: doc.id, ...doc.data() };
      });

      // Process trainings
      const trainingsArray = [];
      const sortedKeys = Object.keys(userData.trainings)
        .filter((key) => key.startsWith("training"))
        .sort((a, b) => {
          const numA = parseInt(a.replace("training", ""));
          const numB = parseInt(b.replace("training", ""));
          return numA - numB;
        });

      sortedKeys.forEach((trainingKey) => {
        const trainingData = userData.trainings[trainingKey];
        const exercises = [];

        trainingData.exercises.forEach((item, index) => {
          const { bodyPartId, exerciseIndex } = item;
          const bodyPart = bodyParts[bodyPartId];

          if (
            bodyPart &&
            bodyPart.exercises &&
            bodyPart.exercises[exerciseIndex]
          ) {
            const exercise = bodyPart.exercises[exerciseIndex];
            exercises.push({
              name: exercise.name,
              youtubeUrls: exercise.youtubeUrls,
              firstYoutubeUrl: exercise.firstYoutubeUrl,
              youtubeThumbnail: exercise.youtubeThumbnail,
            });
          }
        });

        trainingsArray.push({
          id: trainingKey,
          name: trainingData.name,
          exerciseCount: exercises.length,
          exercises: exercises,
          completedExercises: trainingData.completedExercises || 0,
          trainingSets: trainingData.trainingSets || 1,
          trainingRepsCompleted: trainingData.trainingRepsCompleted || 0,
          scheduledDay: trainingToDayMap[trainingKey] || null,
        });
      });

      setTrainings(trainingsArray);
    } catch (error) {
      console.error("Error loading trainings:", error);
      Alert.alert(strings.error, strings.loadError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.titleContainer}
          onPress={() => setShowTrainings(!showTrainings)}
        >
          <Animated.View style={iconRotation}>
            <AntDesign name="caret-down" size={20} color="#1a1a1a" />
          </Animated.View>
          <Text style={styles.headerText}>{strings.title}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            router.push(
              "/Students/StudentTrainingComponents/StudentTrainingsList",
            )
          }
        >
          <Text style={[styles.showAll, { color: primaryColor }]}>
            {strings.showAll}
          </Text>
        </TouchableOpacity>
      </View>
      {showTrainings && (
        <>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : trainings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{strings.noTrainings}</Text>
              <Text style={styles.emptySubText}>{strings.noTrainingsDesc}</Text>
            </View>
          ) : (
            <FlatList
              data={trainings} // .slice(0,3) - Show only first 3 trainings
              renderItem={({ item, index }) => (
                <TrainingCard
                  item={item}
                  index={index}
                  studentData={studentData}
                />
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
            />
          )}
        </>
      )}
    </View>
  );
}

const strings = {
  title: "האימונים שלי",
  showAll: "הצג הכל",
  trainingsOf: "אימונים של",
  training: "אימון ",
  exercises: "תרגילים",
  error: "שגיאה",
  loadError: "שגיאה בטעינת האימונים",
  noTrainings: "אין אימונים זמינים",
  noTrainingsDesc: "צור קשר עם המאמן",
};

const styles = StyleSheet.create({
  container: {
    marginBottom: hp(2),
  },
  activityIndicator: {
    marginTop: 20,
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 10,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  headerText: {
    fontSize: 23,
    fontWeight: "700",
    textAlign: "right",
    marginBlock: hp(1),
  },
  showAll: {
    fontSize: hp(1.8),
    color: Colors.PRIMARY,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    marginTop: hp(2),
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: wp(10),
    paddingVertical: hp(2),
  },
  emptyText: {
    fontSize: hp(2),
    fontWeight: "600",
    color: "#404040",
    textAlign: "center",
    marginBottom: hp(1),
  },
  emptySubText: {
    fontSize: hp(1.8),
    color: "#999",
    textAlign: "center",
  },
  listContainer: {
    paddingHorizontal: wp(2),
    gap: hp(1.5),
  },
});
