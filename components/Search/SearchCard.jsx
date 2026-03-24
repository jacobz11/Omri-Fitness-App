import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { useState } from "react";
import { useTheme } from "../ThemeContext";

export default function SearchCard({ exercise, fullWidth = false }) {
  const router = useRouter();
  const pressProgress = useSharedValue(0);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const { primaryColor } = useTheme();

  const animatedBorderStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      pressProgress.value,
      [0, 1],
      [Colors.light.border, primaryColor],
    );
    return {
      borderColor: color,
    };
  });
  const handleSearchCardPress = () => {
    router.push({
      pathname: "/ExerciseDetails",
      params: {
        ...exercise,
        bodyPartId: exercise.bodyPartId,
        exerciseName: exercise.name,
      },
    });
  };

  return (
    <Animated.View
      style={[
        styles.shadowCard,
        fullWidth && styles.shadowCardFull,
        animatedBorderStyle,
      ]}
    >
      <Pressable
        style={styles.card}
        onPress={handleSearchCardPress}
        onPressIn={() =>
          (pressProgress.value = withTiming(1, { duration: 120 }))
        }
        onPressOut={() =>
          (pressProgress.value = withTiming(0, { duration: 120 }))
        }
      >
        <View style={styles.videoContainer}>
          {isImageLoading && (
            <ActivityIndicator
              size="small"
              color={primaryColor}
              style={styles.videoLoader}
            />
          )}
          <Image
            source={
              exercise.youtubeThumbnail
                ? { uri: exercise.youtubeThumbnail }
                : require("../../assets/images/logo.png")
            }
            style={styles.video}
            contentFit="cover"
            onLoadEnd={() => setIsImageLoading(false)}
          />
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={[styles.bodyPartName, { color: primaryColor }]}>
            {exercise.bodyPartName}
          </Text>
          {exercise.description && (
            <Text
              style={styles.description}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {exercise.description}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowCard: {
    borderRadius: 12,
    marginVertical: 6,
    marginHorizontal: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  shadowCardFull: {
    marginHorizontal: 0,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    padding: 12,
  },
  videoContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  video: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  videoLoader: {
    position: "absolute",
    zIndex: 1,
  },
  gif: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  infoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 2,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textAlign: "right",
    maxWidth: 200,
  },
  bodyPartName: {
    fontSize: 13,
    color: Colors.PRIMARY,
    fontWeight: "700",
    textAlign: "right",
  },
  description: {
    fontSize: 13,
    color: "#888",
    textAlign: "right",
    maxWidth: 200,
  },
});
