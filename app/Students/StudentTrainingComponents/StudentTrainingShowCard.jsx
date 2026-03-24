import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { widthPercentageToDP as wp } from "react-native-responsive-screen";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useState, useEffect } from "react";
import Toast from "react-native-toast-message";
import { useAuthContext } from "../../../components/AuthContext";
import { useTheme } from "../../../components/ThemeContext";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../configs/FirebaseConfig";

export default function StudentTrainingShowCard({
  item,
  index,
  completedExercises,
  exerciseRemarks,
  trainerRemarks,
  toggleExerciseCompletion,
  saveExerciseRemark,
  saveTrainerRemark,
  openExerciseDetails,
  isInSet = false,
  isDisabled = false,
  exerciseRepsDone = {},
  saveExerciseRepsDone = () => {},
  willCompleteSet = false,
  startRestTimer = () => {},
  stopRestTimer = () => {},
  userId = null,
  trainingKey = null,
  archiveDocId = null,
  onExerciseDataUpdate = null,
}) {
  const { isAdmin } = useAuthContext();
  const { primaryColor } = useTheme();
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [remarkModalVisible, setRemarkModalVisible] = useState(false);
  const [remarkInput, setRemarkInput] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editSets, setEditSets] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [displaySets, setDisplaySets] = useState(item.numOfSets ?? "");
  const [displayWeight, setDisplayWeight] = useState(item.weight ?? "");
  const [displayReps, setDisplayReps] = useState(item.numOfReps ?? "");
  const isCompleted = completedExercises[item.id] === true;
  const userRemark = exerciseRemarks[item.id] || "";
  const trainerRemark = trainerRemarks[item.id] || "";

  const numReps = Math.max(parseInt(displayReps) || 1, 1);
  const numSets = Math.max(parseInt(displaySets) || 1, 1);
  const savedCount = isCompleted ? numSets : exerciseRepsDone[item.id] || 0;
  const [repsDone, setRepsDone] = useState(savedCount);
  const [showFilledCheck, setShowFilledCheck] = useState(isCompleted);
  const repsProgress = useSharedValue((savedCount / numSets) * 100);
  const checkmarkScale = useSharedValue(1);
  const isFullyCompleted = repsDone >= numSets;

  useEffect(() => {
    if (isCompleted && repsDone < numSets) {
      setRepsDone(numSets);
      repsProgress.value = withTiming(100, { duration: 400 });
      setShowFilledCheck(true);
    } else if (!isCompleted && repsDone >= numSets) {
      // Exercise was reset externally
      setRepsDone(0);
      repsProgress.value = withTiming(0, { duration: 400 });
      setShowFilledCheck(false);
    }
  }, [isCompleted, repsDone, numSets, repsProgress]);

  const externalRepsDone = exerciseRepsDone[item.id] || 0;
  useEffect(() => {
    if (!isCompleted && externalRepsDone === 0 && repsDone > 0) {
      setRepsDone(0);
      repsProgress.value = withTiming(0, { duration: 400 });
      setShowFilledCheck(false);
    }
  }, [externalRepsDone, isCompleted, repsDone, repsProgress]);

  const handleCheckPress = () => {
    if (isAdmin) {
      Toast.show({
        type: "error",
        text1: strings.adminCannotCheck,
        position: "top",
        visibilityTime: 1800,
      });
      return;
    }
    // In-set exercises: count up to numSets, then mark complete
    if (isInSet) {
      if (isDisabled || isFullyCompleted) return;
      const newCount = repsDone + 1;
      setRepsDone(newCount);
      repsProgress.value = withTiming((newCount / numSets) * 100, {
        duration: 400,
      });
      saveExerciseRepsDone(item.id, newCount);
      if (newCount >= numSets) {
        toggleExerciseCompletion(item.id);
        if (willCompleteSet) startRestTimer();
      } else {
        stopRestTimer();
      }
      return;
    }

    if (isFullyCompleted || isDisabled) return;

    const newCount = repsDone + 1;
    setRepsDone(newCount);
    repsProgress.value = withTiming((newCount / numSets) * 100, {
      duration: 400,
    });

    // Persist rep count
    saveExerciseRepsDone(item.id, newCount);

    // Reset and start the rest timer on every tap
    startRestTimer();

    // Toast: rep done + remaining / all done
    if (newCount < numSets) {
      const remaining = numSets - newCount;
      Toast.show({
        type: "success",
        text1: strings.repCompleted,
        text2: `${remaining} ${strings.repsRemaining}`,
        position: "top",
        visibilityTime: 1500,
      });
    } else {
      Toast.show({
        type: "success",
        text1: strings.allRepsCompleted,
        position: "top",
        visibilityTime: 1500,
      });
    }

    // Flash the checkmark: filled for 500ms then back to outline
    setShowFilledCheck(true);
    checkmarkScale.value = withSequence(
      withTiming(1.3, { duration: 150 }),
      withTiming(1.0, { duration: 150 }),
    );
    if (newCount < numSets) {
      setTimeout(() => setShowFilledCheck(false), 500);
    }

    if (newCount >= numSets && !isCompleted) {
      toggleExerciseCompletion(item.id);
    }
  };

  const repsProgressStyle = useAnimatedStyle(() => ({
    width: `${repsProgress.value}%`,
  }));

  const checkmarkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: withTiming(
        isCompleted ? primaryColor : Colors.light.border,
        { duration: 300 },
      ),
    };
  }, [isCompleted]);

  const handleRemarkPress = () => {
    if (isAdmin) {
      setRemarkInput(trainerRemark);
    } else {
      setRemarkInput(userRemark);
    }
    setRemarkModalVisible(true);
  };

  const handleSaveRemark = () => {
    if (isAdmin) {
      saveTrainerRemark(item.id, remarkInput);
    } else {
      saveExerciseRemark(item.id, remarkInput);
    }
    setRemarkModalVisible(false);
  };

  const handleDeleteRemark = () => {
    if (isAdmin) {
      saveTrainerRemark(item.id, "");
    } else {
      saveExerciseRemark(item.id, "");
    }
    setRemarkInput("");
    setRemarkModalVisible(false);
  };

  const handleCancelRemark = () => {
    setRemarkModalVisible(false);
  };

  const handleEditPress = () => {
    setEditSets(String(displaySets || ""));
    setEditWeight(String(displayWeight || ""));
    setEditReps(String(displayReps || ""));
    setEditModalVisible(true);
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
  };

  const handleSaveEdit = async () => {
    await saveExerciseData(editSets, editWeight, editReps);
    setEditModalVisible(false);
  };

  const saveExerciseData = async (numOfSets, weight, numOfReps) => {
    if (!userId || !trainingKey || editSaving) return;
    try {
      setEditSaving(true);
      const userRef = doc(db, "Users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const training = userData.trainings?.[trainingKey];
        if (training && training.exercises) {
          const updatedExercises = training.exercises.map((ex) => {
            if (
              ex.bodyPartId === item.bodyPartId &&
              ex.exerciseIndex === item.exerciseIndex
            ) {
              const updatedEx = { ...ex };
              if (numOfSets && numOfSets.trim()) {
                updatedEx.numOfSets = parseInt(numOfSets);
              } else {
                delete updatedEx.numOfSets;
              }
              if (weight && weight.trim()) {
                updatedEx.weight = parseInt(weight);
              } else {
                delete updatedEx.weight;
              }
              if (numOfReps && numOfReps.trim()) {
                updatedEx.numOfReps = parseInt(numOfReps);
              } else {
                delete updatedEx.numOfReps;
              }
              return updatedEx;
            }
            return ex;
          });
          await updateDoc(userRef, {
            [`trainings.${trainingKey}.exercises`]: updatedExercises,
          });
          // Track exercise change in graphs
          const today = new Date();
          const dateLabel = parseFloat(
            `${today.getDate()}.${today.getMonth() + 1}`,
          );
          const exerciseId = `${item.bodyPartId}-${item.exerciseIndex}`;
          const graphSets =
            numOfSets && numOfSets.trim() ? parseInt(numOfSets) : 0;
          const graphWeight = weight && weight.trim() ? parseInt(weight) : 0;
          const graphReps =
            numOfReps && numOfReps.trim() ? parseInt(numOfReps) : 0;
          if (graphSets > 0 || graphWeight > 0 || graphReps > 0) {
            const existingEntry = userData.graphs?.[trainingKey]?.[exerciseId];
            let graphUpdate;
            if (existingEntry) {
              const lastIdx = existingEntry.dates.length - 1;
              const lastSets = existingEntry.sets[lastIdx] ?? 0;
              const lastWeight = existingEntry.weights[lastIdx] ?? 0;
              const lastReps = existingEntry.reps[lastIdx] ?? 0;
              const hasChanged =
                graphSets !== lastSets ||
                graphWeight !== lastWeight ||
                graphReps !== lastReps;
              if (hasChanged) {
                graphUpdate = {
                  dates: [...existingEntry.dates, dateLabel],
                  weights: [...existingEntry.weights, graphWeight],
                  sets: [...existingEntry.sets, graphSets],
                  reps: [...existingEntry.reps, graphReps],
                };
              }
            } else {
              graphUpdate = {
                dates: [dateLabel],
                weights: [graphWeight],
                sets: [graphSets],
                reps: [graphReps],
              };
            }
            if (graphUpdate) {
              await updateDoc(userRef, {
                [`graphs.${trainingKey}.${exerciseId}`]: graphUpdate,
              });
            }
          }
        }
      }
      // Sync to archive (Trainings collection)
      const buildUpdatedArchiveExercises = (exercises) =>
        exercises.map((ex) => {
          if (
            ex.bodyPartId === item.bodyPartId &&
            ex.exerciseIndex === item.exerciseIndex
          ) {
            const updatedEx = { ...ex };
            if (numOfSets && numOfSets.trim()) {
              updatedEx.numOfSets = parseInt(numOfSets);
            } else {
              delete updatedEx.numOfSets;
            }
            if (weight && weight.trim()) {
              updatedEx.weight = parseInt(weight);
            } else {
              delete updatedEx.weight;
            }
            if (numOfReps && numOfReps.trim()) {
              updatedEx.numOfReps = parseInt(numOfReps);
            } else {
              delete updatedEx.numOfReps;
            }
            return updatedEx;
          }
          return ex;
        });

      if (archiveDocId) {
        // Viewing from archive — update the archive doc directly by its ID
        const archiveRef = doc(db, "Trainings", archiveDocId);
        const archiveSnap = await getDoc(archiveRef);
        if (archiveSnap.exists() && archiveSnap.data().exercises) {
          await updateDoc(archiveRef, {
            exercises: buildUpdatedArchiveExercises(
              archiveSnap.data().exercises,
            ),
          });
        }
      } else {
        // Viewing from student training — find archive doc via single-field query
        // (single-field index, no composite index required)
        const snap = await getDocs(
          query(
            collection(db, "Trainings"),
            where("originalTrainingKey", "==", trainingKey),
          ),
        );
        const trainingDoc = snap.docs.find((d) => {
          const data = d.data();
          return data.userIds?.includes(userId) || data.userId === userId;
        });
        if (trainingDoc && trainingDoc.data().exercises) {
          await updateDoc(doc(db, "Trainings", trainingDoc.id), {
            exercises: buildUpdatedArchiveExercises(
              trainingDoc.data().exercises,
            ),
          });
        }
      }
      // Update local display state
      const finalSets =
        numOfSets && numOfSets.trim() ? parseInt(numOfSets) : "";
      const finalWeight = weight && weight.trim() ? parseInt(weight) : "";
      const finalReps =
        numOfReps && numOfReps.trim() ? parseInt(numOfReps) : "";
      setDisplaySets(finalSets);
      setDisplayWeight(finalWeight);
      setDisplayReps(finalReps);
      if (onExerciseDataUpdate) {
        onExerciseDataUpdate(
          finalSets !== "" ? finalSets : null,
          finalWeight !== "" ? finalWeight : null,
          finalReps !== "" ? finalReps : null,
        );
      }
    } catch (error) {
      console.error("Error saving exercise data:", error);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400)
        .delay(index * 200)
        .springify()
        .damping(50)}
    >
      <Animated.View
        style={[
          styles.exerciseCard,
          animatedStyle,
          isInSet && styles.exerciseCardInSet,
          (isDisabled || (!isInSet && isFullyCompleted)) &&
            !isAdmin &&
            styles.exerciseCardDisabled,
        ]}
      >
        <View style={styles.videoContainer}>
          {isImageLoading && (
            <ActivityIndicator
              size="small"
              color={primaryColor}
              style={styles.imageLoader}
            />
          )}
          <TouchableOpacity
            onPress={() => openExerciseDetails(item)}
            style={styles.imageContainer}
            activeOpacity={0.7}
          >
            <Image
              source={
                item.youtubeThumbnail
                  ? { uri: item.youtubeThumbnail }
                  : require("../../../assets/images/logo.png")
              }
              style={[styles.exerciseImage]}
              contentFit="cover"
              onLoadEnd={() => setIsImageLoading(false)}
            />
          </TouchableOpacity>
        </View>

        <Pressable
          style={styles.exerciseInfo}
          onPress={handleCheckPress}
          disabled={isAdmin || (!isInSet && isFullyCompleted) || isDisabled}
        >
          <Text style={styles.exerciseName}>{item.name}</Text>
          <Text style={styles.exerciseDetails}>
            {numReps} {strings.setsLabel} | {displayWeight || 0}{" "}
            {strings.weightLabel}
          </Text>
          <View style={styles.setsProgressContainer}>
            <View style={styles.setsProgressBackground}>
              <Animated.View
                style={[
                  styles.setsProgressFill,
                  { backgroundColor: primaryColor },
                  repsProgressStyle,
                ]}
              />
            </View>
            <Text style={[styles.setsProgressText, { color: primaryColor }]}>
              {repsDone}/{displaySets || 0}
            </Text>
          </View>
          <View style={styles.bodyPartRow}>
            <Text style={[styles.bodyPartName, { color: primaryColor }]}>
              {item.bodyPartName}
            </Text>
            <TouchableOpacity
              style={styles.remarkButton}
              onPress={handleRemarkPress}
            >
              <Ionicons
                name={
                  isAdmin
                    ? trainerRemark
                      ? "chatbubble"
                      : "chatbubble-outline"
                    : userRemark
                      ? "chatbubble"
                      : "chatbubble-outline"
                }
                size={16}
                color={
                  isAdmin
                    ? trainerRemark
                      ? Colors.SECONDARY
                      : "#999"
                    : userRemark
                      ? primaryColor
                      : "#999"
                }
              />
              <Text style={styles.remarkButtonText}>
                {isAdmin
                  ? trainerRemark
                    ? strings.editTrainerRemark
                    : strings.addTrainerRemark
                  : userRemark
                    ? strings.editMyRemark
                    : strings.addMyRemark}
              </Text>
            </TouchableOpacity>
          </View>
          {userId && trainingKey && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditPress}
            >
              <Ionicons name="create-outline" size={16} color={"#999"} />
              <Text style={styles.editButtonText}>{strings.editData}</Text>
            </TouchableOpacity>
          )}
          {userRemark ? (
            <View style={styles.remarkContainer}>
              <Ionicons name="chatbubble" size={12} color={primaryColor} />
              <Text style={[styles.remarkLabel, { color: primaryColor }]}>
                {isAdmin ? strings.studentRemark : strings.myRemark}
              </Text>
              <Text style={styles.remarkText} numberOfLines={2}>
                {userRemark}
              </Text>
            </View>
          ) : null}
          {trainerRemark ? (
            <View style={styles.trainerRemarkContainer}>
              <Ionicons name="chatbubble" size={12} color={Colors.SECONDARY} />
              <Text style={styles.trainerRemarkLabel}>
                {strings.trainerRemark}
              </Text>
              <Text style={styles.trainerRemarkText} numberOfLines={2}>
                {trainerRemark}
              </Text>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.iconButton, isAdmin && { opacity: 0.35 }]}
            onPress={handleCheckPress}
            disabled={(!isInSet && isFullyCompleted) || isDisabled}
          >
            <Animated.View style={checkmarkAnimStyle}>
              <Ionicons
                name={
                  isInSet
                    ? isCompleted
                      ? "checkbox"
                      : "square-outline"
                    : showFilledCheck
                      ? "checkbox"
                      : "square-outline"
                }
                size={26}
                color={
                  isInSet
                    ? isCompleted
                      ? primaryColor
                      : isDisabled
                        ? "#ddd"
                        : "#ccc"
                    : isFullyCompleted
                      ? primaryColor
                      : showFilledCheck
                        ? primaryColor
                        : isDisabled
                          ? "#ddd"
                          : "#ccc"
                }
              />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => openExerciseDetails(item)}
          >
            <Ionicons
              name="information-circle-outline"
              size={26}
              color={Colors.SECONDARY}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.editModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.editModalHeader}>
                <View style={styles.editModalImageContainer}>
                  <Image
                    source={
                      item.youtubeThumbnail
                        ? { uri: item.youtubeThumbnail }
                        : require("../../../assets/images/logo.png")
                    }
                    style={styles.editModalImage}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.editModalTextContainer}>
                  <Text style={styles.editModalExerciseName}>{item.name}</Text>
                  <Text
                    style={[
                      styles.editModalBodyPartLabel,
                      { color: primaryColor },
                    ]}
                  >
                    {item.bodyPartName}
                  </Text>
                </View>
              </View>

              <View style={styles.editInputRow}>
                <TextInput
                  style={styles.editTextInput}
                  placeholder="0"
                  value={editSets}
                  onChangeText={setEditSets}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                  editable={!editSaving}
                />
                <View style={styles.editInputLabelContainer}>
                  <MaterialIcons name="repeat" size={20} color={primaryColor} />
                  <Text style={styles.editInputLabel}>
                    {strings.numberOfSets}
                  </Text>
                </View>
              </View>

              <View style={styles.editInputRow}>
                <TextInput
                  style={styles.editTextInput}
                  placeholder="0"
                  value={editWeight}
                  onChangeText={setEditWeight}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                  editable={!editSaving}
                />
                <View style={styles.editInputLabelContainer}>
                  <MaterialIcons
                    name="fitness-center"
                    size={20}
                    color={primaryColor}
                  />
                  <Text style={styles.editInputLabel}>
                    {strings.totalWeight}
                  </Text>
                </View>
              </View>

              <View style={styles.editInputRow}>
                <TextInput
                  style={styles.editTextInput}
                  placeholder="0"
                  value={editReps}
                  onChangeText={setEditReps}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                  editable={!editSaving}
                />
                <View style={styles.editInputLabelContainer}>
                  <MaterialIcons
                    name="directions-run"
                    size={20}
                    color={primaryColor}
                  />
                  <Text style={styles.editInputLabel}>
                    {strings.numberOfReps}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveEditButton,
                  { backgroundColor: primaryColor },
                ]}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveEditButtonText}>{strings.save}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={handleCancelEdit}
              >
                <Ionicons name="close" size={20} color="#666" />
                <Text style={styles.cancelEditButtonText}>
                  {strings.cancel}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={remarkModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCancelRemark}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalOverlay} onPress={handleCancelRemark}>
            <Pressable style={styles.remarkModalContent} onPress={() => {}}>
              <Text style={styles.remarkModalTitle}>
                {isAdmin ? strings.trainerRemarkTitle : strings.remarkTitle}
              </Text>
              <Text style={styles.remarkModalMessage}>
                {isAdmin ? strings.trainerRemarkMessage : strings.remarkMessage}
              </Text>
              <TextInput
                style={styles.remarkInput}
                value={remarkInput}
                onChangeText={setRemarkInput}
                placeholder={strings.remarkPlaceholder}
                multiline
                numberOfLines={3}
                textAlign="right"
                autoFocus
              />
              <View style={styles.remarkModalButtons}>
                {(isAdmin ? trainerRemark : userRemark) ? (
                  <TouchableOpacity
                    style={[styles.remarkModalButton, styles.deleteButton]}
                    onPress={handleDeleteRemark}
                  >
                    <Text style={styles.deleteButtonText}>
                      {strings.delete}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.remarkModalButton, styles.cancelButton]}
                  onPress={handleCancelRemark}
                >
                  <Text style={styles.cancelButtonText}>{strings.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.remarkModalButton,
                    styles.saveButton,
                    { backgroundColor: primaryColor },
                  ]}
                  onPress={handleSaveRemark}
                >
                  <Text style={styles.saveButtonText}>{strings.save}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Animated.View>
  );
}

const strings = {
  setsLabel: "חזרות",
  weightLabel: "ק״ג",
  repCompleted: "חזרה הושלמה!",
  repsRemaining: "חזרות נותרו",
  allRepsCompleted: "כל החזרות הושלמו!",
  adminCannotCheck: "מאמן אינו יכול לסמן תרגיל",
  editData: "ערוך נתונים",
  numberOfSets: "מספר סטים",
  totalWeight: "משקל כולל",
  numberOfReps: "מספר חזרות",
  remarkTitle: "הערה שלי",
  remarkMessage: "האם התרגיל קשה מדי? קל מדי? שתף את המאמן שלך",
  trainerRemarkTitle: "הערת מאמן",
  trainerRemarkMessage: "הוסף הערה לתלמיד בנוגע לתרגיל זה",
  remarkPlaceholder: "לדוגמה: קל מדי, צריך להעלות משקל...",
  addMyRemark: "הוסף הערה",
  editMyRemark: "ערוך הערה",
  addTrainerRemark: "הוסף הערת מאמן",
  editTrainerRemark: "ערוך הערת מאמן",
  myRemark: "הערה שלי",
  studentRemark: "הערה שלו",
  trainerRemark: "הערת מאמן",
  save: "שמור",
  cancel: "ביטול",
  delete: "מחק",
};

const styles = StyleSheet.create({
  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    marginBottom: 15,
    marginHorizontal: 15,
    padding: 12,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  exerciseCardInSet: {
    marginBottom: 0,
    marginHorizontal: 0,
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  exerciseCardDisabled: {
    opacity: 0.5,
  },
  videoContainer: {
    width: wp(22.5),
    height: wp(22.5),
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    marginRight: 15,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    height: "100%",
  },
  exerciseImage: {
    width: "100%",
    height: "100%",
  },
  imageLoader: {
    position: "absolute",
    zIndex: 1,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#404040",
    textAlign: "right",
    marginBottom: 4,
  },
  exerciseDetails: {
    fontSize: 14,
    color: "#666",
    textAlign: "right",
    marginBottom: 2,
  },
  bodyPartRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  bodyPartName: {
    fontSize: 15,
    color: Colors.PRIMARY,
    fontWeight: "600",
    textAlign: "right",
  },
  actionsContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-evenly",
    marginLeft: 8,
  },
  iconButton: {
    padding: 6,
  },
  setsProgressContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 5,
    gap: 6,
  },
  setsProgressBackground: {
    flex: 1,
    height: 5,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  setsProgressFill: {
    height: "100%",
    backgroundColor: Colors.PRIMARY,
    borderRadius: 3,
  },
  setsProgressText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.PRIMARY,
    minWidth: 24,
    textAlign: "right",
  },
  remarkButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#f8f9fa",
    borderRadius: 5,
    gap: 3,
  },
  remarkButtonText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  remarkModalContent: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    width: "85%",
    maxWidth: 400,
  },
  remarkModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
    color: "#333",
  },
  remarkModalMessage: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 15,
    color: "#666",
  },
  remarkInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 15,
  },
  remarkModalButtons: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 10,
  },
  remarkModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: Colors.PRIMARY,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#ff4444",
  },
  deleteButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  remarkContainer: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    marginTop: 3,
    backgroundColor: "#e8f4f8",
    padding: 6,
    borderRadius: 6,
    gap: 4,
  },
  remarkLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.PRIMARY,
    marginLeft: 2,
  },
  remarkText: {
    flex: 1,
    fontSize: 11,
    color: "#555",
    textAlign: "right",
    lineHeight: 15,
    fontStyle: "italic",
  },
  trainerRemarkContainer: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    marginTop: 3,
    backgroundColor: "#fff4e6",
    padding: 6,
    borderRadius: 6,
    gap: 4,
  },
  trainerRemarkLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.SECONDARY,
    marginLeft: 2,
  },
  trainerRemarkText: {
    flex: 1,
    fontSize: 11,
    color: "#555",
    textAlign: "right",
    lineHeight: 15,
    fontStyle: "italic",
  },
  editButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: "#f8f9fa",
    borderRadius: 5,
    gap: 3,
    marginTop: 6,
  },
  editButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  editModalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 5,
  },
  editModalImageContainer: {
    alignItems: "center",
  },
  editModalImage: {
    width: wp(20),
    height: wp(20),
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  editModalTextContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  editModalExerciseName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#404040",
    textAlign: "right",
    marginBottom: 4,
  },
  editModalBodyPartLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  editInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 5,
  },
  editInputLabelContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  editInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#404040",
  },
  editTextInput: {
    width: 70,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#404040",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  saveEditButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  saveEditButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelEditButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  cancelEditButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
});
