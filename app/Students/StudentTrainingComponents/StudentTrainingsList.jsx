import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../../configs/FirebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import StudentTrainingsCard from "./StudentTrainingsListCard";
import { useAuthContext } from "../../../components/AuthContext";
import StudentHeaderPage from "../StudentHeaderPage";
import { useTheme } from "../../../components/ThemeContext";

export default function StudentTrainingsList() {
  const { user } = useUser();
  const { isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [trainings, setTrainings] = useState([]);
  const params = useLocalSearchParams();
  const studentData = params.item ? JSON.parse(params.item) : null;
  const { primaryColor } = useTheme();

  useFocusEffect(
    useCallback(() => {
      LoadUserTrainings();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

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

      // Build {trainingId: hebrewDay} lookup from new DB structure { english: { day, trainingId } }
      const dayTrainingMap = userData.trainingProgram?.dayTrainingMap || {};
      const trainingToDayMap = {};
      Object.values(dayTrainingMap).forEach((entry) => {
        if (entry?.trainingId && entry?.day) {
          trainingToDayMap[entry.trainingId] = entry.day;
        }
      });
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <StudentHeaderPage
        title={
          isAdmin && studentData
            ? `${strings.trainingsOf} ${studentData.name}`
            : strings.title
        }
        imgUrl={studentData?.imgUrl || (!isAdmin ? user?.imageUrl : null)}
      />

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
          data={trainings}
          renderItem={({ item, index }) => (
            <StudentTrainingsCard
              item={item}
              index={index}
              studentData={studentData}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const strings = {
  title: "האימונים שלי",
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
    flex: 1,
  },
  activityIndicator: {
    marginTop: 20,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    marginTop: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#404040",
    textAlign: "center",
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  listContainer: {
    paddingHorizontal: wp(4),
    paddingBottom: hp(2),
  },
});
