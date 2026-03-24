import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  BackHandler,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  collection,
  getDocs,
  query,
  doc,
  updateDoc,
  getDoc,
  increment,
} from "firebase/firestore";
import { db } from "../../../configs/FirebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Colors } from "../../../constants/Colors";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import ExerciseDetails from "../../ExerciseDetails";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSequence,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import StudentTrainingShowCard from "./StudentTrainingShowCard";
import Toast from "react-native-toast-message";
import { useAuthContext } from "../../../components/AuthContext";
import { useTheme } from "../../../components/ThemeContext";

export default function StudentTrainingShow() {
  const router = useRouter();
  const { user } = useUser();
  const { isAdmin } = useAuthContext();
  const { primaryColor } = useTheme();
  const params = useLocalSearchParams();
  const trainingKey = params.trainingKey;
  const source = params.source || "training";
  const studentData = params.studentData
    ? JSON.parse(params.studentData)
    : null;
  const [loading, setLoading] = useState(false);
  const [exercisesList, setExercisesList] = useState([]);
  const [completedExercises, setCompletedExercises] = useState({});
  const [exerciseRemarks, setExerciseRemarks] = useState({});
  const [trainerRemarks, setTrainerRemarks] = useState({});
  const [exerciseRepsDone, setExerciseRepsDone] = useState({});
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [trainingName, setTrainingName] = useState("");
  const [, setScheduledDay] = useState(null);
  const [userId, setUserId] = useState(null);
  const [originalTrainingKey, setOriginalTrainingKey] = useState(null);
  const [restTimerSeconds, setRestTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [repsCompleted, setRepsCompleted] = useState({});
  const [isTrainingComplete, setIsTrainingComplete] = useState(false);
  const [trainingSets, setTrainingSets] = useState(1);
  const [trainingRepsCompleted, setTrainingRepsCompleted] = useState(0);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [trainingFeedback, setTrainingFeedback] = useState("");
  const [hasStartedWorkout, setHasStartedWorkout] = useState(false);
  const [overallTimerSeconds, setOverallTimerSeconds] = useState(0);
  const [isOverallTimerRunning, setIsOverallTimerRunning] = useState(false);
  const resetButtonRotation = useSharedValue(0);
  const resetButtonRotationSet = useSharedValue(0);

  const progressBarStyle = useAnimatedStyle(() => {
    if (exercisesList.length === 0) return { width: "0%" };

    let totalPossible = 0;
    let currentProgress = 0;

    exercisesList.forEach((ex) => {
      const ownSets = Math.max(parseInt(ex.numOfSets) || 1, 1);
      const isCompleted = completedExercises[ex.id] === true;

      if (ex.setId && ex.setReps) {
        const rounds = Math.max(parseInt(ex.setReps) || 1, 1);
        const maxContribution = ownSets * rounds;
        totalPossible += maxContribution;
        const roundsDone = repsCompleted[ex.setId] || 0;
        const inProgressTaps = exerciseRepsDone[ex.id] || 0;
        currentProgress += Math.min(
          roundsDone * ownSets + inProgressTaps,
          maxContribution,
        );
      } else {
        totalPossible += ownSets;
        currentProgress += isCompleted ? ownSets : exerciseRepsDone[ex.id] || 0;
      }
    });

    const percent =
      totalPossible > 0 ? (currentProgress / totalPossible) * 100 : 0;
    return {
      width: withTiming(`${Math.min(percent, 100)}%`, { duration: 300 }),
    };
  }, [exercisesList, exerciseRepsDone, repsCompleted, completedExercises]);

  const progressPercent = useMemo(() => {
    if (exercisesList.length === 0) return 0;
    let totalPossible = 0;
    let currentProgress = 0;
    exercisesList.forEach((ex) => {
      const ownSets = Math.max(parseInt(ex.numOfSets) || 1, 1);
      const isCompleted = completedExercises[ex.id] === true;
      if (ex.setId && ex.setReps) {
        const rounds = Math.max(parseInt(ex.setReps) || 1, 1);
        const maxContribution = ownSets * rounds;
        totalPossible += maxContribution;
        const roundsDone = repsCompleted[ex.setId] || 0;
        const inProgressTaps = exerciseRepsDone[ex.id] || 0;
        currentProgress += Math.min(
          roundsDone * ownSets + inProgressTaps,
          maxContribution,
        );
      } else {
        totalPossible += ownSets;
        currentProgress += isCompleted ? ownSets : exerciseRepsDone[ex.id] || 0;
      }
    });
    return totalPossible > 0
      ? Math.min((currentProgress / totalPossible) * 100, 100)
      : 0;
  }, [exercisesList, exerciseRepsDone, repsCompleted, completedExercises]);

  const roundedProgress = Math.round(progressPercent);

  const resetButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${resetButtonRotation.value}deg` }],
    };
  });

  const resetButtonStyleSet = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${resetButtonRotationSet.value}deg` }],
    };
  });

  useEffect(() => {
    LoadStudentExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );
    return () => backHandler.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedExercises, exercisesList]);

  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setRestTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  useEffect(() => {
    let interval;
    if (isOverallTimerRunning) {
      interval = setInterval(() => {
        setOverallTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOverallTimerRunning]);

  useEffect(() => {
    // Check if training is complete
    if (exercisesList.length > 0) {
      const completedCount =
        Object.values(completedExercises).filter(Boolean).length;
      const wasComplete = isTrainingComplete;
      const isComplete = completedCount === exercisesList.length;

      if (isComplete && !wasComplete) {
        // Training just completed
        setIsTrainingComplete(true);
        setIsTimerRunning(false);
        setRestTimerSeconds(0);

        const currentReps = trainingRepsCompleted;
        const totalSets = trainingSets;
        const newRepsCompleted = currentReps + 1;

        // Check if this is not the final training set
        if (currentReps < totalSets - 1) {
          // Update the counter
          setTrainingRepsCompleted(newRepsCompleted);

          // Save to database
          if (userId && source !== "archive") {
            const userDocRef = doc(db, "Users", userId);
            updateDoc(userDocRef, {
              [`trainings.${trainingKey}.trainingRepsCompleted`]:
                newRepsCompleted,
            }).catch((error) =>
              console.error("Error saving training reps:", error),
            );
          }

          // Reset all exercises for the next round
          setTimeout(() => {
            setCompletedExercises({});
            saveCompletedExercises({});

            // Reset all set reps
            setRepsCompleted({});
            if (userId && source !== "archive") {
              const userDocRef = doc(db, "Users", userId);
              updateDoc(userDocRef, {
                [`trainings.${trainingKey}.repsCompleted`]: {},
              }).catch((error) =>
                console.error("Error resetting set reps:", error),
              );
            }

            setIsTrainingComplete(false);
          }, 100);

          // Show toast with remaining training sets
          const remaining = totalSets - newRepsCompleted;
          Toast.show({
            type: "success",
            text1: `${strings.trainingSetCompleted} ${remaining} ${strings.trainingSetsRemaining}`,
            position: "top",
            visibilityTime: 3000,
          });
        } else if (currentReps === totalSets - 1) {
          // This is the final training set
          setTrainingRepsCompleted(totalSets);
          setIsOverallTimerRunning(false);

          if (userId && source !== "archive") {
            const userDocRef = doc(db, "Users", userId);
            updateDoc(userDocRef, {
              [`trainings.${trainingKey}.trainingRepsCompleted`]: totalSets,
              trainingsCompleted: increment(1),
            }).catch((error) =>
              console.error("Error saving training reps:", error),
            );
          }

          // Show full completion toast
          Toast.show({
            type: "success",
            text1: strings.trainingFullyCompleted,
            text2: strings.trainingFullyCompletedMessage,
            position: "top",
            visibilityTime: 4000,
          });
        }
      } else if (!isComplete && wasComplete) {
        // Training was uncompleted
        setIsTrainingComplete(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    completedExercises,
    exercisesList,
    isTrainingComplete,
    trainingRepsCompleted,
    trainingSets,
    userId,
  ]);

  const LoadStudentExercises = async () => {
    setLoading(true);
    try {
      let trainingData = null;
      let userData = null;

      // If viewing from archive, load from Trainings collection
      if (source === "archive") {
        const trainingDocRef = doc(db, "Trainings", trainingKey);
        const trainingDocSnap = await getDoc(trainingDocRef);

        if (!trainingDocSnap.exists()) {
          Alert.alert(strings.error, strings.noTraining);
          setLoading(false);
          return;
        }

        const archiveData = trainingDocSnap.data();
        trainingData = archiveData;

        // Resolve effective userId (support both new userIds array and legacy userId)
        const effectiveArchiveUserId =
          archiveData.userIds?.length > 0
            ? archiveData.userIds[0]
            : archiveData.userId || null;

        // Get user data for scheduled day info
        if (effectiveArchiveUserId) {
          const userDocRef = doc(db, "Users", effectiveArchiveUserId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            userData = { id: userDocSnap.id, ...userDocSnap.data() };
          }
        }
      } else {
        // Original flow - load from user's trainings
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

        querySnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          if (data.email === targetEmail) {
            userData = { id: docSnapshot.id, ...data };
          }
        });

        if (!userData) {
          Alert.alert(strings.error, strings.noData);
          setLoading(false);
          return;
        }

        // Get the specific training
        if (!userData.trainings || !userData.trainings[trainingKey]) {
          Alert.alert(strings.error, strings.noTraining);
          setLoading(false);
          return;
        }

        trainingData = userData.trainings[trainingKey];
      }

      if (!trainingData) {
        Alert.alert(strings.error, strings.noTraining);
        setLoading(false);
        return;
      }
      setTrainingName(trainingData.name || "");
      const resolvedUserId =
        source === "archive"
          ? trainingData.userIds?.length > 0
            ? trainingData.userIds[0]
            : trainingData.userId || null
          : userData.id;
      setUserId(resolvedUserId);
      if (source === "archive") {
        setOriginalTrainingKey(trainingData.originalTrainingKey || null);
      }
      setTrainingSets(trainingData.trainingSets || 1);
      setTrainingRepsCompleted(trainingData.trainingRepsCompleted || 0);
      setTrainingFeedback(trainingData.trainingFeedback || "");

      // Get scheduled day from training program (fallback for archive or when not passed as param)
      if (userData && (!params.scheduledDay || source === "archive")) {
        const dayTrainingMap = userData.trainingProgram?.dayTrainingMap || {};
        const lookupKey =
          source === "archive" ? trainingData.originalTrainingKey : trainingKey;
        const scheduledDayForTraining =
          Object.values(dayTrainingMap).find(
            (entry) => entry?.trainingId === lookupKey,
          )?.day || null;
        setScheduledDay(scheduledDayForTraining);
      }

      // Get all body parts data
      const bodyPartsQuery = query(collection(db, "BodyParts"));
      const bodyPartsSnapshot = await getDocs(bodyPartsQuery);
      const bodyParts = {};
      bodyPartsSnapshot.forEach((doc) => {
        bodyParts[doc.id] = { id: doc.id, ...doc.data() };
      });

      // Build the exercises list from training
      const exercises = [];
      const initialCompleted = {};
      const initialRemarks = trainingData.exerciseRemarks || {};
      const initialTrainerRemarks = trainingData.trainerRemarks || {};
      const initialExerciseRepsDone = trainingData.exerciseRepsDone || {};
      const completedIds = trainingData.completedExerciseIds || [];
      const initialRepsCompleted = trainingData.repsCompleted || {};

      trainingData.exercises.forEach((orderItem) => {
        const {
          bodyPartId,
          exerciseIndex,
          setId,
          setType,
          numOfSets,
          numOfReps,
          weight,
          setReps,
        } = orderItem;
        const bodyPart = bodyParts[bodyPartId];

        if (
          bodyPart &&
          bodyPart.exercises &&
          bodyPart.exercises[exerciseIndex]
        ) {
          const exercise = bodyPart.exercises[exerciseIndex];
          const exerciseId = `${bodyPartId}-${exerciseIndex}`;
          exercises.push({
            id: exerciseId,
            bodyPartId,
            exerciseIndex,
            bodyPartName: bodyPart.bodyPart,
            ...exercise,
            setId: setId || null,
            setType: setType || null,
            numOfSets: numOfSets || null,
            numOfReps: numOfReps || null,
            weight: weight || null,
            setReps: setReps || null,
          });

          // Mark exercises as completed if their ID is in the saved array
          if (completedIds.includes(exerciseId)) {
            initialCompleted[exerciseId] = true;
          }
        }
      });

      setExercisesList(exercises);
      setCompletedExercises(initialCompleted);
      setExerciseRemarks(initialRemarks);
      setTrainerRemarks(initialTrainerRemarks);
      setExerciseRepsDone(initialExerciseRepsDone);
      setRepsCompleted(initialRepsCompleted);
    } catch (error) {
      console.error("Error loading exercises:", error);
      Alert.alert(strings.error, strings.loadError);
    } finally {
      setLoading(false);
    }
  };

  const toggleExerciseCompletion = async (exerciseId) => {
    const currentExercise = exercisesList.find((ex) => ex.id === exerciseId);
    const wasCompleted = completedExercises[exerciseId] === true;

    // Check if this would complete a set
    if (!wasCompleted && currentExercise?.setId) {
      const exercisesInSet = exercisesList.filter(
        (ex) => ex.setId === currentExercise.setId,
      );

      // Check if completing this exercise would complete the set
      const wouldCompleteSet = exercisesInSet.every(
        (ex) => ex.id === exerciseId || completedExercises[ex.id] === true,
      );

      if (wouldCompleteSet && currentExercise.setReps) {
        const currentCount = repsCompleted[currentExercise.setId] || 0;
        const totalReps = parseInt(currentExercise.setReps);

        // Complete the exercise first
        completeExerciseNormally(exerciseId);

        // Increment counter immediately
        const newCount = currentCount + 1;

        // Check if this is not the final rep
        if (currentCount < totalReps - 1) {
          setRepsCompleted((prev) => ({
            ...prev,
            [currentExercise.setId]: newCount,
          }));

          // Immediately unmark all exercises in this set
          setCompletedExercises((prev) => {
            const newState = { ...prev };
            exercisesInSet.forEach((ex) => {
              delete newState[ex.id];
            });
            saveCompletedExercises(newState);
            return newState;
          });

          // Reset exercise reps done for all exercises in this set
          setExerciseRepsDone((prev) => {
            const updated = { ...prev };
            exercisesInSet.forEach((ex) => {
              delete updated[ex.id];
            });
            return updated;
          });

          // Save the reps completed count
          if (userId && source !== "archive") {
            const userDocRef = doc(db, "Users", userId);
            updateDoc(userDocRef, {
              [`trainings.${trainingKey}.repsCompleted.${currentExercise.setId}`]:
                newCount,
            }).catch((error) =>
              console.error("Error saving reps completed:", error),
            );
          }

          // Reset and start timer
          setRestTimerSeconds(0);
          setIsTimerRunning(true);

          // Show toast with remaining reps
          const remaining = totalReps - newCount;
          Toast.show({
            type: "success",
            text1: `${strings.setCompletedToast} ${remaining} ${strings.setsRemaining}`,
            position: "top",
            visibilityTime: 2000,
          });

          return;
        } else if (currentCount === totalReps - 1) {
          // This is the final rep - update counter and show toast
          setRepsCompleted((prev) => ({
            ...prev,
            [currentExercise.setId]: totalReps,
          }));

          if (userId && source !== "archive") {
            const userDocRef = doc(db, "Users", userId);
            updateDoc(userDocRef, {
              [`trainings.${trainingKey}.repsCompleted.${currentExercise.setId}`]:
                totalReps,
            }).catch((error) =>
              console.error("Error saving reps completed:", error),
            );
          }

          // Show completion toast message
          Toast.show({
            type: "success",
            text1: `${strings.setFullyCompletedTitle} ${strings.setFullyCompletedMessage}`,
            position: "top",
            visibilityTime: 3000,
          });

          return;
        }
      }
    }

    // Normal toggle behavior
    completeExerciseNormally(exerciseId);
  };

  const completeExerciseNormally = (exerciseId) => {
    setCompletedExercises((prev) => {
      const newState = { ...prev };
      const wasCompleted = newState[exerciseId] === true;

      // Find the current exercise
      const currentExercise = exercisesList.find((ex) => ex.id === exerciseId);

      if (wasCompleted) {
        delete newState[exerciseId];
        // If unchecking, stop and reset timer if no exercises remain completed
        const hasCompletedExercises = Object.keys(newState).some(
          (id) => newState[id] === true,
        );
        if (!hasCompletedExercises) {
          setIsTimerRunning(false);
          setRestTimerSeconds(0);
        }
      } else {
        newState[exerciseId] = true;

        // Check if this exercise is part of a set
        if (currentExercise?.setId) {
          // Get all exercises in this set
          const exercisesInSet = exercisesList.filter(
            (ex) => ex.setId === currentExercise.setId,
          );

          // Check if all exercises in the set are now completed
          const allSetExercisesCompleted = exercisesInSet.every(
            (ex) => newState[ex.id] === true,
          );

          // Only start timer if all exercises in this set are completed
          if (allSetExercisesCompleted) {
            // Reset timer and start (for both same set new rep or different set)
            setRestTimerSeconds(0);
            setIsTimerRunning(true);
          } else {
            // Not all exercises completed - user is in the middle of a rep
            // Stop and reset timer if it's running (either same set or different set)
            if (isTimerRunning) {
              setIsTimerRunning(false);
              setRestTimerSeconds(0);
            }
          }
        } else {
          // Exercise is not in a set, always reset and start timer
          setRestTimerSeconds(0);
          setIsTimerRunning(true);
        }
      }

      // Save to database immediately
      saveCompletedExercises(newState);

      return newState;
    });
  };

  const saveCompletedExercises = (newState) => {
    // Don't save if viewing from archive - it's read-only
    if (source === "archive") return;

    if (userId) {
      const completedIds = Object.keys(newState).filter(
        (id) => newState[id] === true,
      );
      const userDocRef = doc(db, "Users", userId);
      updateDoc(userDocRef, {
        [`trainings.${trainingKey}.completedExerciseIds`]: completedIds,
        [`trainings.${trainingKey}.completedExercises`]: completedIds.length,
      }).catch((error) => console.error("Error saving progress:", error));
    }
  };

  const saveExerciseRepsDone = (exerciseId, count) => {
    if (source === "archive") return;
    setExerciseRepsDone((prev) => {
      const updated = { ...prev, [exerciseId]: count };
      if (userId) {
        const userDocRef = doc(db, "Users", userId);
        updateDoc(userDocRef, {
          [`trainings.${trainingKey}.exerciseRepsDone`]: updated,
        }).catch((error) => console.error("Error saving reps done:", error));
      }
      return updated;
    });
  };

  const resetAllTraining = () => {
    // Trigger rotation animation (counterclockwise)
    resetButtonRotation.value = withSequence(
      withTiming(360, { duration: 500 }),
      withTiming(0, { duration: 0 }),
    );

    Alert.alert(
      strings.resetAllTitle,
      strings.resetAllMessage,
      [
        {
          text: strings.cancel,
          style: "cancel",
        },
        {
          text: strings.ok,
          onPress: () => {
            // Reset all reps completed
            setRepsCompleted({});

            // Reset training reps completed
            setTrainingRepsCompleted(0);

            // Uncheck all exercises
            setCompletedExercises({});
            saveCompletedExercises({});

            // Reset exercise reps done
            setExerciseRepsDone({});

            // Reset training complete state
            setIsTrainingComplete(false);

            // Stop and reset timer
            setIsTimerRunning(false);
            setRestTimerSeconds(0);

            // Stop and reset overall training timer
            setHasStartedWorkout(false);
            setOverallTimerSeconds(0);
            setIsOverallTimerRunning(false);

            // Save to database
            if (userId && source !== "archive") {
              const userDocRef = doc(db, "Users", userId);
              updateDoc(userDocRef, {
                [`trainings.${trainingKey}.repsCompleted`]: {},
                [`trainings.${trainingKey}.completedExerciseIds`]: [],
                [`trainings.${trainingKey}.completedExercises`]: 0,
                [`trainings.${trainingKey}.trainingRepsCompleted`]: 0,
                [`trainings.${trainingKey}.exerciseRepsDone`]: {},
              }).catch((error) =>
                console.error("Error resetting training:", error),
              );
            }

            Toast.show({
              type: "success",
              text1: strings.trainingReset,
              position: "top",
              visibilityTime: 2000,
            });
          },
        },
      ],
      { cancelable: true },
    );
  };

  const resetSetReps = (setId) => {
    resetButtonRotationSet.value = withSequence(
      withTiming(360, { duration: 500 }),
      withTiming(0, { duration: 0 }),
    );
    Alert.alert(
      strings.resetSetTitle,
      strings.resetSetMessage,
      [
        {
          text: strings.cancel,
          style: "cancel",
        },
        {
          text: strings.ok,
          onPress: () => {
            // Reset the reps completed counter for this set
            setRepsCompleted((prev) => {
              const newState = { ...prev };
              delete newState[setId];
              return newState;
            });

            // Uncheck all exercises in this set
            const exercisesInSet = exercisesList.filter(
              (ex) => ex.setId === setId,
            );
            setCompletedExercises((prev) => {
              const newState = { ...prev };
              exercisesInSet.forEach((ex) => {
                delete newState[ex.id];
              });
              saveCompletedExercises(newState);
              return newState;
            });

            // Reset exercise reps done for all exercises in this set
            setExerciseRepsDone((prev) => {
              const updated = { ...prev };
              exercisesInSet.forEach((ex) => {
                delete updated[ex.id];
              });
              return updated;
            });

            // Always stop and reset timer when resetting a set
            setIsTimerRunning(false);
            setRestTimerSeconds(0);

            // Save to database
            if (userId && source !== "archive") {
              const userDocRef = doc(db, "Users", userId);
              updateDoc(userDocRef, {
                [`trainings.${trainingKey}.repsCompleted.${setId}`]: 0,
              }).catch((error) =>
                console.error("Error resetting reps completed:", error),
              );
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const saveExerciseRemark = async (exerciseId, remark) => {
    // Don't save if viewing from archive - it's read-only
    if (source === "archive") return;

    setExerciseRemarks((prev) => {
      const newRemarks = { ...prev };
      if (remark && remark.trim()) {
        newRemarks[exerciseId] = remark.trim();
      } else {
        delete newRemarks[exerciseId];
      }

      // Save to database immediately
      if (userId) {
        const userDocRef = doc(db, "Users", userId);
        updateDoc(userDocRef, {
          [`trainings.${trainingKey}.exerciseRemarks`]: newRemarks,
        }).catch((error) => console.error("Error saving remark:", error));
      }

      return newRemarks;
    });
  };

  const saveTrainerRemark = async (exerciseId, remark) => {
    // Don't save if viewing from archive - it's read-only
    if (source === "archive") return;

    setTrainerRemarks((prev) => {
      const newRemarks = { ...prev };
      if (remark && remark.trim()) {
        newRemarks[exerciseId] = remark.trim();
      } else {
        delete newRemarks[exerciseId];
      }

      // Save to database immediately
      if (userId) {
        const userDocRef = doc(db, "Users", userId);
        updateDoc(userDocRef, {
          [`trainings.${trainingKey}.trainerRemarks`]: newRemarks,
        }).catch((error) =>
          console.error("Error saving trainer remark:", error),
        );
      }

      return newRemarks;
    });
  };

  const openExerciseDetails = (exercise) => {
    setSelectedExercise(exercise);
    setModalVisible(true);
  };

  const handleBackPress = () => {
    const goBack = () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/Home");
      }
    };

    // If admin is viewing, just go back without any alerts
    if (isAdmin) {
      goBack();
      return true;
    }

    const completedCount =
      Object.values(completedExercises).filter(Boolean).length;
    const totalExercises = exercisesList.length;

    if (completedCount === totalExercises && totalExercises > 0) {
      // All exercises completed
      Alert.alert(
        strings.congratulations,
        strings.workoutCompleted,
        [
          {
            text: strings.ok,
            onPress: () => {
              goBack();
            },
          },
        ],
        { cancelable: false },
      );
      return true;
    } else if (completedCount > 0 && completedCount < totalExercises) {
      // Partially completed
      Alert.alert(
        strings.leavingTitle,
        strings.leavingMessage,
        [
          {
            text: strings.cancel,
            style: "cancel",
          },
          {
            text: strings.ok,
            onPress: () => {
              goBack();
            },
          },
        ],
        { cancelable: true },
      );
      return true;
    } else {
      // No exercises completed - just go back
      goBack();
      return true;
    }
  };

  const handleBackButton = () => {
    handleBackPress();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const saveTrainingFeedback = async () => {
    // Don't save if viewing from archive - it's read-only
    if (source === "archive") return;

    if (userId) {
      const userDocRef = doc(db, "Users", userId);
      updateDoc(userDocRef, {
        [`trainings.${trainingKey}.trainingFeedback`]: trainingFeedback.trim(),
      })
        .then(() => {
          Toast.show({
            type: "success",
            text1: strings.feedbackSaved,
            position: "top",
            visibilityTime: 2000,
          });
          setFeedbackModalVisible(false);
        })
        .catch((error) => console.error("Error saving feedback:", error));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackButton}
          style={[styles.btnBack, { backgroundColor: primaryColor }]}
        >
          <AntDesign name="caret-left" size={24} color="black" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{trainingName || strings.title}</Text>
        </View>
        {!isAdmin &&
          exercisesList.length > 0 &&
          (Object.values(completedExercises).filter(Boolean).length > 0 ||
            Object.values(repsCompleted).filter((val) => val > 0).length >
              0) && (
            <Animated.View
              entering={ZoomIn.duration(300).springify()}
              exiting={ZoomOut.duration(300)}
              style={styles.btnReset}
            >
              <Animated.View style={resetButtonStyle}>
                <TouchableOpacity
                  onPress={resetAllTraining}
                  style={styles.btnResetInner}
                >
                  <AntDesign name="reload" size={20} color="white" />
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          )}
      </View>

      {exercisesList.length > 0 && (
        <View style={styles.progressBarContainer}>
          {trainingSets > 1 && (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={styles.trainingSetsContainer}
            >
              <View style={styles.trainingSetsInner}>
                <View
                  style={[
                    styles.trainingSetsIconContainer,
                    { backgroundColor: primaryColor + "15" },
                  ]}
                >
                  <AntDesign name="area-chart" size={20} color={primaryColor} />
                </View>
                <View style={styles.trainingSetsTextContainer}>
                  <Text style={styles.trainingSetsLabel}>
                    {strings.trainingSet}
                  </Text>
                  <View
                    style={[
                      styles.trainingSetsCounter,
                      { backgroundColor: primaryColor + "10" },
                    ]}
                  >
                    <Text style={styles.trainingSetsTotalNumber}>
                      {trainingSets}
                    </Text>
                    <Text style={styles.trainingSetsSeparator}>/</Text>
                    <Text
                      style={[
                        styles.trainingSetsCurrentNumber,
                        { color: primaryColor },
                      ]}
                    >
                      {trainingRepsCompleted}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
          <Animated.View
            entering={FadeIn.duration(400).delay(200)}
            style={styles.progressBarBackground}
          >
            <Animated.View
              style={[
                styles.progressBarFill,
                { backgroundColor: primaryColor },
                progressBarStyle,
              ]}
            >
              {roundedProgress > 0 && (
                <Text
                  style={[
                    styles.progressBarText,
                    { color: roundedProgress <= 3 ? "#000" : "#fff" },
                  ]}
                >
                  {roundedProgress}%
                </Text>
              )}
            </Animated.View>
          </Animated.View>

          {source !== "archive" && params.scheduledDay && (
            <Animated.Text style={styles.scheduledDay}>
              {strings.scheduledFor} {params.scheduledDay}
            </Animated.Text>
          )}
          {isTimerRunning && (
            <Animated.View
              entering={ZoomIn.duration(300).springify()}
              exiting={ZoomOut.duration(300)}
              style={[styles.restTimerContainer, { borderColor: primaryColor }]}
            >
              <AntDesign name="pause-circle" size={18} color={primaryColor} />
              <Text style={styles.restTimerLabel}>{strings.restTimer}</Text>
              <Text style={[styles.restTimerValue, { color: primaryColor }]}>
                {formatTime(restTimerSeconds)}
              </Text>
            </Animated.View>
          )}
        </View>
      )}

      {!isAdmin &&
        source !== "archive" &&
        exercisesList.length > 0 &&
        (!hasStartedWorkout ? (
          <Animated.View
            entering={FadeIn.duration(600)}
            style={styles.startWorkoutContainer}
          >
            <TouchableOpacity
              style={[
                styles.startWorkoutButton,
                { backgroundColor: primaryColor },
              ]}
              onPress={() => {
                setHasStartedWorkout(true);
                setIsOverallTimerRunning(true);
              }}
              activeOpacity={0.82}
            >
              <AntDesign name="play-circle" size={26} color="#fff" />
              <Text style={styles.startWorkoutText}>
                {strings.startWorkout}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={[
              styles.overallTimerContainer,
              { borderColor: primaryColor + "40" },
            ]}
          >
            <AntDesign name="clock-circle" size={18} color={primaryColor} />
            <Text style={styles.overallTimerLabel}>
              {strings.workoutDuration}
            </Text>
            <Text style={[styles.overallTimerValue, { color: primaryColor }]}>
              {formatTime(overallTimerSeconds)}
            </Text>
          </Animated.View>
        ))}

      {!isAdmin &&
        isTrainingComplete &&
        trainingRepsCompleted >= trainingSets && (
          <Animated.View
            entering={ZoomIn.duration(400).delay(300).springify()}
            exiting={ZoomOut.duration(300)}
            style={styles.feedbackButtonContainer}
          >
            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={() => setFeedbackModalVisible(true)}
            >
              <AntDesign name="message" size={18} color={primaryColor} />
              <Text style={styles.feedbackButtonText}>
                {strings.giveFeedback}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      {isAdmin && trainingFeedback && trainingFeedback.trim() !== "" && (
        <Animated.View
          entering={ZoomIn.duration(400).delay(300).springify()}
          exiting={ZoomOut.duration(300)}
          style={styles.feedbackDisplayContainer}
        >
          <View style={styles.feedbackDisplayHeader}>
            <AntDesign name="message" size={18} color={primaryColor} />
            <Text style={styles.feedbackDisplayTitle}>
              {strings.studentFeedbackFrom}
              {studentData?.name || strings.student}
            </Text>
          </View>
          <Text
            style={[
              styles.feedbackDisplayText,
              { borderLeftColor: primaryColor },
            ]}
          >
            {trainingFeedback}
          </Text>
        </Animated.View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={primaryColor}
          style={styles.activityIndicator}
        />
      ) : exercisesList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{strings.noExercises}</Text>
          <Text style={styles.emptySubText}>{strings.noExercisesHint}</Text>
        </View>
      ) : (
        <FlatList
          data={exercisesList}
          renderItem={({ item, index }) => {
            const isInSet = item.setId !== null;
            const isFirstInSet =
              isInSet &&
              exercisesList.find((ex) => ex.setId === item.setId)?.id ===
                item.id;
            const exercisesInSet = isInSet
              ? exercisesList.filter((ex) => ex.setId === item.setId)
              : [];
            const isLastInSet =
              isInSet &&
              exercisesInSet[exercisesInSet.length - 1]?.id === item.id;

            // Check if this set has completed all reps
            const isSetFullyCompleted =
              isInSet &&
              (item.setReps
                ? repsCompleted[item.setId] >= parseInt(item.setReps)
                : exercisesInSet.length > 0 &&
                  exercisesInSet.every(
                    (ex) => completedExercises[ex.id] === true,
                  ));

            // Check if should disable (training complete or set fully completed)
            const isDisabled = isTrainingComplete || isSetFullyCompleted;

            // Timer should only start after the last unchecked exercise in the set is tapped
            const willCompleteSet =
              isInSet &&
              !completedExercises[item.id] &&
              exercisesInSet.every(
                (ex) => ex.id === item.id || completedExercises[ex.id] === true,
              );

            return (
              <View>
                {isFirstInSet && (
                  <View
                    style={[
                      styles.setHeader,
                      { backgroundColor: primaryColor },
                    ]}
                  >
                    <View style={styles.setHeaderContent}>
                      <Text style={styles.setHeaderText}>{item.setType}</Text>
                      {item.setReps && (
                        <View style={styles.setRepsProgressContainer}>
                          <View style={styles.setRepsProgressBackground}>
                            <View
                              style={[
                                styles.setRepsProgressFill,
                                {
                                  width: `${Math.min(
                                    ((repsCompleted[item.setId] || 0) /
                                      parseInt(item.setReps)) *
                                      100,
                                    100,
                                  )}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.setRepsProgressText}>
                            {repsCompleted[item.setId] || 0}/{item.setReps}
                          </Text>
                        </View>
                      )}
                    </View>
                    {!isAdmin &&
                      (repsCompleted[item.setId] > 0 ||
                        (!item.setReps && isSetFullyCompleted)) && (
                        <Animated.View
                          entering={ZoomIn.duration(300).springify()}
                          exiting={ZoomOut.duration(300)}
                          style={styles.resetButton}
                        >
                          <Animated.View style={resetButtonStyleSet}>
                            <TouchableOpacity
                              style={styles.resetButtonInner}
                              onPress={() => resetSetReps(item.setId)}
                            >
                              <AntDesign name="reload" size={16} color="#fff" />
                            </TouchableOpacity>
                          </Animated.View>
                        </Animated.View>
                      )}
                  </View>
                )}
                <View
                  style={[
                    isInSet && styles.setExerciseWrapper,
                    isInSet && { borderColor: primaryColor },
                    isFirstInSet && styles.setExerciseFirst,
                    isLastInSet && styles.setExerciseLast,
                  ]}
                >
                  <StudentTrainingShowCard
                    item={item}
                    index={index}
                    completedExercises={completedExercises}
                    exerciseRemarks={exerciseRemarks}
                    trainerRemarks={trainerRemarks}
                    toggleExerciseCompletion={toggleExerciseCompletion}
                    saveExerciseRemark={saveExerciseRemark}
                    saveTrainerRemark={saveTrainerRemark}
                    openExerciseDetails={openExerciseDetails}
                    isInSet={isInSet}
                    isSetFullyCompleted={isSetFullyCompleted}
                    isDisabled={isDisabled}
                    exerciseRepsDone={exerciseRepsDone}
                    saveExerciseRepsDone={saveExerciseRepsDone}
                    willCompleteSet={willCompleteSet}
                    startRestTimer={() => {
                      setRestTimerSeconds(0);
                      setIsTimerRunning(true);
                    }}
                    stopRestTimer={() => {
                      setIsTimerRunning(false);
                      setRestTimerSeconds(0);
                    }}
                    userId={userId}
                    trainingKey={
                      source === "archive" && originalTrainingKey
                        ? originalTrainingKey
                        : trainingKey
                    }
                    archiveDocId={source === "archive" ? trainingKey : null}
                  />
                </View>
              </View>
            );
          }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {selectedExercise && (
            <ExerciseDetails
              training={true}
              item={selectedExercise}
              onClose={() => setModalVisible(false)}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={feedbackModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.feedbackModalOverlay}
        >
          <View style={styles.feedbackModalContent}>
            <View style={styles.feedbackModalHeader}>
              <Text style={styles.feedbackModalTitle}>
                {strings.feedbackTitle}
              </Text>
              <TouchableOpacity
                onPress={() => setFeedbackModalVisible(false)}
                style={styles.feedbackModalClose}
              >
                <AntDesign name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.feedbackModalSubtitle}>
              {strings.feedbackSubtitle}
            </Text>
            <TextInput
              style={styles.feedbackInput}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              placeholder={strings.feedbackPlaceholder}
              value={trainingFeedback}
              onChangeText={setTrainingFeedback}
              textAlign="right"
            />
            <View style={styles.feedbackModalButtons}>
              <TouchableOpacity
                style={[
                  styles.feedbackSaveButton,
                  { backgroundColor: primaryColor },
                ]}
                onPress={saveTrainingFeedback}
              >
                <Text style={styles.feedbackSaveButtonText}>
                  {strings.save}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.feedbackCancelButton}
                onPress={() => setFeedbackModalVisible(false)}
              >
                <Text style={styles.feedbackCancelButtonText}>
                  {strings.cancel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const strings = {
  title: "אימון",
  noExercises: "אין תרגילים באימון זה",
  noExercisesHint: "פנה למאמן שלך להוספת תרגילים",
  error: "שגיאה",
  loadError: "לא הצלחנו לטעון את התרגילים",
  noData: "לא נמצאו נתונים",
  noTraining: "האימון לא נמצא",
  trainingCompleted: "האימון הושלם!",
  congratulations: "כל הכבוד!",
  workoutCompleted: "סיימת את האימון בהצלחה!",
  leavingTitle: "כבר עוזב/ת?",
  leavingMessage: "להמשיך את האימון בפעם הבאה?",
  ok: "אישור",
  cancel: "ביטול",
  yes: "כן",
  no: "לא",
  restTimer: "זמן מנוחה",
  setRepsLabel: "חזרות",
  setCompletedTitle: "סיימת סט!",
  setCompletedMessage: "האם ברצונך להמשיך?",
  setFullyCompletedTitle: "כל הכבוד!",
  setFullyCompletedMessage: "סיימת את הסט בהצלחה!",
  setCompletedToast: "סיימת סט!",
  setsRemaining: "סטים נותרו",
  resetSetTitle: "איפוס סט",
  resetSetMessage: "האם אתה בטוח שברצונך לאפס את מונה הסטים?",
  resetAllTitle: "איפוס אימון",
  resetAllMessage: "אל דאגה, זה לא ישפיע על ההתקדמות שלך.",
  trainingReset: "האימון אופס בהצלחה",
  trainingFullyCompleted: "מזל טוב!",
  trainingFullyCompletedMessage: "סיימת את כל האימון בהצלחה!",
  trainingSet: "אימון",
  trainingSetCompleted: "סיימת אימון!",
  trainingSetsRemaining: "אימונים נותרו",
  giveFeedback: "שתף משוב למאמן",
  studentFeedbackFrom: "משוב מ",
  student: "המתאמן",
  feedbackTitle: "משוב על האימון",
  feedbackSubtitle: "ספר למאמן שלך איך היה האימון",
  feedbackPlaceholder: "כתוב כאן את המשוב שלך על האימון...",
  save: "שמור",
  feedbackSaved: "המשוב נשמר בהצלחה",
  scheduledFor: "אימון יום",
  startWorkout: "התחל אימון",
  workoutDuration: "זמן אימון",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  activityIndicator: {
    marginTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 10,
  },
  titleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 25,
    fontWeight: "600",
  },
  scheduledDay: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
    marginTop: 2,
    textAlign: "right",
  },
  btnBack: {
    left: 10,
    position: "absolute",
    backgroundColor: Colors.PRIMARY,
    width: hp(4.8),
    height: hp(4.8),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 99,
  },
  btnReset: {
    right: 10,
    position: "absolute",
    backgroundColor: "#ff6b6b",
    width: hp(4.8),
    height: hp(4.8),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 99,
  },
  btnResetInner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
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
    paddingHorizontal: 0,
    paddingVertical: 15,
    paddingBottom: 30,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "#f1f1f1",
  },
  progressBarContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  trainingSetsContainer: {
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  trainingSetsInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  trainingSetsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.PRIMARY}15`,
    justifyContent: "center",
    alignItems: "center",
  },
  trainingSetsTextContainer: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trainingSetsLabel: {
    fontSize: hp(1.9),
    fontWeight: "600",
    color: "#404040",
  },
  trainingSetsCounter: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    backgroundColor: `${Colors.PRIMARY}10`,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  trainingSetsCurrentNumber: {
    fontSize: hp(2.4),
    fontWeight: "800",
    color: Colors.PRIMARY,
  },
  trainingSetsSeparator: {
    fontSize: hp(2),
    fontWeight: "600",
    color: "#999",
    marginHorizontal: 4,
  },
  trainingSetsTotalNumber: {
    fontSize: hp(2),
    fontWeight: "700",
    color: "#666",
  },
  progressBarBackground: {
    height: hp(2.4),
    backgroundColor: "#e0e0e0",
    borderRadius: hp(1.2),
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.PRIMARY,
    borderRadius: hp(1.2),
    justifyContent: "center",
  },
  progressBarText: {
    position: "absolute",
    right: 5,
    fontSize: 10,
    fontWeight: "800",
    includeFontPadding: false,
  },
  restTimerContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.PRIMARY,
  },
  restTimerLabel: {
    flex: 1,
    fontSize: hp(1.6),
    color: "#666",
    fontWeight: "600",
    textAlign: "right",
  },
  restTimerValue: {
    fontSize: hp(2.2),
    color: Colors.PRIMARY,
    fontWeight: "700",
  },
  startWorkoutContainer: {
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  startWorkoutButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: hp(2),
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  startWorkoutText: {
    color: "#fff",
    fontSize: hp(2.3),
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  overallTimerContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 15,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  overallTimerLabel: {
    flex: 1,
    fontSize: hp(1.8),
    fontWeight: "600",
    color: "#444",
    textAlign: "right",
  },
  overallTimerValue: {
    fontSize: hp(2.4),
    fontWeight: "800",
    letterSpacing: 1,
  },
  setHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    marginTop: 8,
    marginHorizontal: 15,
    position: "relative",
  },
  setHeaderContent: {
    flex: 1,
    alignItems: "center",
  },
  setHeaderText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 5,
  },
  setRepsProgressContainer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    width: "80%",
    gap: 6,
  },
  setRepsProgressBackground: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 3,
    overflow: "hidden",
  },
  setRepsProgressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 3,
  },
  setRepsProgressText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "right",
  },
  resetButton: {
    position: "absolute",
    left: 12,
    padding: 6,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  resetButtonInner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  setExerciseWrapper: {
    marginLeft: 15,
    marginRight: 15,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.PRIMARY,
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 0,
  },
  setExerciseFirst: {
    marginTop: 0,
    paddingTop: 8,
  },
  setExerciseLast: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 3,
    marginBottom: 8,
    paddingBottom: 8,
  },
  feedbackButtonContainer: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  feedbackButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  feedbackButtonText: {
    fontSize: hp(1.9),
    fontWeight: "700",
  },
  feedbackDisplayContainer: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  feedbackDisplayHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  feedbackDisplayTitle: {
    fontSize: hp(2),
    fontWeight: "700",
  },
  feedbackDisplayText: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    fontSize: hp(1.8),
    color: "#333",
    textAlign: "right",
    lineHeight: hp(2.6),
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: Colors.PRIMARY,
  },
  feedbackModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  feedbackModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  feedbackModalHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  feedbackModalTitle: {
    fontSize: hp(2.5),
    fontWeight: "700",
    color: "#1a1a1a",
  },
  feedbackModalClose: {
    padding: 4,
  },
  feedbackModalSubtitle: {
    fontSize: hp(1.7),
    color: "#666",
    marginBottom: 15,
    textAlign: "right",
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    fontSize: hp(1.8),
    minHeight: 150,
    backgroundColor: "#f9f9f9",
    marginBottom: 20,
  },
  feedbackModalButtons: {
    flexDirection: "row-reverse",
    gap: 10,
  },
  feedbackSaveButton: {
    flex: 1,
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  feedbackSaveButtonText: {
    color: "#fff",
    fontSize: hp(1.9),
    fontWeight: "700",
  },
  feedbackCancelButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  feedbackCancelButtonText: {
    color: "#666",
    fontSize: hp(1.9),
    fontWeight: "600",
  },
});
