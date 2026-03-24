import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Colors } from "../../../constants/Colors";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function StudentTrainingBodyPartCard({
  item,
  index,
  onCardPress,
}) {
  // Get first 3 exercises
  const exercises = item.exercises?.slice(0, 3) || [];
  const exerciseNames = exercises.map((ex) => ex.name || ex.exerciseName || "");

  return (
    <Animated.View
      entering={FadeInDown.duration(400)
        .delay(index * 200)
        .springify()
        .damping(50)}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onCardPress}
        activeOpacity={0.7}
      >
        {/* Image on the left */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item?.imgUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        </View>

        {/* Content on the right */}
        <View style={styles.contentContainer}>
          {/* Body Part Name */}
          <Text style={styles.bodyPartName} numberOfLines={1}>
            {item?.bodyPart || "Body Part"}
          </Text>

          {/* Exercises in 2 rows with comma separation */}
          <View style={styles.exercisesContainer}>
            {exerciseNames.length > 0 ? (
              <Text
                style={styles.exerciseText}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {exerciseNames.join(", ")}
              </Text>
            ) : (
              <Text style={[styles.exerciseText, { color: Colors.GRAY }]}>
                {strings.noExercises}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const strings = {
  noExercises: "אין תרגילים",
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: hp(1),
    padding: wp(3),
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  imageContainer: {
    width: wp(20),
    height: wp(20),
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#ccc",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  bodyPartName: {
    fontSize: wp(4.5),
    fontWeight: "700",
    marginBottom: hp(0.8),
    textAlign: "right",
  },
  exercisesContainer: {
    gap: hp(0.3),
  },
  exerciseText: {
    fontSize: wp(3.5),
    lineHeight: wp(5),
    textAlign: "right",
  },
});
