import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { widthPercentageToDP as wp } from "react-native-responsive-screen";
import { Image as ExpoImage } from "expo-image";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, useEffect, useRef } from "react";
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
import { useTheme } from "../../../components/ThemeContext";

export default function StudentTrainingCard({
  item,
  drag,
  isActive,
  getIndex,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  isInSet = false,
  onPress,
  userId,
  trainingKey,
  onDataUpdate,
  isCreatingMode = false,
  isInTraining = false,
  onToggleInTraining,
  generalDocId,
}) {
  const { primaryColor } = useTheme();
  const [sets, setSets] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const previousModalRef = useRef(false);

  const thumbnailUrl = item?.youtubeThumbnail;

  // Load existing data
  useEffect(() => {
    loadExerciseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state with item props when they change (e.g., after drag)
  useEffect(() => {
    if (item.numOfSets !== undefined && item.numOfSets !== null) {
      setSets(String(item.numOfSets));
    } else {
      setSets("");
    }

    if (item.weight !== undefined && item.weight !== null) {
      setWeight(String(item.weight));
    } else {
      setWeight("");
    }

    if (item.numOfReps !== undefined && item.numOfReps !== null) {
      setReps(String(item.numOfReps));
    } else {
      setReps("");
    }
  }, [item.numOfSets, item.weight, item.numOfReps]);

  // Save data when modal closes
  useEffect(() => {
    if (previousModalRef.current === true && modalVisible === false) {
      // Modal just closed, save the data
      saveExerciseData(sets, weight, reps);
    }
    previousModalRef.current = modalVisible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

  const loadExerciseData = async () => {
    if (!trainingKey) return;

    try {
      if (generalDocId) {
        // General mode: load from Trainings collection
        const trainingRef = doc(db, "Trainings", generalDocId);
        const trainingSnap = await getDoc(trainingRef);
        if (trainingSnap.exists()) {
          const trainingData = trainingSnap.data();
          const exercise = (trainingData.exercises || []).find(
            (ex) =>
              ex.bodyPartId === item.bodyPartId &&
              ex.exerciseIndex === item.exerciseIndex,
          );
          if (exercise) {
            if (exercise.numOfSets) setSets(String(exercise.numOfSets));
            if (exercise.weight) setWeight(String(exercise.weight));
            if (exercise.numOfReps) setReps(String(exercise.numOfReps));
          }
        }
        return;
      }

      if (!userId) return;

      const userRef = doc(db, "Users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const training = userData.trainings?.[trainingKey];

        if (training && training.exercises) {
          // Find the matching exercise
          const exercise = training.exercises.find(
            (ex) =>
              ex.bodyPartId === item.bodyPartId &&
              ex.exerciseIndex === item.exerciseIndex,
          );

          if (exercise) {
            if (exercise.numOfSets) setSets(String(exercise.numOfSets));
            if (exercise.weight) setWeight(String(exercise.weight));
            if (exercise.numOfReps) setReps(String(exercise.numOfReps));
          }
        }
      }
    } catch (error) {
      console.error("Error loading exercise data:", error);
    }
  };

  const saveExerciseData = async (numOfSets, weight, numOfReps) => {
    if (!trainingKey || saving) return;
    if (!userId && !generalDocId) return;

    try {
      setSaving(true);

      // General mode: save directly to Trainings collection
      if (generalDocId) {
        const trainingRef = doc(db, "Trainings", generalDocId);
        const trainingSnap = await getDoc(trainingRef);
        if (trainingSnap.exists()) {
          const trainingData = trainingSnap.data();
          const updatedExercises = (trainingData.exercises || []).map((ex) => {
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
          await updateDoc(trainingRef, { exercises: updatedExercises });
        }
        if (onDataUpdate) {
          const finalNumOfSets =
            numOfSets && numOfSets.trim() ? parseInt(numOfSets) : null;
          const finalWeight = weight && weight.trim() ? parseInt(weight) : null;
          const finalNumOfReps =
            numOfReps && numOfReps.trim() ? parseInt(numOfReps) : null;
          onDataUpdate(finalNumOfSets, finalWeight, finalNumOfReps);
        }
        return;
      }

      // Update in Users collection
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

              // Only add fields if they have values
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

          // Track this exercise's change in graphs
          const today = new Date();
          const dateLabel = `${today.getDate()}.${String(today.getMonth() + 1).padStart(2, "0")}`;
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

              // Only append if at least one value actually changed
              const hasChanged =
                graphSets !== lastSets ||
                graphWeight !== lastWeight ||
                graphReps !== lastReps;

              if (!hasChanged) {
                // Nothing changed — leave graphs untouched
              } else {
                graphUpdate = {
                  dates: [...existingEntry.dates, dateLabel],
                  weights: [...existingEntry.weights, graphWeight],
                  sets: [...existingEntry.sets, graphSets],
                  reps: [...existingEntry.reps, graphReps],
                };
              }
            } else {
              // No graph entry yet for this exercise — create it
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

      // Update in Trainings collection (archive)
      // Single-field query (no composite index needed), verify ownership client-side
      const trainingsSnapshot = await getDocs(
        query(
          collection(db, "Trainings"),
          where("originalTrainingKey", "==", trainingKey),
        ),
      );
      const matchingTrainingDoc = trainingsSnapshot.docs.find((d) => {
        const data = d.data();
        return data.userIds?.includes(userId) || data.userId === userId;
      });

      if (matchingTrainingDoc) {
        const trainingDoc = matchingTrainingDoc;
        const trainingData = trainingDoc.data();

        if (trainingData.exercises) {
          const updatedExercises = trainingData.exercises.map((ex) => {
            if (
              ex.bodyPartId === item.bodyPartId &&
              ex.exerciseIndex === item.exerciseIndex
            ) {
              const updatedEx = { ...ex };

              // Only add fields if they have values
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

          await updateDoc(doc(db, "Trainings", trainingDoc.id), {
            exercises: updatedExercises,
          });
        }
      }

      // Update parent component's state
      if (onDataUpdate) {
        const finalNumOfSets =
          numOfSets && numOfSets.trim() ? parseInt(numOfSets) : null;
        const finalWeight = weight && weight.trim() ? parseInt(weight) : null;
        const finalNumOfReps =
          numOfReps && numOfReps.trim() ? parseInt(numOfReps) : null;
        onDataUpdate(finalNumOfSets, finalWeight, finalNumOfReps);
      }
    } catch (error) {
      console.error("Error saving exercise data:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSetsChange = (value) => {
    setSets(value);
  };

  const handleWeightChange = (value) => {
    setWeight(value);
  };

  const handleRepsChange = (value) => {
    setReps(value);
  };

  const handleCardPress = () => {
    if (selectionMode) {
      if (!isInSet) onToggleSelect();
    } else {
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  return (
    <View>
      <TouchableOpacity
        onLongPress={selectionMode ? undefined : drag}
        onPress={handleCardPress}
        disabled={isActive || (selectionMode && isInSet)}
        style={[
          styles.exerciseCard,
          isActive && styles.exerciseCardActive,
          isSelected && styles.exerciseCardSelected,
          isSelected && { borderColor: primaryColor },
          isInSet && !isSelected && !isActive && styles.exerciseCardInSet,
          selectionMode &&
            isInSet &&
            !isSelected &&
            styles.exerciseCardDisabled,
          isCreatingMode &&
            isInTraining &&
            !isInSet &&
            !isSelected &&
            !isActive &&
            styles.exerciseCardAdded,
          isCreatingMode &&
            isInTraining &&
            !isInSet &&
            !isSelected &&
            !isActive && { borderColor: primaryColor },
        ]}
      >
        {selectionMode ? (
          <MaterialIcons
            name={
              isInSet
                ? "lock"
                : isSelected
                  ? "check-circle"
                  : "radio-button-unchecked"
            }
            size={27}
            color={isInSet ? "#999" : isSelected ? primaryColor : "#ccc"}
          />
        ) : isActive ? (
          <AntDesign
            style={styles.exerciseIconOnDrag}
            name="drag"
            size={20}
            color={primaryColor}
          />
        ) : (
          <MaterialIcons name="drag-indicator" size={27} color={primaryColor} />
        )}

        {thumbnailUrl ? (
          <ExpoImage
            source={{ uri: thumbnailUrl }}
            style={[styles.exerciseImage, isActive && styles.exerciseImageDrag]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Image
            source={require("../../../assets/images/logo.png")}
            style={[styles.exerciseImage, isActive && styles.exerciseImageDrag]}
            resizeMode="contain"
          />
        )}

        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.bodyPartLabel, { color: primaryColor }]}>
            {item.bodyPartName}
          </Text>
          <Text style={styles.exerciseDataText}>
            {sets || 0} {strings.setsLabel} | {weight || 0}{" "}
            {strings.weightLabel} | {reps || 0} {strings.repsLabel}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Modal for Exercise Details */}
      <Modal
        visible={modalVisible && !selectionMode}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Exercise Header with Image and Text */}
              <View style={styles.modalHeader}>
                {/* Exercise Image */}
                <View style={styles.modalImageContainer}>
                  {thumbnailUrl ? (
                    <ExpoImage
                      source={{ uri: thumbnailUrl }}
                      style={styles.modalImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Image
                      source={require("../../../assets/images/logo.png")}
                      style={styles.modalImage}
                      resizeMode="contain"
                    />
                  )}
                </View>

                {/* Exercise Info */}
                <View style={styles.modalTextContainer}>
                  <Text style={styles.modalExerciseName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.modalBodyPartLabel, { color: primaryColor }]}
                  >
                    {item.bodyPartName}
                  </Text>
                </View>
              </View>

              {/* Add to Training Checkbox (only in creation mode) */}
              {isCreatingMode && onToggleInTraining && (
                <TouchableOpacity
                  style={[
                    styles.addToTrainingButton,
                    isInTraining && styles.addToTrainingButtonActive,
                    isInTraining && { borderColor: primaryColor },
                  ]}
                  onPress={onToggleInTraining}
                >
                  <MaterialIcons
                    name={
                      isInTraining ? "check-box" : "check-box-outline-blank"
                    }
                    size={24}
                    color={isInTraining ? primaryColor : "#666"}
                  />
                  <Text
                    style={[
                      styles.addToTrainingText,
                      isInTraining && styles.addToTrainingTextActive,
                      isInTraining && { color: primaryColor },
                    ]}
                  >
                    {isInTraining
                      ? strings.removeFromTraining
                      : strings.addToTraining}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Number of Sets */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  value={sets}
                  onChangeText={handleSetsChange}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                  editable={!saving}
                />
                <View style={styles.inputLabelContainer}>
                  <MaterialIcons name="repeat" size={20} color={primaryColor} />
                  <Text style={styles.inputLabel}>{strings.numberOfSets}</Text>
                </View>
              </View>

              {/* Weight */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  value={weight}
                  onChangeText={handleWeightChange}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                  editable={!saving}
                />
                <View style={styles.inputLabelContainer}>
                  <MaterialIcons
                    name="fitness-center"
                    size={20}
                    color={primaryColor}
                  />
                  <Text style={styles.inputLabel}>{strings.totalWeight}</Text>
                </View>
              </View>

              {/* Number of Reps */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  value={reps}
                  onChangeText={handleRepsChange}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                  editable={!saving}
                />
                <View style={styles.inputLabelContainer}>
                  <MaterialIcons
                    name="directions-run"
                    size={20}
                    color={primaryColor}
                  />
                  <Text style={styles.inputLabel}>{strings.numberOfReps}</Text>
                </View>
              </View>

              {/* Watch Full Details Button */}
              <TouchableOpacity
                style={[
                  styles.fullDetailsButton,
                  { borderColor: primaryColor },
                ]}
                onPress={() => {
                  handleCloseModal();
                  onPress();
                }}
              >
                <Ionicons name="eye" size={22} color={primaryColor} />
                <Text
                  style={[
                    styles.fullDetailsButtonText,
                    { color: primaryColor },
                  ]}
                >
                  {strings.watchDetails}
                </Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={handleCloseModal}
              >
                <AntDesign name="close" size={22} color={Colors.DELETED} />
                <Text style={styles.closeModalButtonText}>{strings.close}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const strings = {
  watchDetails: "צפה בפרטים מלאים",
  numberOfSets: "מספר סטים",
  numberOfReps: "מספר חזרות",
  totalWeight: "משקל כולל",
  setsLabel: "סטים",
  weightLabel: "ק״ג",
  repsLabel: "חזרות",
  addToTraining: "הוסף לאימון",
  removeFromTraining: "הסר מהאימון",
  close: "סגור",
};

const styles = StyleSheet.create({
  exerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    justifyContent: "space-between",
    borderRadius: 15,
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  exerciseCardActive: {
    backgroundColor: "#edede9",
  },
  exerciseCardSelected: {
    backgroundColor: "#e0f2fe",
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
  },
  exerciseCardInSet: {
    marginBottom: 0,
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  exerciseCardDisabled: {
    opacity: 0.6,
    backgroundColor: "#f5f5f5",
  },
  exerciseCardAdded: {
    borderWidth: 1,
  },

  exerciseImage: {
    width: wp(20),
    height: wp(20),
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 10,
  },
  exerciseImageDrag: {
    left: 7,
  },
  exerciseIconOnDrag: {
    left: 3,
  },
  exerciseInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#404040",
    textAlign: "right",
    marginBottom: 4,
  },
  bodyPartLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  exerciseDataText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 5,
  },
  modalImageContainer: {
    alignItems: "center",
  },
  modalImage: {
    width: wp(25),
    height: wp(25),
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
  },
  modalTextContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  modalExerciseName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#404040",
    textAlign: "right",
    marginBottom: 6,
  },
  modalBodyPartLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  fullDetailsButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 10,
  },
  fullDetailsButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  closeModalButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.DELETED,
    marginTop: 10,
  },
  closeModalButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.DELETED,
  },
  addToTrainingButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    marginBottom: 5,
  },
  addToTrainingButtonActive: {
    backgroundColor: "#e0f2fe",
  },
  addToTrainingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  addToTrainingTextActive: {},
  inputRow: {
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
  inputLabelContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#404040",
  },
  textInput: {
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
    borderRadius: 0,
    backgroundColor: "#f5f5f5",
  },
});
