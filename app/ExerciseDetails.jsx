import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EditExerciseDetails from "./EditExerciseDetails";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { StatusBar } from "expo-status-bar";
import YoutubeIframe from "react-native-youtube-iframe";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Colors } from "../constants/Colors";
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../configs/FirebaseConfig";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useAuthContext } from "../components/AuthContext";
import { useTheme } from "../components/ThemeContext";

const getYoutubeVideoId = (url) => {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

function PaginationDot({ index, isActive }) {
  const { primaryColor } = useTheme();
  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(isActive ? 24 : 8, {
        damping: 100,
        stiffness: 700,
      }),
      backgroundColor: isActive ? primaryColor : Colors.GRAY + "99",
    };
  });

  return (
    <Animated.View
      entering={FadeIn.delay(index * 100).duration(300)}
      style={[styles.dot, animatedStyle]}
    />
  );
}

function YoutubeVideoItem({ youtubeUrl }) {
  const [isLoading, setIsLoading] = useState(true);
  const { primaryColor } = useTheme();
  const videoId = getYoutubeVideoId(youtubeUrl);
  const videoHeight = (wp(100) * 9) / 16; // 16:9 aspect ratio

  return (
    <View style={[styles.media, { width: wp(100), height: videoHeight }]}>
      {videoId ? (
        <>
          <YoutubeIframe
            videoId={videoId}
            height={videoHeight}
            width={wp(100)}
            onReady={() => setIsLoading(false)}
          />
          {isLoading && (
            <View style={styles.videoLoadingOverlay}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ color: "#fff", marginTop: 10 }}>
                {strings.loadingVideo}
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.videoLoadingOverlay}>
          <Text style={{ color: "#fff" }}>Invalid YouTube URL</Text>
        </View>
      )}
    </View>
  );
}

export default function ExerciseDetails({ item: propItem, training, onClose }) {
  const params = useLocalSearchParams();
  const item = propItem || params;
  const router = useRouter();
  const { isAdmin, isDemoMode, demoViewAsAdmin, toggleDemoView } =
    useAuthContext();
  const { primaryColor } = useTheme();
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentGifIndex, setCurrentGifIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [playing] = useState(false);
  const [isSingleVideoLoading, setIsSingleVideoLoading] = useState(true);

  // Real-time exercise data
  const [currentExercise, setCurrentExercise] = useState({
    name: item?.name || "",
    category: item?.category || "",
    difficulty: item?.difficulty || "",
    equipment: item?.equipment || "",
    secondaryMuscles: item?.secondaryMuscles || "",
    target: item?.target || "",
    description: item?.description || "",
    instructions: item?.instructions || "",
    firstYoutubeUrl: item?.firstYoutubeUrl || "",
    youtubeUrls: (() => {
      if (!item?.youtubeUrls) return [];
      if (Array.isArray(item.youtubeUrls)) return item.youtubeUrls;
      try {
        return JSON.parse(item.youtubeUrls);
      } catch {
        return [];
      }
    })(),
  });

  // Reset loading state when video URL changes
  useEffect(() => {
    setIsSingleVideoLoading(true);
  }, [currentExercise.firstYoutubeUrl]);

  // Real-time listener for exercise updates
  useEffect(() => {
    const bodyPartId = item.bodyPartId;
    const exerciseName = item.exerciseName || item.name;

    if (!bodyPartId || !exerciseName) {
      return;
    }

    const bodyPartRef = doc(db, "BodyParts", bodyPartId);
    let unsubscribe;

    // Set up real-time listener with improved error handling
    try {
      unsubscribe = onSnapshot(
        bodyPartRef,
        {
          // Add snapshot options to handle connection issues
          includeMetadataChanges: false,
        },
        (docSnap) => {
          if (docSnap.exists()) {
            const bodyPartData = docSnap.data();
            const exercises = bodyPartData.exercises || [];
            // Find exercise by name instead of index
            const updatedExercise = exercises.find(
              (ex) => ex.name === exerciseName,
            );

            if (updatedExercise) {
              // Update current exercise data
              setCurrentExercise({
                name: updatedExercise.name || "",
                category: updatedExercise.category || "",
                difficulty: updatedExercise.difficulty || "",
                equipment: updatedExercise.equipment || "",
                secondaryMuscles: updatedExercise.secondaryMuscles || "",
                target: updatedExercise.target || "",
                description: updatedExercise.description || "",
                instructions: updatedExercise.instructions || "",
                firstYoutubeUrl: updatedExercise.firstYoutubeUrl || "",
                youtubeUrls: updatedExercise.youtubeUrls || [],
              });
            }
          }
        },
        (error) => {
          // Silently handle transient network errors - the listener will auto-reconnect
          if (
            error.code !== "unavailable" &&
            error.code !== "failed-precondition"
          ) {
            console.error("Error listening to exercise updates: ", error);
          }
        },
      );
    } catch (error) {
      console.error("Failed to set up listener:", error);
    }

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [item.bodyPartId, item.exerciseName, item.name]);

  const handleEditPress = () => {
    setShowEditModal(true);
  };

  const handleDeleteExercise = async () => {
    Alert.alert(strings.deleteExercise, strings.deleteExerciseConfirm, [
      {
        text: strings.cancel,
        style: "cancel",
      },
      {
        text: strings.delete,
        style: "destructive",
        onPress: async () => {
          try {
            setIsSaving(true);

            const bodyPartId = item.bodyPartId;
            const exerciseName = item.exerciseName || item.name;

            // Get the body part document
            const bodyPartRef = doc(db, "BodyParts", bodyPartId);
            const bodyPartSnap = await getDoc(bodyPartRef);

            if (bodyPartSnap.exists()) {
              const bodyPartData = bodyPartSnap.data();
              const exercises = bodyPartData.exercises || [];

              // Filter out the exercise to delete by name
              const updatedExercises = exercises.filter(
                (ex) => ex.name !== exerciseName,
              );

              // Update Firestore - remove exercise from body part
              await updateDoc(bodyPartRef, {
                exercises: updatedExercises,
              });

              // Remove exercise from all users' trainings
              const usersRef = collection(db, "Users");
              const usersSnap = await getDocs(usersRef);

              for (const userDoc of usersSnap.docs) {
                const userData = userDoc.data();
                const trainings = userData.trainings || {};
                let trainingsUpdated = false;

                // Process each training
                Object.keys(trainings).forEach((trainingKey) => {
                  const training = trainings[trainingKey];
                  const exercises = training.exercises || [];

                  // Filter out the deleted exercise by name
                  const updatedTrainingExercises = exercises.filter((ex) => {
                    // Remove if it matches the deleted exercise
                    return !(
                      ex.bodyPartId === bodyPartId && ex.name === exerciseName
                    );
                  });

                  // Only update if exercises changed
                  if (updatedTrainingExercises.length !== exercises.length) {
                    trainings[trainingKey] = {
                      ...training,
                      exercises: updatedTrainingExercises,
                    };
                    trainingsUpdated = true;
                  }
                });

                // Update user document if trainings were modified
                if (trainingsUpdated) {
                  const userDocRef = doc(db, "Users", userDoc.id);
                  await updateDoc(userDocRef, {
                    trainings: trainings,
                  });
                }
              }

              Alert.alert(strings.success, strings.exerciseDeleted, [
                {
                  text: strings.ok,
                  onPress: () => {
                    if (onClose) {
                      onClose();
                    } else {
                      router.back();
                    }
                  },
                },
              ]);
            }
          } catch (error) {
            console.error("Error deleting exercise:", error);
            Alert.alert(strings.error, strings.deleteExerciseError);
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const fields = [
    {
      label: strings.category,
      currentValue: currentExercise.category,
    },
    {
      label: strings.difficulty,
      currentValue: currentExercise.difficulty,
    },
    {
      label: strings.equipment,
      currentValue: currentExercise.equipment,
    },
    {
      label: strings.secondaryMuscles,
      currentValue: currentExercise.secondaryMuscles,
    },
    {
      label: strings.target,
      currentValue: currentExercise.target,
    },
    {
      label: strings.describe,
      currentValue: currentExercise.description,
    },
  ];

  const videoHeight = (wp(100) * 9) / 16; // 16:9 aspect ratio

  const content = (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="dark" />
      <View style={[styles.mediaContainer, { height: videoHeight }]}>
        {currentExercise.youtubeUrls &&
        currentExercise.youtubeUrls.length > 0 ? (
          <>
            <FlatList
              data={currentExercise.youtubeUrls}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => index.toString()}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / wp(100),
                );
                setCurrentGifIndex(index);
              }}
              renderItem={({ item: youtubeUrl }) => (
                <YoutubeVideoItem youtubeUrl={youtubeUrl} />
              )}
            />
            {currentExercise.youtubeUrls.length > 1 && (
              <View style={styles.paginationDots}>
                {currentExercise.youtubeUrls.map((_, index) => (
                  <PaginationDot
                    key={index}
                    index={index}
                    isActive={index === currentGifIndex}
                  />
                ))}
              </View>
            )}
          </>
        ) : currentExercise.firstYoutubeUrl ? (
          <View style={[styles.media, { height: videoHeight }]}>
            <YoutubeIframe
              videoId={getYoutubeVideoId(currentExercise.firstYoutubeUrl)}
              height={videoHeight}
              width={wp(100)}
              play={playing}
              onReady={() => setIsSingleVideoLoading(false)}
            />
            {isSingleVideoLoading && (
              <View style={styles.videoLoadingOverlay}>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={{ color: "#fff", marginTop: 10 }}>
                  Loading video...
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.media,
              { justifyContent: "center", alignItems: "center" },
            ]}
          >
            <Text style={{ color: "#999", fontSize: hp(2) }}>
              No video available
            </Text>
          </View>
        )}
        {!training && (
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: primaryColor }]}
            onPress={() => router.back()}
          >
            <AntDesign name="caret-left" size={24} color="black" />
          </TouchableOpacity>
        )}
        {training && onClose && (
          <TouchableOpacity style={styles.closeButtonOverlay} onPress={onClose}>
            <AntDesign name="close" size={22} color="black" />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        style={[styles.container, styles.detailsContainer]}
        contentContainerStyle={styles.scrollview}
        showsVerticalScrollIndicator={false}
      >
        {isAdmin && (
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteExercise}
            >
              <AntDesign name="delete" size={27} color="#d32f2f" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEditPress}>
              <AntDesign name="edit" size={27} color={primaryColor} />
            </TouchableOpacity>
          </View>
        )}

        {/* Demo Mode Toggle */}
        {isDemoMode && (
          <View style={styles.demoToggleContainer}>
            <Text style={styles.demoToggleLabel}>{strings.demoViewLabel}</Text>
            <View style={styles.toggleButtons}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  demoViewAsAdmin && styles.toggleButtonActive,
                  demoViewAsAdmin && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}
                onPress={() => !demoViewAsAdmin && toggleDemoView()}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    demoViewAsAdmin && styles.toggleButtonTextActive,
                  ]}
                >
                  {strings.adminView}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  !demoViewAsAdmin && styles.toggleButtonActive,
                  !demoViewAsAdmin && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}
                onPress={() => demoViewAsAdmin && toggleDemoView()}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    !demoViewAsAdmin && styles.toggleButtonTextActive,
                  ]}
                >
                  {strings.userView}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Title/Name Field */}
        <Animated.Text
          entering={FadeInDown.delay(400).duration(500).springify()}
          style={styles.title}
        >
          {currentExercise.name}
        </Animated.Text>
        {/* Dynamic Fields for difficulty, equipment, secondary muscles, target, and description */}
        {fields.map((field, index) => (
          <Animated.View
            entering={FadeInDown.delay(550 + index * 150)
              .duration(500)
              .springify()}
            key={index}
          >
            <Text style={styles.describeText}>
              <Text style={styles.subTitleText}>{field.label}</Text>
              {field.currentValue}
            </Text>
          </Animated.View>
        ))}

        {/* Instructions Field */}
        <Animated.Text
          entering={FadeInDown.delay(1300).duration(500).springify()}
          style={[styles.subTitleText, styles.titleInst]}
        >
          {strings.instructions}
        </Animated.Text>
        {currentExercise.instructions
          ?.split(/(?<=\.)\s+/)
          .map((instruction, index) => {
            return (
              <Animated.Text
                entering={FadeInDown.delay(1450 + index * 150)
                  .duration(500)
                  .springify()}
                key={index}
                style={styles.textInstructions}
              >
                {index + 1 + ". " + instruction}
              </Animated.Text>
            );
          })}
      </ScrollView>

      {isSaving && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={styles.loadingText}>{strings.saving}</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  // Wrap in SafeAreaView for all devices
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      {content}

      {/* Edit Exercise Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowEditModal(false)}
      >
        <EditExerciseDetails
          exercise={currentExercise}
          bodyPartId={item.bodyPartId}
          exerciseName={item.exerciseName || item.name}
          onSave={() => setShowEditModal(false)}
          onCancel={() => setShowEditModal(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const strings = {
  category: "קטגוריה: ",
  equipment: "ציוד: ",
  secondaryMuscles: "שרירים משניים: ",
  target: "שריר ראשי: ",
  describe: "תיאור: ",
  instructions: "הוראות ביצוע: ",
  difficulty: "רמת קושי: ",
  error: "שגיאה",
  ok: "אישור",
  cancel: "ביטול",
  delete: "מחק",
  saving: "שומר שינויים...",
  deleteExercise: "מחיקת תרגיל",
  deleteExerciseConfirm:
    "האם אתה בטוח שברצונך למחוק את התרגיל? פעולה זו תמחק את כל הנתונים והסרטונים של התרגיל.",
  success: "הצלחה",
  exerciseDeleted: "התרגיל נמחק בהצלחה",
  deleteExerciseError: "מחיקת התרגיל נכשלה. אנא נסה שנית",
  demoViewLabel: "Demo View:",
  adminView: "Admin",
  userView: "User",
  loadingVideo: "הסרטון בטעינה...",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollview: {
    paddingBottom: 30,
  },
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  deleteButton: {
    padding: 4,
  },
  mediaContainer: {
    width: "100%",
    position: "relative",
  },
  backButton: {
    padding: 7,
    backgroundColor: Colors.PRIMARY,
    width: hp(5.5),
    height: hp(5.5),
    justifyContent: "center",
    alignItems: "center",
    top: hp(6),
    left: 10,
    borderRadius: 99,
    position: "absolute",
    display: "flex",
    zIndex: 10,
    opacity: 0.8,
  },
  closeButtonOverlay: {
    position: "absolute",
    right: 10,
    top: hp(7),
    backgroundColor: Colors.PRIMARY,
    borderRadius: 50,
    padding: 6,
    zIndex: 10,
    opacity: 0.8,
  },
  media: {
    width: "100%",
    backgroundColor: "#fff",
  },
  detailsContainer: {
    padding: 15,
  },
  title: {
    textAlign: "right",
    fontSize: hp(3.2),
    fontWeight: "700",
    color: "#404040",
    marginBottom: 12,
  },
  subTitleText: {
    textAlign: "right",
    fontSize: hp(2.5),
    fontWeight: "600",
    color: "#404040",
    marginBottom: 8,
  },
  describeText: {
    fontSize: hp(2.5),
    fontWeight: "400",
  },
  titleInst: {
    marginTop: 8,
    marginBottom: 0,
  },
  textInstructions: {
    fontSize: hp(2.3),
    color: "#404040",
    textAlign: "right",
    marginBottom: 2,
  },
  paginationDots: {
    position: "absolute",
    bottom: 15,
    flexDirection: "row",
    alignSelf: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    gap: 15,
  },
  loadingText: {
    fontSize: hp(2.2),
    fontWeight: "600",
    color: "#404040",
  },
  videoLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  demoToggleContainer: {
    alignItems: "center",
    marginBottom: 15,
    paddingVertical: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  demoToggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0369a1",
    marginBottom: 8,
  },
  toggleButtons: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  toggleButtonActive: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
});
