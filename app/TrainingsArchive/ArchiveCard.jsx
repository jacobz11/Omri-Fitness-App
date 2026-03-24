import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Alert,
  Modal,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { widthPercentageToDP as wp } from "react-native-responsive-screen";
import { Image } from "expo-image";
import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
} from "firebase/firestore";
import Toast from "react-native-toast-message";
import { db } from "../../configs/FirebaseConfig";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeContext";

export default function ArchiveCard({
  training,
  index = 0,
  isSelected = false,
  onToggleSelect,
  isDragging = false,
  dragModeActive = false,
  onDelete,
  refreshKey = 0,
}) {
  const router = useRouter();
  const { primaryColor } = useTheme();
  const [exerciseData, setExerciseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userNames, setUserNames] = useState([]);

  useEffect(() => {
    LoadFirstExercise();
    LoadUserNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const animatedBorderStyle = useAnimatedStyle(() => {
    return {
      borderColor: withTiming(isSelected ? primaryColor : Colors.light.border, {
        duration: 300,
      }),
    };
  });

  const LoadUserNames = async () => {
    const ids =
      training.userIds?.length > 0
        ? training.userIds
        : training.userId
          ? [training.userId]
          : [];
    if (ids.length === 0) return;
    try {
      const names = await Promise.all(
        ids.map(async (uid) => {
          const snap = await getDoc(doc(db, "Users", uid));
          if (!snap.exists()) return null;
          const data = snap.data();
          return data.boarding?.fullName || data.name || null;
        }),
      );
      setUserNames(names.filter(Boolean));
    } catch (e) {
      console.error("Error loading user names:", e);
    }
  };

  const LoadFirstExercise = async () => {
    if (!training.exercises || training.exercises.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const firstExercise = training.exercises[0];
      const { bodyPartId, exerciseIndex } = firstExercise;

      // Get body part data
      const bodyPartRef = doc(db, "BodyParts", bodyPartId);
      const bodyPartSnap = await getDoc(bodyPartRef);

      if (bodyPartSnap.exists()) {
        const bodyPartData = bodyPartSnap.data();
        const exercise = bodyPartData.exercises?.[exerciseIndex];

        if (exercise) {
          setExerciseData({
            ...exercise,
            bodyPartName: bodyPartData.bodyPart,
          });
        }
      }
    } catch (error) {
      console.error("Error loading exercise data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardPress = async () => {
    if (dragModeActive || isDragging) return;

    // Resolve a userId to navigate to (support both array and legacy single field)
    const effectiveUserId =
      training.userIds?.length > 0
        ? training.userIds[0]
        : training.userId || null;

    if (!effectiveUserId) return; // Pure general training — nothing to navigate to

    try {
      const userDocRef = doc(db, "Users", effectiveUserId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        Alert.alert("שגיאה", "לא נמצא משתמש");
        return;
      }

      const userData = userDocSnap.data();
      const userEmail = userData.email;

      if (!userEmail) {
        Alert.alert("שגיאה", "לא נמצא אימייל של המשתמש");
        return;
      }

      router.push({
        pathname: "/Students/StudentTrainingComponents/StudentTrainingShow",
        params: {
          trainingKey: training.id,
          isAdmin: "true",
          source: "archive",
          studentData: JSON.stringify({
            email: userEmail,
            userId: effectiveUserId,
            userName: training.userName,
          }),
        },
      });
    } catch (error) {
      console.error("Error getting user data:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון את פרטי המשתמש");
    }
  };

  const handleDeleteTraining = async () => {
    setShowDeleteModal(true);
  };

  const executeDeleteFromArchiveOnly = async () => {
    setShowDeleteModal(false);
    try {
      // Delete from Trainings collection (archive) only
      await deleteDoc(doc(db, "Trainings", training.id));

      Toast.show({
        type: "success",
        text1: strings.trainingDeletedFromArchive,
        visibilityTime: 2000,
        topOffset: 60,
      });

      if (onDelete) {
        onDelete(training.id);
      }
    } catch (error) {
      console.error("Error deleting training:", error);
      Alert.alert(strings.error, strings.trainingDeletionFailed);
    }
  };

  const executeDeleteFromArchiveAndUser = async () => {
    setShowDeleteModal(false);
    try {
      // Collect all user IDs (support both new array and legacy single field)
      const allUserIds =
        training.userIds?.length > 0
          ? training.userIds
          : training.userId
            ? [training.userId]
            : [];

      // Remove training from every linked user
      await Promise.all(
        allUserIds.map(async (uid) => {
          const userDocRef = doc(db, "Users", uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) return;

          const userData = userDocSnap.data();
          const trainings = userData.trainings || {};

          // Find the training key by archiveId match
          let trainingKey = training.originalTrainingKey;
          if (!trainingKey || !trainings[trainingKey]) {
            trainingKey = Object.keys(trainings).find(
              (k) => trainings[k].archiveId === training.id,
            );
          }

          if (trainingKey && trainings[trainingKey]) {
            const { [trainingKey]: _removed, ...updatedTrainings } = trainings;
            await updateDoc(userDocRef, {
              trainings: updatedTrainings,
              [`graphs.${trainingKey}`]: deleteField(),
            });
          }
        }),
      );

      // Delete from Trainings collection (archive)
      await deleteDoc(doc(db, "Trainings", training.id));

      Toast.show({
        type: "success",
        text1: strings.trainingDeletedFromBoth,
        visibilityTime: 2000,
        topOffset: 60,
      });

      if (onDelete) {
        onDelete(training.id);
      }
    } catch (error) {
      console.error("Error deleting training:", error);
      Alert.alert(strings.error, strings.trainingDeletionFailed);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400)
        .delay(index * 100)
        .springify()
        .damping(50)}
    >
      <Pressable
        onPress={handleCardPress}
        disabled={dragModeActive || isDragging}
      >
        <Animated.View
          style={[
            styles.card,
            animatedBorderStyle,
            isDragging && styles.cardDragging,
          ]}
        >
          <View style={styles.imageContainer}>
            {loading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Image
                source={
                  exerciseData?.youtubeThumbnail
                    ? { uri: exerciseData.youtubeThumbnail }
                    : require("../../assets/images/logo.png")
                }
                style={styles.image}
                contentFit="cover"
              />
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.trainingName} numberOfLines={1}>
              {training.name}
            </Text>
            {userNames.length > 0 && (
              <Text style={styles.userNamesList} numberOfLines={2}>
                {userNames.join(", ")}
              </Text>
            )}
            {exerciseData && (
              <>
                <Text
                  style={[styles.bodyPartName, { color: primaryColor }]}
                  numberOfLines={1}
                >
                  {exerciseData.bodyPartName}
                </Text>
              </>
            )}
            <Text style={styles.exerciseCount}>
              {training.exercises?.length || 0} {strings.exercises}
            </Text>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={dragModeActive ? undefined : onToggleSelect}
              disabled={dragModeActive}
            >
              {dragModeActive ? (
                <AntDesign name="bars" size={24} color={primaryColor} />
              ) : (
                <Ionicons
                  name={isSelected ? "checkbox" : "square-outline"}
                  size={28}
                  color={isSelected ? primaryColor : "#ccc"}
                />
              )}
            </TouchableOpacity>
            {!dragModeActive && (
              <TouchableOpacity
                style={styles.deleteIconContainer}
                onPress={handleDeleteTraining}
              >
                <MaterialIcons name="delete" size={24} color="#d32f2f" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Pressable>

      {/* Delete Training Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{strings.deleteTraining}</Text>
            </View>
            <View style={styles.deleteModalContent}>
              <TouchableOpacity
                style={styles.deleteOption}
                onPress={executeDeleteFromArchiveOnly}
              >
                <MaterialIcons
                  name="delete-sweep"
                  size={24}
                  color="#666"
                  style={styles.deleteOptionIcon}
                />
                <Text style={styles.deleteOptionText}>
                  {strings.deleteFromArchiveOnly}
                </Text>
              </TouchableOpacity>

              {(training.userIds?.length > 0 || training.userId) && (
                <TouchableOpacity
                  style={[styles.deleteOption, styles.deleteOptionDanger]}
                  onPress={executeDeleteFromArchiveAndUser}
                >
                  <MaterialIcons
                    name="delete-forever"
                    size={24}
                    color={Colors.DELETED}
                    style={styles.deleteOptionIcon}
                  />
                  <Text
                    style={[
                      styles.deleteOptionText,
                      styles.deleteOptionTextDanger,
                    ]}
                  >
                    {strings.deleteFromArchiveAndUser}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <AntDesign name="close" size={20} color="#666" />
                <Text style={styles.deleteCancelButtonText}>
                  {strings.cancelRemove}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const strings = {
  exercises: "תרגילים",
  deleteTraining: "מחיקת אימון",
  deleteFromArchiveOnly: "מחק מהמאגר בלבד",
  deleteFromArchiveAndUser: "מחק מהמאגר ומהמתאמן",
  delete: "מחק",
  cancel: "ביטול",
  cancelRemove: "בטל מחיקה",
  success: "הצלחה",
  ok: "אישור",
  error: "שגיאה",
  trainingDeleted: "האימון נמחק בהצלחה",
  trainingDeletedFromArchive: "האימון נמחק מהמאגר בהצלחה",
  trainingDeletedFromBoth: "האימון נמחק מהמאגר ומהמתאמן בהצלחה",
  trainingDeletionFailed: "מחיקת האימון נכשלה. אנא נסה שנית",
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 15,
    marginBottom: 15,
    padding: 12,
    flexDirection: "row",
    borderWidth: 1,
    gap: 10,
    borderColor: Colors.light.border,
  },
  cardDragging: {
    opacity: 0.7,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  imageContainer: {
    width: wp(25),
    height: wp(25),
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  infoContainer: {
    flex: 1,
    height: wp(25),
    justifyContent: "space-between",
  },
  trainingName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    textAlign: "right",
  },
  userNamesList: {
    fontSize: 12,
    fontWeight: "500",
    color: "#888",
    textAlign: "right",
  },
  bodyPartName: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  exerciseCount: {
    fontSize: 13,
    color: "#888",
    fontWeight: "600",
    textAlign: "right",
  },
  actionsContainer: {
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  checkboxContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  deleteIconContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    width: "90%",
    maxHeight: "70%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "center",
    position: "relative",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "600",
  },
  deleteModalContent: {
    paddingVertical: 20,
    paddingHorizontal: 25,
  },
  deleteOption: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 10,
  },
  deleteOptionDanger: {
    borderColor: Colors.DELETED,
    borderWidth: 2,
  },
  deleteOptionIcon: {
    position: "absolute",
    right: 16,
  },
  deleteOptionText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#404040",
  },
  deleteOptionTextDanger: {
    color: Colors.DELETED,
  },
  deleteCancelButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
    gap: 10,
  },
  deleteCancelButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#666",
  },
});
