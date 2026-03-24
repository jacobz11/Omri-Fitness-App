import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Colors } from "../../../constants/Colors";
import { useTheme } from "../../../components/ThemeContext";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function StudentTrainingsListCard({ item, index, studentData }) {
  const router = useRouter();
  const [pressedCard, setPressedCard] = useState(null);
  const { primaryColor } = useTheme();

  // Get thumbnail from database
  const firstExercise = item.exercises?.[0];
  const thumbnailUrl = firstExercise?.youtubeThumbnail || null;

  const exerciseNames = item.exercises.map((ex) => ex.name).join(", ");
  const isCompleted = item.completedExercises === item.exerciseCount;
  const completionPercentage =
    (item.completedExercises / item.exerciseCount) * 100;
  const isHighProgress = completionPercentage >= 70;
  const trainingSets = item.trainingSets || 1;
  const trainingRepsCompleted = item.trainingRepsCompleted || 0;
  const completionPercentageSets = (trainingRepsCompleted / trainingSets) * 100;
  const isHighProgressSets = completionPercentageSets >= 70;

  return (
    <Pressable
      onPressIn={() => setPressedCard(item.id)}
      onPressOut={() => setPressedCard(null)}
      onPress={() =>
        router.push({
          pathname: "/Students/StudentTrainingComponents/StudentTrainingShow",
          params: {
            trainingKey: item.id,
            source: "training",
            studentData: studentData ? JSON.stringify(studentData) : null,
            scheduledDay: item.scheduledDay || "",
          },
        })
      }
    >
      <Animated.View
        entering={FadeInDown.delay(index * 200)
          .duration(400)
          .springify()}
        style={[
          styles.trainingCard,
          pressedCard === item.id && { borderColor: primaryColor },
          isCompleted && { borderColor: primaryColor },
          pressedCard === item.id &&
            isCompleted &&
            styles.trainingCardCompletedAnimated,
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardRight}>
            <Text style={styles.trainingName}>{item.name}</Text>
            {item.scheduledDay && (
              <Text style={styles.scheduledDay}>
                {strings.scheduledFor} {item.scheduledDay}
              </Text>
            )}
            <Text
              style={styles.exercisesList}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {exerciseNames}
            </Text>
          </View>
          <View style={styles.cardLeft}>
            {thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.trainingImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Image
                source={require("../../../assets/images/logo.png")}
                style={styles.trainingImage}
                contentFit="contain"
              />
            )}
          </View>
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${completionPercentage}%`,
                    backgroundColor: primaryColor,
                  },
                ]}
              />
            </View>
          </View>
          <Text
            style={[
              styles.progressText,
              isHighProgress && styles.progressTextWhite,
            ]}
          >
            {item.completedExercises}/{item.exerciseCount}{" "}
            {strings.exercisesCompleted}
          </Text>
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  styles.progressBarRepsFill,
                  {
                    width: `${completionPercentageSets}%`,
                  },
                ]}
              />
            </View>
          </View>
          <Text
            style={[
              styles.progressText,
              isHighProgressSets && styles.progressTextWhite,
            ]}
          >
            {trainingRepsCompleted === trainingSets
              ? strings.trainingCompleted
              : `${trainingRepsCompleted}/${trainingSets} ${strings.setsCompleted}`}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const strings = {
  exercises: "תרגילים",
  exercisesCompleted: "תרגילים הושלמו",
  trainingCompleted: "האימון הושלם!",
  setsCompleted: "סטים הושלמו",
  scheduledFor: "אימון יום",
};

const styles = StyleSheet.create({
  trainingCard: {
    backgroundColor: "white",
    borderRadius: 20,
    marginBottom: hp(2),
    padding: wp(4),
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  trainingCardCompleted: {
    borderColor: Colors.PRIMARY, // overridden inline via primaryColor where needed
  },
  trainingCardCompletedAnimated: {
    borderColor: Colors.light.border,
  },
  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  trainingCardPressed: {},
  cardRight: {
    flex: 1,
  },
  cardLeft: {
    width: wp(30),
    height: wp(30),
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  trainingImage: {
    width: "100%",
    height: "100%",
  },
  trainingName: {
    fontSize: hp(2.2),
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: hp(0.5),
    textAlign: "right",
  },
  exercisesList: {
    fontSize: hp(1.6),
    color: "#666",
    lineHeight: hp(2.2),
    textAlign: "right",
  },
  scheduledDay: {
    fontSize: hp(1.6),
    fontWeight: "600",
    color: "#4CAF50",
    marginBottom: hp(0.3),
    textAlign: "right",
  },
  cardBottom: {
    marginTop: hp(1),
  },
  progressBarContainer: {
    position: "relative",
  },
  progressBarBackground: {
    width: "100%",
    height: hp(1.8),
    backgroundColor: "#e0e0e0",
    borderRadius: hp(1),
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: hp(1),
  },
  progressBarRepsFill: {
    backgroundColor: "#4CAF50",
  },
  progressText: {
    fontSize: hp(1.7),
    fontWeight: "700",
    alignSelf: "center",
    position: "absolute",
    lineHeight: hp(1.7),
  },
  progressTextWhite: {
    color: "#fff",
  },
});
