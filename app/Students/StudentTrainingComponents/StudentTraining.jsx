import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEffect, useState, useMemo } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  addDoc,
  deleteField,
  deleteDoc,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../../configs/FirebaseConfig";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "../../../constants/Colors";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import StudentTrainingCard from "./StudentTrainingCard";
import StudentTrainingBodyPartList from "./StudentTrainingBodyPartList";
import StudentHeaderPage from "../StudentHeaderPage";
import { useTheme } from "../../../components/ThemeContext";
import Toast from "react-native-toast-message";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";
import { useUser } from "@clerk/clerk-expo";
import Ionicons from "@expo/vector-icons/Ionicons";

// Generate random ID for sets and trainings
const generateRandomId = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function StudentTraining() {
  const router = useRouter();
  const { primaryColor } = useTheme();
  const { user } = useUser();
  const item = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exercisesList, setExercisesList] = useState([]);
  const [bodyPartsData, setBodyPartsData] = useState({});
  const [trainings, setTrainings] = useState({});
  const [showTrainingsModal, setShowTrainingsModal] = useState(false);
  const [currentTrainingKey, setCurrentTrainingKey] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [editingSetId, setEditingSetId] = useState(null);
  const [originalExercisesBeforeEdit, setOriginalExercisesBeforeEdit] =
    useState([]);
  const [expandedExerciseId, setExpandedExerciseId] = useState(null);
  const [isCreatingTraining, setIsCreatingTraining] = useState(false);
  const [tempTrainingName, setTempTrainingName] = useState("");
  const [tempTrainingExercises, setTempTrainingExercises] = useState([]);
  const [tempTrainingSets, setTempTrainingSets] = useState(1);
  const [
    fullExercisesListBeforeFiltering,
    setFullExercisesListBeforeFiltering,
  ] = useState([]);
  const [showSetRepsModal, setShowSetRepsModal] = useState(false);
  const [setRepsInputValue, setSetRepsInputValue] = useState("");
  const [setRepsCallback, setSetRepsCallback] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [trainingToDelete, setTrainingToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExistingInExercisesList, setShowExistingInExercisesList] =
    useState(true);
  const [isNewTraining, setIsNewTraining] = useState(false);
  const [generalTrainingDocIds, setGeneralTrainingDocIds] = useState({});
  const isGeneralMode = !item.id;

  const navigation = useNavigation();

  useEffect(() => {
    if (!isCreatingTraining) return;

    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
      Alert.alert(strings.goBackConfirmTitle, strings.goBackConfirmMessage, [
        { text: strings.no, style: "cancel" },
        {
          text: strings.yes,
          style: "destructive",
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });

    return unsubscribe;
  }, [isCreatingTraining, navigation]);

  useEffect(() => {
    LoadStudentExercises();
    LoadUserTrainings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Load body parts when entering creation mode
    if (isCreatingTraining && Object.keys(bodyPartsData).length === 0) {
      loadBodyParts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreatingTraining]);

  const loadBodyParts = async () => {
    try {
      const q = query(collection(db, "BodyParts"));
      const querySnapshot = await getDocs(q);
      const bodyParts = {};
      querySnapshot.forEach((doc) => {
        bodyParts[doc.id] = { id: doc.id, ...doc.data() };
      });
      setBodyPartsData(bodyParts);
    } catch (error) {
      console.error("Error loading body parts:", error);
    }
  };

  const updateTrainingsArchive = async (trainingKey, updates) => {
    if (isGeneralMode) {
      const docId = generalTrainingDocIds[trainingKey];
      if (docId) {
        await updateDoc(doc(db, "Trainings", docId), {
          ...updates,
          updatedAt: new Date(),
        });
      }
    } else {
      // Query only by originalTrainingKey (single-field index, no composite index needed)
      // then verify user ownership client-side
      const snap = await getDocs(
        query(
          collection(db, "Trainings"),
          where("originalTrainingKey", "==", trainingKey),
        ),
      );
      const matchingDoc = snap.docs.find((d) => {
        const data = d.data();
        return data.userIds?.includes(item.id) || data.userId === item.id;
      });
      if (matchingDoc) {
        await updateDoc(doc(db, "Trainings", matchingDoc.id), {
          ...updates,
          updatedAt: new Date(),
        });
      }
    }
  };

  const LoadStudentExercises = async () => {
    if (isGeneralMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Get student's trainings
      const userRef = doc(db, "Users", item.id);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        Alert.alert(strings.error, strings.studentNotFound);
        setLoading(false);
        return;
      }

      const userData = userSnap.data();
      const userTrainings = userData.trainings || {};

      // Check if there are any trainings
      if (Object.keys(userTrainings).length === 0) {
        setLoading(false);
        return;
      }

      // Get all body parts data
      const q = query(collection(db, "BodyParts"));
      const querySnapshot = await getDocs(q);
      const bodyParts = {};
      querySnapshot.forEach((doc) => {
        bodyParts[doc.id] = { id: doc.id, ...doc.data() };
      });
      setBodyPartsData(bodyParts);

      // Get the first available training
      const trainingKeys = Object.keys(userTrainings).filter((key) =>
        key.startsWith("training"),
      );

      const firstTrainingKey = trainingKeys[0];
      if (firstTrainingKey) {
        const trainingData = userTrainings[firstTrainingKey];

        // Build exercises list from training order
        const exercises = [];
        trainingData.exercises.forEach((orderItem) => {
          const {
            bodyPartId,
            exerciseIndex,
            setId,
            setType,
            numOfSets,
            weight,
            numOfReps,
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
              setId: setId || null,
              setType: setType || null,
              numOfSets: numOfSets || null,
              weight: weight || null,
              numOfReps: numOfReps || null,
              setReps: setReps || null,
              ...exercise,
            });
          }
        });

        setExercisesList(exercises);
        setCurrentTrainingKey(firstTrainingKey);
      }
    } catch (error) {
      console.error("Error loading exercises:", error);
      Alert.alert(strings.error, strings.loadError);
    } finally {
      setLoading(false);
    }
  };

  // Load existing trainings for the user
  const LoadUserTrainings = async () => {
    if (isGeneralMode) {
      try {
        const q = query(
          collection(db, "Trainings"),
          where("isGeneral", "==", true),
        );
        const snap = await getDocs(q);
        const generalTrainings = {};
        const docIds = {};
        snap.forEach((d) => {
          const data = d.data();
          const key = data.originalTrainingKey;
          if (!key) return;
          generalTrainings[key] = {
            name: data.name,
            exercises: data.exercises || [],
            trainingSets: data.trainingSets || 1,
          };
          docIds[key] = d.id;
        });
        setTrainings(generalTrainings);
        setGeneralTrainingDocIds(docIds);
        return generalTrainings;
      } catch (error) {
        console.error("Error loading general trainings:", error);
        return {};
      }
    }
    try {
      const userRef = doc(db, "Users", item.id);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.trainings) {
          setTrainings(userData.trainings);
          return userData.trainings;
        }
      }
      return {};
    } catch (error) {
      console.error("Error loading user trainings:", error);
      Alert.alert(strings.error, strings.loadError, [{ text: strings.ok }]);
      return {};
    }
  };

  // Load exercises for a specific training
  const LoadTrainingExercises = async (trainingKey) => {
    setLoading(true);
    try {
      const trainingData = trainings[trainingKey];
      if (!trainingData) return;

      // Get all body parts data if not already loaded
      let bodyParts = bodyPartsData;
      if (Object.keys(bodyParts).length === 0) {
        const q = query(collection(db, "BodyParts"));
        const querySnapshot = await getDocs(q);
        bodyParts = {};
        querySnapshot.forEach((doc) => {
          bodyParts[doc.id] = { id: doc.id, ...doc.data() };
        });
        setBodyPartsData(bodyParts);
      }

      // Build exercises list from training order
      const exercises = [];
      trainingData.exercises.forEach((orderItem) => {
        const {
          bodyPartId,
          exerciseIndex,
          setId,
          setType,
          numOfSets,
          weight,
          numOfReps,
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
            setId: setId || null,
            setType: setType || null,
            numOfSets: numOfSets || null,
            weight: weight || null,
            numOfReps: numOfReps || null,
            setReps: setReps || null,
            ...exercise,
          });
        }
      });

      setExercisesList(exercises);
      setCurrentTrainingKey(trainingKey);
      setShowTrainingsModal(false);
    } catch (error) {
      console.error("Error loading training exercises:", error);
      Alert.alert(strings.error, strings.loadError, [{ text: strings.ok }]);
    } finally {
      setLoading(false);
    }
  };

  // Get sorted training keys
  const getSortedTrainingKeys = () => {
    return Object.keys(trainings).filter((key) => key.startsWith("training"));
  };

  const handleViewTrainings = () => {
    if (Object.keys(trainings).length === 0) {
      Alert.alert(strings.info, strings.noTrainingsAvailable, [
        { text: strings.ok },
      ]);
      return;
    }
    setShowTrainingsModal(true);
  };

  const handleCreateTrainingFromBodyPart = async (bodyPart, trainingName) => {
    if (!trainingName || trainingName.trim() === "") {
      Alert.alert(strings.error, strings.pleaseEnterTrainingName, [
        { text: strings.ok },
      ]);
      return;
    }

    const trimmedName = trainingName.trim();

    // If in edit mode and name changed, update it in the database
    if (currentTrainingKey && trainings[currentTrainingKey]) {
      await updateTrainingName(trimmedName);
    }

    // Store training name temporarily
    setTempTrainingName(trimmedName);

    // Build exercises list
    const displayExercises = [];

    // First, show all exercises already added to training (from ALL body parts)
    for (const tempEx of tempTrainingExercises) {
      const tempBodyPart = bodyPartsData[tempEx.bodyPartId];
      if (
        tempBodyPart &&
        tempBodyPart.exercises &&
        tempBodyPart.exercises[tempEx.exerciseIndex]
      ) {
        const exercise = tempBodyPart.exercises[tempEx.exerciseIndex];
        const exerciseId = `${tempEx.bodyPartId}-${tempEx.exerciseIndex}`;

        displayExercises.push({
          id: exerciseId,
          bodyPartId: tempEx.bodyPartId,
          exerciseIndex: tempEx.exerciseIndex,
          bodyPartName: tempBodyPart.bodyPart,
          setId: tempEx.setId || null,
          setType: tempEx.setType || null,
          setReps: tempEx.setReps || null,
          numOfSets: tempEx.numOfSets || null,
          weight: tempEx.weight || null,
          numOfReps: tempEx.numOfReps || null,
          ...exercise,
        });
      }
    }

    // Then, show exercises from the selected body part (if not already displayed)
    if (bodyPart.exercises && bodyPart.exercises.length > 0) {
      bodyPart.exercises.forEach((exercise, index) => {
        const exerciseId = `${bodyPart.id}-${index}`;

        // Check if this exercise is already in the display list
        const alreadyDisplayed = displayExercises.find(
          (ex) => ex.id === exerciseId,
        );

        if (!alreadyDisplayed) {
          // Check if this exercise is already in the training
          const existingInTraining = tempTrainingExercises.find(
            (ex) => ex.bodyPartId === bodyPart.id && ex.exerciseIndex === index,
          );

          displayExercises.push({
            id: exerciseId,
            bodyPartId: bodyPart.id,
            exerciseIndex: index,
            bodyPartName: bodyPart.bodyPart,
            setId: existingInTraining?.setId || null,
            setType: existingInTraining?.setType || null,
            numOfSets: existingInTraining?.numOfSets || null,
            weight: existingInTraining?.weight || null,
            numOfReps: existingInTraining?.numOfReps || null,
            ...exercise,
          });
        }
      });
    }

    setExercisesList(displayExercises);
    // Stay in creation mode - don't set to false
  };

  const handleToggleExerciseInTraining = async (exercise) => {
    const exerciseData = {
      bodyPartId: exercise.bodyPartId,
      exerciseIndex: exercise.exerciseIndex,
      setId: null,
      setType: null,
    };

    const exists = tempTrainingExercises.find(
      (ex) =>
        ex.bodyPartId === exerciseData.bodyPartId &&
        ex.exerciseIndex === exerciseData.exerciseIndex,
    );

    try {
      setSaving(true);

      if (exists) {
        // Remove from training
        let baseExercises = tempTrainingExercises;
        if (!isGeneralMode) {
          const userRef = doc(db, "Users", item.id);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const freshExercises =
              userSnap.data()?.trainings?.[currentTrainingKey]?.exercises;
            if (freshExercises) {
              baseExercises = freshExercises;
            }
          }
        }

        const updatedExercises = baseExercises.filter(
          (ex) =>
            !(
              ex.bodyPartId === exerciseData.bodyPartId &&
              ex.exerciseIndex === exerciseData.exerciseIndex
            ),
        );

        if (!isGeneralMode) {
          const removedExerciseId = `${exerciseData.bodyPartId}-${exerciseData.exerciseIndex}`;
          const userRef = doc(db, "Users", item.id);
          await updateDoc(userRef, {
            [`trainings.${currentTrainingKey}.exercises`]: updatedExercises,
            [`graphs.${currentTrainingKey}.${removedExerciseId}`]:
              deleteField(),
          });
        }

        await updateTrainingsArchive(currentTrainingKey, {
          exercises: updatedExercises,
        });
        setTempTrainingExercises(updatedExercises);

        // Update trainings state
        setTrainings((prev) => ({
          ...prev,
          [currentTrainingKey]: {
            ...prev[currentTrainingKey],
            exercises: updatedExercises,
          },
        }));

        Toast.show({
          type: "success",
          text1: strings.exerciseRemoved,
          visibilityTime: 1500,
          topOffset: 60,
        });
      } else {
        // Add to training
        const updatedExercises = [...tempTrainingExercises, exerciseData];

        // If this is the first exercise, create the training with a unique ID
        if (tempTrainingExercises.length === 0) {
          // Generate a unique training ID
          let newTrainingKey;
          do {
            newTrainingKey = `training_${generateRandomId()}`;
          } while (trainings[newTrainingKey]); // Ensure it doesn't exist

          if (!isGeneralMode) {
            const userRef = doc(db, "Users", item.id);
            await updateDoc(userRef, {
              [`trainings.${newTrainingKey}`]: {
                name: tempTrainingName,
                exercises: updatedExercises,
                trainingSets: tempTrainingSets || 1,
              },
            });
          }

          const newDocRef = await addDoc(collection(db, "Trainings"), {
            ...(isGeneralMode
              ? { isGeneral: true }
              : { userIds: [item.id], userName: item.name }),
            originalTrainingKey: newTrainingKey,
            name: tempTrainingName,
            exercises: updatedExercises,
            trainingSets: tempTrainingSets || 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          if (isGeneralMode) {
            setGeneralTrainingDocIds((prev) => ({
              ...prev,
              [newTrainingKey]: newDocRef.id,
            }));
          }

          // Update local states
          setCurrentTrainingKey(newTrainingKey);
          setTrainings((prev) => ({
            ...prev,
            [newTrainingKey]: {
              name: tempTrainingName,
              exercises: updatedExercises,
              trainingSets: tempTrainingSets || 1,
            },
          }));

          Toast.show({
            type: "success",
            text1: strings.trainingCreatedSuccess,
            visibilityTime: 2000,
            topOffset: 60,
          });
        } else {
          // Update existing training
          let baseExercises = tempTrainingExercises;
          if (!isGeneralMode) {
            const userRef = doc(db, "Users", item.id);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const freshExercises =
                userSnap.data()?.trainings?.[currentTrainingKey]?.exercises;
              if (freshExercises) {
                baseExercises = freshExercises;
              }
            }
          }

          const freshUpdatedExercises = [...baseExercises, exerciseData];

          if (!isGeneralMode) {
            const userRef = doc(db, "Users", item.id);
            await updateDoc(userRef, {
              [`trainings.${currentTrainingKey}.exercises`]:
                freshUpdatedExercises,
            });
          }

          await updateTrainingsArchive(currentTrainingKey, {
            exercises: freshUpdatedExercises,
          });

          // Update trainings state
          setTrainings((prev) => ({
            ...prev,
            [currentTrainingKey]: {
              ...prev[currentTrainingKey],
              exercises: freshUpdatedExercises,
            },
          }));

          Toast.show({
            type: "success",
            text1: strings.exerciseAdded,
            visibilityTime: 1500,
            topOffset: 60,
          });

          // Sync tempTrainingExercises with the fresh data from Firebase
          setTempTrainingExercises(freshUpdatedExercises);
          return; // skip the setTempTrainingExercises below
        }

        setTempTrainingExercises(updatedExercises);
      }
    } catch (error) {
      console.error("Error updating training:", error);
      Alert.alert(strings.error, strings.saveError);
    } finally {
      setSaving(false);
    }
  };

  const isExerciseInTraining = (exercise) => {
    return tempTrainingExercises.some(
      (ex) =>
        ex.bodyPartId === exercise.bodyPartId &&
        ex.exerciseIndex === exercise.exerciseIndex,
    );
  };

  const toggleSelectionMode = () => {
    // Check if in creation mode and not enough exercises added
    if (isCreatingTraining && tempTrainingExercises.length < 2) {
      Toast.show({
        type: "error",
        text1: strings.addAtLeastTwoExercises,
        visibilityTime: 2000,
        topOffset: 60,
      });
      return;
    }

    if (selectionMode) {
      // Exiting selection mode
      if (editingSetId) {
        // Restore original state if canceling an edit
        setExercisesList(originalExercisesBeforeEdit);
        setEditingSetId(null);
        setOriginalExercisesBeforeEdit([]);
      }

      // Restore the full list if we filtered it
      if (fullExercisesListBeforeFiltering.length > 0) {
        // Merge changes from current exercisesList back into the full list
        const updatedFullList = fullExercisesListBeforeFiltering.map(
          (fullExercise) => {
            const updatedExercise = exercisesList.find(
              (ex) => ex.id === fullExercise.id,
            );
            return updatedExercise || fullExercise;
          },
        );

        setExercisesList(updatedFullList);
        setFullExercisesListBeforeFiltering([]);
      }

      setSelectionMode(false);
      setSelectedExercises([]);
    } else {
      // Entering selection mode
      if (isCreatingTraining) {
        // In creation mode, filter to show only exercises added to training
        setFullExercisesListBeforeFiltering([...exercisesList]);

        const filteredExercises = exercisesList.filter((exercise) => {
          return tempTrainingExercises.some(
            (ex) =>
              ex.bodyPartId === exercise.bodyPartId &&
              ex.exerciseIndex === exercise.exerciseIndex,
          );
        });

        setExercisesList(filteredExercises);
      }

      setSelectionMode(true);
    }
  };

  const handleBackToBodyParts = () => {
    // Clear exercises list to show body parts again
    // Preserve tempTrainingName and tempTrainingExercises
    setExercisesList([]);
  };

  const handleOpenSetCreationFromBodyPartsView = () => {
    // Build exercisesList from only the exercises already in the training,
    // then enter selection mode so the admin can select and create sets.
    const selectedOnly = tempTrainingExercises
      .map((ex) => {
        const bp = bodyPartsData[ex.bodyPartId];
        if (!bp || !bp.exercises || !bp.exercises[ex.exerciseIndex])
          return null;
        const exercise = bp.exercises[ex.exerciseIndex];
        return {
          id: `${ex.bodyPartId}-${ex.exerciseIndex}`,
          bodyPartId: ex.bodyPartId,
          exerciseIndex: ex.exerciseIndex,
          bodyPartName: bp.bodyPart,
          setId: ex.setId || null,
          setType: ex.setType || null,
          numOfSets: ex.numOfSets || null,
          weight: ex.weight || null,
          numOfReps: ex.numOfReps || null,
          setReps: ex.setReps || null,
          ...exercise,
        };
      })
      .filter(Boolean);
    setExercisesList(selectedOnly);
    setSelectionMode(true);
  };

  const updateTrainingName = async (trimmedName) => {
    if (!currentTrainingKey || !trainings[currentTrainingKey]) {
      return;
    }

    if (trainings[currentTrainingKey].name === trimmedName) {
      return; // No change needed
    }

    try {
      setSaving(true);

      if (!isGeneralMode) {
        const userRef = doc(db, "Users", item.id);
        await updateDoc(userRef, {
          [`trainings.${currentTrainingKey}.name`]: trimmedName,
        });
      }

      await updateTrainingsArchive(currentTrainingKey, { name: trimmedName });

      // Update local state
      setTrainings((prev) => ({
        ...prev,
        [currentTrainingKey]: {
          ...prev[currentTrainingKey],
          name: trimmedName,
        },
      }));

      Toast.show({
        type: "success",
        text1: strings.trainingNameUpdated,
        visibilityTime: 1500,
        topOffset: 60,
      });
    } catch (error) {
      console.error("Error updating training name:", error);
      Alert.alert(strings.error, strings.saveError);
    } finally {
      setSaving(false);
    }
  };

  const updateTrainingSets = async (numSets) => {
    if (!currentTrainingKey || !trainings[currentTrainingKey]) {
      return;
    }

    if (trainings[currentTrainingKey].trainingSets === numSets) {
      return; // No change needed
    }

    try {
      setSaving(true);

      if (!isGeneralMode) {
        const userRef = doc(db, "Users", item.id);
        await updateDoc(userRef, {
          [`trainings.${currentTrainingKey}.trainingSets`]: numSets,
        });
      }

      await updateTrainingsArchive(currentTrainingKey, {
        trainingSets: numSets,
      });

      // Update local state
      setTrainings((prev) => ({
        ...prev,
        [currentTrainingKey]: {
          ...prev[currentTrainingKey],
          trainingSets: numSets,
        },
      }));

      Toast.show({
        type: "success",
        text1: "מספר הסטים עודכן בהצלחה",
        visibilityTime: 1500,
        topOffset: 60,
      });
    } catch (error) {
      console.error("Error updating training sets:", error);
      Alert.alert(strings.error, strings.saveError);
    } finally {
      setSaving(false);
    }
  };

  const initializeTrainingGraphs = async (trainingKey) => {
    if (!trainingKey || isGeneralMode) return;
    try {
      const userRef = doc(db, "Users", item.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const training = userData.trainings?.[trainingKey];
      if (!training?.exercises?.length) return;

      const today = new Date();
      const dateLabel = `${today.getDate()}.${String(today.getMonth() + 1).padStart(2, "0")}`;

      const graphsEntry = {};
      training.exercises.forEach((ex) => {
        const exerciseId = `${ex.bodyPartId}-${ex.exerciseIndex}`;
        graphsEntry[exerciseId] = {
          dates: [dateLabel],
          weights: [ex.weight || 0],
          sets: [ex.numOfSets || 0],
          reps: [ex.numOfReps || 0],
        };
      });

      await updateDoc(userRef, {
        [`graphs.${trainingKey}`]: graphsEntry,
      });
    } catch (error) {
      console.error("Error initializing training graphs:", error);
    }
  };

  const updateTrainingGraphs = async (trainingKey) => {
    if (!trainingKey || isGeneralMode) return;
    try {
      const userRef = doc(db, "Users", item.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const training = userData.trainings?.[trainingKey];
      if (!training?.exercises?.length) return;

      const today = new Date();
      const dateLabel = `${today.getDate()}.${String(today.getMonth() + 1).padStart(2, "0")}`;

      const existingGraphs = userData.graphs?.[trainingKey] || {};
      const updatedGraphs = { ...existingGraphs };

      training.exercises.forEach((ex) => {
        const exerciseId = `${ex.bodyPartId}-${ex.exerciseIndex}`;
        const weight = ex.weight || 0;
        const sets = ex.numOfSets || 0;
        const reps = ex.numOfReps || 0;

        if (updatedGraphs[exerciseId]) {
          const entry = updatedGraphs[exerciseId];
          const lastIdx = entry.dates.length - 1;
          const lastSets = entry.sets[lastIdx] ?? 0;
          const lastWeight = entry.weights[lastIdx] ?? 0;
          const lastReps = entry.reps[lastIdx] ?? 0;

          // Only append if at least one value actually changed
          if (sets !== lastSets || weight !== lastWeight || reps !== lastReps) {
            updatedGraphs[exerciseId] = {
              dates: [...entry.dates, dateLabel],
              weights: [...entry.weights, weight],
              sets: [...entry.sets, sets],
              reps: [...entry.reps, reps],
            };
          }
        } else {
          // Exercise newly added to the training
          updatedGraphs[exerciseId] = {
            dates: [dateLabel],
            weights: [weight],
            sets: [sets],
            reps: [reps],
          };
        }
      });

      await updateDoc(userRef, {
        [`graphs.${trainingKey}`]: updatedGraphs,
      });
    } catch (error) {
      console.error("Error updating training graphs:", error);
    }
  };

  const handleCancelCreation = async () => {
    // If in edit mode and name changed, save it before exiting
    if (tempTrainingName && tempTrainingName.trim() !== "") {
      await updateTrainingName(tempTrainingName.trim());
    }

    if (currentTrainingKey && tempTrainingExercises.length > 0) {
      if (isNewTraining) {
        // Brand-new training — create the initial graphs snapshot
        await initializeTrainingGraphs(currentTrainingKey);
      } else {
        // Editing existing training — append/update graphs for today
        await updateTrainingGraphs(currentTrainingKey);
      }
    }
    setIsNewTraining(false);

    // Refresh trainings metadata from Firebase (name, trainingSets, etc.)
    // Also captures the fresh data to rebuild the exercise list correctly,
    // avoiding stale-closure issues with tempTrainingExercises.
    const freshTrainings = await LoadUserTrainings();

    setIsCreatingTraining(false);
    setTempTrainingName("אימון חדש");
    setTempTrainingSets(1);
    setSearchQuery("");

    if (currentTrainingKey) {
      // Use fresh Firebase data (not stale tempTrainingExercises) so that any
      // numOfSets / weight / numOfReps saved by the card during this session
      // are correctly reflected immediately after finishing creation.
      const freshExercises =
        freshTrainings?.[currentTrainingKey]?.exercises ?? [];

      if (freshExercises.length > 0) {
        const selectedOnly = freshExercises
          .map((ex) => {
            const bp = bodyPartsData[ex.bodyPartId];
            if (!bp || !bp.exercises || !bp.exercises[ex.exerciseIndex])
              return null;
            const exercise = bp.exercises[ex.exerciseIndex];
            return {
              id: `${ex.bodyPartId}-${ex.exerciseIndex}`,
              bodyPartId: ex.bodyPartId,
              exerciseIndex: ex.exerciseIndex,
              bodyPartName: bp.bodyPart,
              setId: ex.setId || null,
              setType: ex.setType || null,
              numOfSets: ex.numOfSets || null,
              weight: ex.weight || null,
              numOfReps: ex.numOfReps || null,
              setReps: ex.setReps || null,
              ...exercise,
            };
          })
          .filter(Boolean);
        setExercisesList(selectedOnly);
      } else {
        // No exercises in the training — clear the list
        setExercisesList([]);
        setCurrentTrainingKey(null);
      }
    } else {
      // No training was created
      setExercisesList([]);
      setCurrentTrainingKey(null);
    }

    setTempTrainingExercises([]);
  };

  const handleStartCreation = () => {
    setIsCreatingTraining(true);
    setIsNewTraining(true);
    setExercisesList([]);
    setTempTrainingName("אימון חדש");
    setTempTrainingExercises([]);
    setTempTrainingSets(1);
    setCurrentTrainingKey(null); // Clear training key for fresh start
    setSearchQuery("");
  };

  const handleEditTraining = () => {
    if (!currentTrainingKey || !trainings[currentTrainingKey]) {
      Alert.alert(strings.error, strings.noTrainingSelected);
      return;
    }
    setIsNewTraining(false);

    // Load current training data into temp state
    const currentTraining = trainings[currentTrainingKey];
    setTempTrainingName(currentTraining.name);
    setTempTrainingExercises(currentTraining.exercises || []);
    setTempTrainingSets(currentTraining.trainingSets || 1);

    // Enter creation mode and clear exercises list to show body parts
    setIsCreatingTraining(true);
    setExercisesList([]);
    setSearchQuery("");
  };

  const handleDeleteTraining = async (trainingKeyToDelete) => {
    setTrainingToDelete(trainingKeyToDelete);
    setShowDeleteModal(true);
  };

  const executeDeleteFromUserOnly = async () => {
    const trainingKeyToDelete = trainingToDelete;
    setShowDeleteModal(false);
    try {
      setSaving(true);

      if (isGeneralMode) {
        const docId = generalTrainingDocIds[trainingKeyToDelete];
        if (docId) await deleteDoc(doc(db, "Trainings", docId));
        setGeneralTrainingDocIds((prev) => {
          const next = { ...prev };
          delete next[trainingKeyToDelete];
          return next;
        });
      } else {
        const userRef = doc(db, "Users", item.id);
        // Remove training from user's trainings (but keep in Trainings archive)
        await updateDoc(userRef, {
          [`trainings.${trainingKeyToDelete}`]: deleteField(),
          [`graphs.${trainingKeyToDelete}`]: deleteField(),
        });

        // Remove this user from the userIds array on the archive doc (if linked)
        const trainingData = trainings[trainingKeyToDelete];
        if (trainingData?.archiveId) {
          await updateDoc(doc(db, "Trainings", trainingData.archiveId), {
            userIds: arrayRemove(item.id),
          });
        } else {
          // Fallback: find archive doc by originalTrainingKey + client-side ownership check
          const archiveSnap = await getDocs(
            query(
              collection(db, "Trainings"),
              where("originalTrainingKey", "==", trainingKeyToDelete),
            ),
          );
          const matchingDocs = archiveSnap.docs.filter((d) => {
            const data = d.data();
            return data.userIds?.includes(item.id) || data.userId === item.id;
          });
          await Promise.all(
            matchingDocs.map((docSnap) =>
              updateDoc(doc(db, "Trainings", docSnap.id), {
                userIds: arrayRemove(item.id),
              }),
            ),
          );
        }
      }

      // Update local state
      const updatedTrainings = { ...trainings };
      delete updatedTrainings[trainingKeyToDelete];
      setTrainings(updatedTrainings);

      // Clear current view if deleting the active training
      if (currentTrainingKey === trainingKeyToDelete) {
        setCurrentTrainingKey(null);
        setExercisesList([]);

        // Load first available training if any exist
        const remainingKeys = Object.keys(updatedTrainings).filter((key) =>
          key.startsWith("training"),
        );
        if (remainingKeys.length > 0) {
          await LoadTrainingExercises(remainingKeys[0]);
        }
      }

      Toast.show({
        type: "success",
        text1: isGeneralMode
          ? strings.trainingDeletedFromBoth
          : strings.trainingDeletedFromUser,
        visibilityTime: 2000,
        topOffset: 60,
      });
    } catch (error) {
      console.error("Error deleting training:", error);
      Alert.alert(strings.error, strings.deleteError);
    } finally {
      setSaving(false);
    }
  };

  const executeDeleteFromUserAndArchive = async () => {
    const trainingKeyToDelete = trainingToDelete;
    setShowDeleteModal(false);
    try {
      setSaving(true);

      if (isGeneralMode) {
        const docId = generalTrainingDocIds[trainingKeyToDelete];
        if (docId) await deleteDoc(doc(db, "Trainings", docId));
        setGeneralTrainingDocIds((prev) => {
          const next = { ...prev };
          delete next[trainingKeyToDelete];
          return next;
        });
      } else {
        const userRef = doc(db, "Users", item.id);
        // Get the user data to find the corresponding archive document
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const trainingData = userData.trainings?.[trainingKeyToDelete];

          // Remove training from user's trainings
          await updateDoc(userRef, {
            [`trainings.${trainingKeyToDelete}`]: deleteField(),
            [`graphs.${trainingKeyToDelete}`]: deleteField(),
          });

          // Find and delete from Trainings collection (archive)
          if (trainingData?.archiveId) {
            await deleteDoc(doc(db, "Trainings", trainingData.archiveId));
          } else {
            // Single-field query (no composite index needed), verify ownership client-side
            const trainingsSnapshot = await getDocs(
              query(
                collection(db, "Trainings"),
                where("originalTrainingKey", "==", trainingKeyToDelete),
              ),
            );
            const matchingDocs = trainingsSnapshot.docs.filter((d) => {
              const data = d.data();
              return data.userIds?.includes(item.id) || data.userId === item.id;
            });
            await Promise.all(
              matchingDocs.map((docSnap) =>
                deleteDoc(doc(db, "Trainings", docSnap.id)),
              ),
            );
          }
        }
      }

      // Update local state
      const updatedTrainings = { ...trainings };
      delete updatedTrainings[trainingKeyToDelete];
      setTrainings(updatedTrainings);

      // Clear current view if deleting the active training
      if (currentTrainingKey === trainingKeyToDelete) {
        setCurrentTrainingKey(null);
        setExercisesList([]);

        // Load first available training if any exist
        const remainingKeys = Object.keys(updatedTrainings).filter((key) =>
          key.startsWith("training"),
        );
        if (remainingKeys.length > 0) {
          await LoadTrainingExercises(remainingKeys[0]);
        }
      }

      Toast.show({
        type: "success",
        text1: strings.trainingDeletedFromBoth,
        visibilityTime: 2000,
        topOffset: 60,
      });
    } catch (error) {
      console.error("Error deleting training:", error);
      Alert.alert(strings.error, strings.deleteError);
    } finally {
      setSaving(false);
    }
  };

  const toggleExerciseSelection = (exerciseId) => {
    // Prevent selecting exercises that are already in a set
    const exercise = exercisesList.find((ex) => ex.id === exerciseId);
    if (exercise?.setId) {
      Alert.alert(strings.info, strings.exerciseAlreadyInSet);
      return;
    }

    // Stop selection at 4 exercises (max for Quadro Set)
    if (
      !selectedExercises.includes(exerciseId) &&
      selectedExercises.length >= 4
    ) {
      Alert.alert(strings.info, strings.maxSelectionReached);
      return;
    }

    if (selectedExercises.includes(exerciseId)) {
      setSelectedExercises(selectedExercises.filter((id) => id !== exerciseId));
    } else {
      setSelectedExercises([...selectedExercises, exerciseId]);
    }
  };

  const createSet = async (setType) => {
    const requiredCount =
      setType === "סופר סט" ? 2 : setType === "טריפל סט" ? 3 : 4;

    if (selectedExercises.length !== requiredCount) {
      Alert.alert(
        strings.error,
        `${strings.pleaseSelect} ${requiredCount} ${strings.exercises.toLowerCase()}`,
      );
      return;
    }

    // Check if we're editing and have tempSetReps
    const editingExercise = exercisesList.find(
      (ex) => selectedExercises.includes(ex.id) && ex.tempSetReps,
    );

    if (editingExercise && editingExercise.tempSetReps) {
      // Use the tempSetReps from editing mode
      await saveSetWithReps(setType, editingExercise.tempSetReps);
    } else {
      // Show custom modal for set reps input
      setSetRepsInputValue("");
      setSetRepsCallback(() => async (setReps) => {
        await saveSetWithReps(setType, setReps);
      });
      setShowSetRepsModal(true);
    }
  };

  const saveSetWithReps = async (setType, setReps) => {
    try {
      setSaving(true);

      const newSetId = generateRandomId();
      const updatedExercises = exercisesList.map((exercise) => {
        if (selectedExercises.includes(exercise.id)) {
          // Remove tempSetReps if it exists
          const { tempSetReps, ...exerciseWithoutTemp } = exercise;
          return { ...exerciseWithoutTemp, setId: newSetId, setType, setReps };
        }
        return exercise;
      });

      // In creation mode, only include exercises that are actually in the training
      const exercisesToSave = isCreatingTraining
        ? updatedExercises.filter((exercise) =>
            tempTrainingExercises.some(
              (ex) =>
                ex.bodyPartId === exercise.bodyPartId &&
                ex.exerciseIndex === exercise.exerciseIndex,
            ),
          )
        : updatedExercises;

      // Create the exercises array with set information and preserve numOfSets, weight, numOfReps, and setReps
      const exercisesArray = exercisesToSave.map((exercise) => {
        const exerciseData = {
          bodyPartId: exercise.bodyPartId,
          exerciseIndex: exercise.exerciseIndex,
          setId: exercise.setId || null,
          setType: exercise.setType || null,
        };

        // Preserve numOfSets, weight and numOfReps if they exist
        if (exercise.numOfSets) {
          exerciseData.numOfSets = exercise.numOfSets;
        }
        if (exercise.weight) {
          exerciseData.weight = exercise.weight;
        }
        if (exercise.numOfReps) {
          exerciseData.numOfReps = exercise.numOfReps;
        }
        // Preserve setReps if it exists
        if (exercise.setReps) {
          exerciseData.setReps = exercise.setReps;
        }

        return exerciseData;
      });

      // If in creation mode and no training exists yet, create it first
      if (isCreatingTraining && !currentTrainingKey) {
        // Generate a unique training ID
        let newTrainingKey;
        do {
          newTrainingKey = `training_${generateRandomId()}`;
        } while (trainings[newTrainingKey]); // Ensure it doesn't exist

        if (!isGeneralMode) {
          const userRef = doc(db, "Users", item.id);
          await updateDoc(userRef, {
            [`trainings.${newTrainingKey}`]: {
              name: tempTrainingName,
              exercises: exercisesArray,
              trainingSets: tempTrainingSets || 1,
            },
          });
        }

        const newDocRef = await addDoc(collection(db, "Trainings"), {
          ...(isGeneralMode
            ? { isGeneral: true }
            : { userIds: [item.id], userName: item.name }),
          originalTrainingKey: newTrainingKey,
          name: tempTrainingName,
          exercises: exercisesArray,
          trainingSets: tempTrainingSets || 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        if (isGeneralMode) {
          setGeneralTrainingDocIds((prev) => ({
            ...prev,
            [newTrainingKey]: newDocRef.id,
          }));
        }

        // Update local states
        setCurrentTrainingKey(newTrainingKey);
        setTrainings((prev) => ({
          ...prev,
          [newTrainingKey]: {
            name: tempTrainingName,
            exercises: exercisesArray,
            trainingSets: tempTrainingSets || 1,
          },
        }));
        setTempTrainingExercises(exercisesArray);

        Toast.show({
          type: "success",
          text1: strings.trainingCreatedWithSet,
          visibilityTime: 2000,
          topOffset: 60,
        });
      } else if (currentTrainingKey) {
        // If in creation mode, update tempTrainingExercises to include selected exercises
        if (isCreatingTraining) {
          setTempTrainingExercises(exercisesArray);
        }

        const updatedTrainings = {
          ...trainings,
          [currentTrainingKey]: {
            ...trainings[currentTrainingKey],
            exercises: exercisesArray,
          },
        };

        if (!isGeneralMode) {
          const userRef = doc(db, "Users", item.id);
          await updateDoc(userRef, {
            trainings: updatedTrainings,
            lastUpdated: new Date().toISOString(),
          });
        }

        await updateTrainingsArchive(currentTrainingKey, {
          exercises: exercisesArray,
        });

        setTrainings(updatedTrainings);

        Toast.show({
          type: "success",
          text1: strings.setCreatedSuccess,
          visibilityTime: 1500,
          topOffset: 60,
        });
      }

      // Update local state and clear selection
      setExercisesList(updatedExercises);
      setSelectedExercises([]);
      // Clear edit mode if we were editing
      setEditingSetId(null);
      setOriginalExercisesBeforeEdit([]);
      // Keep selection mode active for more sets
    } catch (error) {
      console.error("Error saving set:", error);
      Alert.alert(strings.error, strings.saveError);
    } finally {
      setSaving(false);
    }
  };

  const editSet = (setId) => {
    // Get the current setReps value for this set
    const setExercise = exercisesList.find((ex) => ex.setId === setId);
    const currentSetReps = setExercise?.setReps || "";

    // Show custom modal for set reps input
    setSetRepsInputValue(String(currentSetReps));
    setSetRepsCallback(() => (newSetReps) => {
      const repsNumber = parseInt(newSetReps);

      // Store original state before editing
      setOriginalExercisesBeforeEdit([...exercisesList]);
      setEditingSetId(setId);

      // Get all exercises in this set
      const exercisesInSet = exercisesList
        .filter((ex) => ex.setId === setId)
        .map((ex) => ex.id);

      // Remove the set first but preserve the new setReps for re-creation
      const updatedExercises = exercisesList.map((exercise) => {
        if (exercise.setId === setId) {
          return {
            ...exercise,
            setId: null,
            setType: null,
            tempSetReps: repsNumber,
          };
        }
        return exercise;
      });

      setExercisesList(updatedExercises);

      // Enter selection mode with these exercises pre-selected
      setSelectionMode(true);
      setSelectedExercises(exercisesInSet);
    });
    setShowSetRepsModal(true);
  };

  const removeSet = (setId) => {
    Alert.alert(strings.removeSet, strings.removeSetConfirm, [
      { text: strings.cancel, style: "cancel" },
      {
        text: strings.remove,
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);

            const updatedExercises = exercisesList.map((exercise) => {
              if (exercise.setId === setId) {
                return {
                  ...exercise,
                  setId: null,
                  setType: null,
                  setReps: null,
                };
              }
              return exercise;
            });

            // In creation mode, only include exercises that are actually in the training
            const exercisesToSave = isCreatingTraining
              ? updatedExercises.filter((exercise) =>
                  tempTrainingExercises.some(
                    (ex) =>
                      ex.bodyPartId === exercise.bodyPartId &&
                      ex.exerciseIndex === exercise.exerciseIndex,
                  ),
                )
              : updatedExercises;

            // Create the exercises array without the removed set and preserve numOfSets, weight, numOfReps, and setReps
            const exercisesArray = exercisesToSave.map((exercise) => {
              const exerciseData = {
                bodyPartId: exercise.bodyPartId,
                exerciseIndex: exercise.exerciseIndex,
                setId: exercise.setId || null,
                setType: exercise.setType || null,
              };

              // Preserve numOfSets, weight and numOfReps if they exist
              if (exercise.numOfSets) {
                exerciseData.numOfSets = exercise.numOfSets;
              }
              if (exercise.weight) {
                exerciseData.weight = exercise.weight;
              }
              if (exercise.numOfReps) {
                exerciseData.numOfReps = exercise.numOfReps;
              }
              // Preserve setReps if it exists
              if (exercise.setReps) {
                exerciseData.setReps = exercise.setReps;
              }

              return exerciseData;
            });

            if (currentTrainingKey) {
              const updatedTrainings = {
                ...trainings,
                [currentTrainingKey]: {
                  ...trainings[currentTrainingKey],
                  exercises: exercisesArray,
                },
              };

              if (!isGeneralMode) {
                const userRef = doc(db, "Users", item.id);
                await updateDoc(userRef, {
                  trainings: updatedTrainings,
                  lastUpdated: new Date().toISOString(),
                });
              }

              await updateTrainingsArchive(currentTrainingKey, {
                exercises: exercisesArray,
              });

              setTrainings(updatedTrainings);
            }

            setExercisesList(updatedExercises);
          } catch (error) {
            console.error("Error removing set:", error);
            Alert.alert(strings.error, strings.saveError);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleDragEnd = async ({ data }) => {
    setExercisesList(data);

    try {
      setSaving(true);

      // In creation mode, only save exercises that are actually in the training,
      // not all displayed exercises from the browsed body part
      const dataToSave = isCreatingTraining
        ? data.filter((exercise) =>
            tempTrainingExercises.some(
              (ex) =>
                ex.bodyPartId === exercise.bodyPartId &&
                ex.exerciseIndex === exercise.exerciseIndex,
            ),
          )
        : data;

      if (dataToSave.length === 0) return;

      // Create the exercises array with set information and preserve numOfSets, weight and numOfReps
      const exercisesArray = dataToSave.map((exercise) => {
        const exerciseData = {
          bodyPartId: exercise.bodyPartId,
          exerciseIndex: exercise.exerciseIndex,
          setId: exercise.setId || null,
          setType: exercise.setType || null,
        };

        // Preserve numOfSets, weight and numOfReps if they exist
        if (exercise.numOfSets) {
          exerciseData.numOfSets = exercise.numOfSets;
        }
        if (exercise.weight) {
          exerciseData.weight = exercise.weight;
        }
        if (exercise.numOfReps) {
          exerciseData.numOfReps = exercise.numOfReps;
        }

        return exerciseData;
      });

      // Update the user document
      // Update the training in the trainings map
      if (currentTrainingKey) {
        const updatedTrainings = {
          ...trainings,
          [currentTrainingKey]: {
            ...trainings[currentTrainingKey],
            exercises: exercisesArray,
          },
        };

        if (!isGeneralMode) {
          const userRef = doc(db, "Users", item.id);
          await updateDoc(userRef, {
            trainings: updatedTrainings,
            lastUpdated: new Date().toISOString(),
          });
        }

        await updateTrainingsArchive(currentTrainingKey, {
          exercises: exercisesArray,
        });

        setTrainings(updatedTrainings);
      }

      // Show success toast
      Toast.show({
        type: "success",
        text1: strings.orderSavedSuccess,
        visibilityTime: 2000,
        topOffset: 60,
      });
    } catch (error) {
      console.error("Error saving exercise order:", error);
      Alert.alert(strings.error, strings.saveError);
    } finally {
      setSaving(false);
    }
  };

  const isSearching = isCreatingTraining && searchQuery.trim() !== "";

  const searchResults = useMemo(() => {
    if (!isCreatingTraining || searchQuery.trim() === "") return [];
    const lowerQuery = searchQuery.toLowerCase();
    const results = [];
    Object.values(bodyPartsData).forEach((bodyPart) => {
      if (!bodyPart.exercises) return;
      const bodyPartMatches =
        bodyPart.bodyPart &&
        bodyPart.bodyPart.toLowerCase().includes(lowerQuery);
      bodyPart.exercises.forEach((exercise, index) => {
        if (
          (exercise.name && exercise.name.toLowerCase().includes(lowerQuery)) ||
          bodyPartMatches
        ) {
          results.push({
            id: `${bodyPart.id}-${index}`,
            bodyPartId: bodyPart.id,
            exerciseIndex: index,
            bodyPartName: bodyPart.bodyPart,
            setId: null,
            setType: null,
            ...exercise,
          });
        }
      });
    });
    return results;
  }, [searchQuery, bodyPartsData, isCreatingTraining]);

  return (
    <SafeAreaView style={styles.mainContainer}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StudentHeaderPage
          title={strings.subTitle}
          imgUrl={item.imgUrl || (isGeneralMode ? user?.imageUrl : undefined)}
        />
        <View style={styles.container}>
          {!isCreatingTraining && (
            <TouchableOpacity
              style={styles.trainingsButton}
              onPress={handleViewTrainings}
            >
              <AntDesign name="bars" size={20} color={primaryColor} />
              <Text style={styles.trainingsButtonText}>
                {strings.viewTrainings}
                {currentTrainingKey && trainings[currentTrainingKey] && (
                  <Text style={styles.currentTrainingText}>
                    {" "}
                    ({trainings[currentTrainingKey].name})
                  </Text>
                )}
              </Text>
            </TouchableOpacity>
          )}

          {/* Search box - only visible in create/edit training mode */}
          {isCreatingTraining && (
            <Animated.View
              entering={ZoomIn.duration(300).springify()}
              exiting={ZoomOut.duration(200)}
              style={styles.searchBoxContainer}
            >
              <Ionicons name="search" size={24} color={primaryColor} />
              <TextInput
                style={styles.searchBoxInput}
                placeholder={strings.searchExercises}
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons
                    name="close-outline"
                    size={24}
                    color={primaryColor}
                  />
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {/* Create and Delete Training Buttons */}
          {!isSearching && (
            <View style={styles.trainingActionsContainer}>
              <TouchableOpacity
                style={[
                  styles.trainingActionButton,
                  styles.createTrainingButton,
                  isCreatingTraining &&
                    tempTrainingExercises.length === 0 && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                  isCreatingTraining &&
                    tempTrainingExercises.length > 0 &&
                    styles.createTrainingButtonCompleted,
                ]}
                onPress={() =>
                  isCreatingTraining
                    ? handleCancelCreation()
                    : handleStartCreation()
                }
              >
                <MaterialIcons
                  name={
                    isCreatingTraining && tempTrainingExercises.length > 0
                      ? "check"
                      : isCreatingTraining
                        ? "close"
                        : "add-circle"
                  }
                  size={20}
                  color={
                    isCreatingTraining && tempTrainingExercises.length > 0
                      ? "#fff"
                      : isCreatingTraining
                        ? "#fff"
                        : Colors.COMPLETED
                  }
                />
                <Text
                  style={[
                    styles.trainingActionText,
                    isCreatingTraining && styles.trainingActionTextActive,
                  ]}
                >
                  {isCreatingTraining && tempTrainingExercises.length > 0
                    ? strings.finishedCreating
                    : isCreatingTraining
                      ? strings.cancelCreate
                      : strings.createTraining}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.trainingActionButton,
                  styles.deleteTrainingButton,
                ]}
                onPress={() => {
                  if (!currentTrainingKey) {
                    Alert.alert(strings.error, strings.noTrainingSelected);
                    return;
                  }
                  handleDeleteTraining(currentTrainingKey);
                }}
              >
                <MaterialIcons name="delete" size={20} color="#ef4444" />
                <Text style={[styles.trainingActionText, { color: "#ef4444" }]}>
                  {strings.deleteTraining}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Edit Training Button */}
          {!isSearching && !isCreatingTraining && currentTrainingKey && (
            <TouchableOpacity
              style={[styles.editTrainingButton, { borderColor: primaryColor }]}
              onPress={handleEditTraining}
            >
              <MaterialIcons name="edit" size={20} color={primaryColor} />
              <Text style={[styles.editTrainingButtonText]}>
                {strings.editTraining}
              </Text>
            </TouchableOpacity>
          )}

          {/* Back to body parts button when in creation mode */}
          {!isSearching &&
            !loading &&
            isCreatingTraining &&
            exercisesList.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.backToBodyPartsButton,
                  { borderColor: primaryColor },
                ]}
                onPress={handleBackToBodyParts}
              >
                <AntDesign name="arrow-right" size={20} color={primaryColor} />
                <Text
                  style={[styles.backToBodyPartsText, { color: primaryColor }]}
                >
                  {strings.backToBodyParts}
                </Text>
              </TouchableOpacity>
            )}

          {/* Create Set button on the body parts screen (edit/create mode, ≥2 exercises selected) */}
          {!isSearching &&
            !loading &&
            isCreatingTraining &&
            exercisesList.length === 0 &&
            tempTrainingExercises.length >= 2 && (
              <TouchableOpacity
                style={[
                  styles.createSetFromBodyPartsButton,
                  { borderColor: primaryColor },
                ]}
                onPress={handleOpenSetCreationFromBodyPartsView}
              >
                <MaterialIcons
                  name="playlist-add"
                  size={20}
                  color={primaryColor}
                />
                <Text
                  style={[
                    styles.createSetFromBodyPartsText,
                    { color: primaryColor },
                  ]}
                >
                  {strings.createSet}
                </Text>
              </TouchableOpacity>
            )}

          {/* Instructions and set controls when exercises are loaded */}
          {!isSearching && !loading && exercisesList.length > 0 && (
            <>
              <View style={styles.instructionContainer}>
                <MaterialIcons
                  name="info-outline"
                  size={20}
                  color={primaryColor}
                />
                <Text style={styles.instructionText}>
                  {isCreatingTraining
                    ? strings.instructionAddExercises
                    : strings.instruction}
                </Text>
              </View>

              {saving && (
                <View style={styles.savingIndicatorContainer}>
                  <ActivityIndicator size="small" color={primaryColor} />
                  <Text style={[styles.savingText, { color: primaryColor }]}>
                    {strings.saving}
                  </Text>
                </View>
              )}

              <View style={styles.setControlsContainer}>
                <TouchableOpacity
                  style={[
                    styles.selectionModeButton,
                    { borderColor: primaryColor },
                    selectionMode && styles.selectionModeButtonActive,
                    selectionMode && { backgroundColor: primaryColor },
                    isCreatingTraining &&
                      tempTrainingExercises.length < 2 &&
                      styles.selectionModeButtonDisabled,
                  ]}
                  onPress={toggleSelectionMode}
                >
                  <MaterialIcons
                    name={selectionMode ? "check-circle" : "playlist-add"}
                    size={20}
                    color={
                      isCreatingTraining && tempTrainingExercises.length < 2
                        ? "#999"
                        : selectionMode
                          ? "#fff"
                          : primaryColor
                    }
                  />
                  <Text
                    style={[
                      styles.selectionModeText,
                      selectionMode && styles.selectionModeTextActive,
                      isCreatingTraining &&
                        tempTrainingExercises.length < 2 &&
                        styles.selectionModeTextDisabled,
                    ]}
                  >
                    {selectionMode
                      ? strings.cancelSelection
                      : strings.createSet}
                  </Text>
                </TouchableOpacity>

                {selectionMode && selectedExercises.length >= 2 && (
                  <View style={styles.setButtons}>
                    {selectedExercises.length === 2 && (
                      <TouchableOpacity
                        style={[
                          styles.setButton,
                          styles.superSetButton,
                          styles.setButtonEnabled,
                        ]}
                        onPress={() => createSet("סופר סט")}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.setButtonText}>
                            {strings.saveSuperSet}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {selectedExercises.length === 3 && (
                      <TouchableOpacity
                        style={[
                          styles.setButton,
                          styles.tripleSetButton,
                          styles.setButtonEnabled,
                        ]}
                        onPress={() => createSet("טריפל סט")}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.setButtonText}>
                            {strings.saveTripleSet}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {selectedExercises.length === 4 && (
                      <TouchableOpacity
                        style={[
                          styles.setButton,
                          styles.quadroSetButton,
                          styles.setButtonEnabled,
                        ]}
                        onPress={() => createSet("קוואדרו סט")}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.setButtonText}>
                            {strings.saveQuadroSet}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {selectedExercises.length > 0 && selectionMode && (
                  <Text style={[styles.selectedCount, { color: primaryColor }]}>
                    {strings.selected}: {selectedExercises.length}/4
                  </Text>
                )}

                {selectionMode &&
                  exercisesList.some((ex) => ex.setId !== null) && (
                    <Text style={styles.hintText}>
                      {strings.createMoreSetsHint}
                    </Text>
                  )}
              </View>
            </>
          )}

          {isSearching ? (
            <FlatList
              data={searchResults}
              keyExtractor={(ex) => ex.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.searchResultsList}
              renderItem={({ item: exercise, index }) => (
                <StudentTrainingCard
                  item={exercise}
                  drag={() => {}}
                  isActive={false}
                  getIndex={() => index}
                  selectionMode={false}
                  isSelected={false}
                  onToggleSelect={() => {}}
                  isInSet={false}
                  userId={item.id}
                  trainingKey={currentTrainingKey}
                  generalDocId={
                    isGeneralMode
                      ? generalTrainingDocIds[currentTrainingKey]
                      : undefined
                  }
                  isCreatingMode={true}
                  isInTraining={isExerciseInTraining(exercise)}
                  onToggleInTraining={() =>
                    handleToggleExerciseInTraining(exercise)
                  }
                  onDataUpdate={() => {}}
                  onPress={() =>
                    router.push({
                      pathname: "/ExerciseDetails",
                      params: {
                        ...exercise,
                        youtubeUrls: exercise.youtubeUrls
                          ? JSON.stringify(exercise.youtubeUrls)
                          : undefined,
                        videosUrl: exercise.videosUrl
                          ? JSON.stringify(exercise.videosUrl)
                          : undefined,
                        bodyPartId: exercise.bodyPartId,
                        exerciseName: exercise.name,
                      },
                    })
                  }
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {strings.noExercisesFound}
                  </Text>
                </View>
              }
            />
          ) : loading ? (
            <ActivityIndicator
              size="large"
              color={primaryColor}
              style={styles.loader}
            />
          ) : isCreatingTraining && exercisesList.length === 0 ? (
            <StudentTrainingBodyPartList
              bodyParts={Object.values(bodyPartsData)}
              onCardPress={handleCreateTrainingFromBodyPart}
              initialTrainingName={tempTrainingName}
              onTrainingNameChange={(newName) => setTempTrainingName(newName)}
              initialTrainingSets={tempTrainingSets}
              onTrainingSetsChange={(sets) => {
                setTempTrainingSets(sets);
                // If in edit mode, save immediately
                if (currentTrainingKey) {
                  updateTrainingSets(sets);
                }
              }}
              existingExercises={tempTrainingExercises
                .map((ex) => {
                  const bp = bodyPartsData[ex.bodyPartId];
                  if (!bp) return null;
                  const exercise =
                    bp.exercises && bp.exercises[ex.exerciseIndex];
                  if (!exercise) return null;
                  return {
                    id: `${ex.bodyPartId}-${ex.exerciseIndex}`,
                    bodyPartId: ex.bodyPartId,
                    exerciseIndex: ex.exerciseIndex,
                    bodyPartName: bp.bodyPart || "",
                    setId: ex.setId || null,
                    setType: ex.setType || null,
                    setReps: ex.setReps || null,
                    numOfSets: ex.numOfSets || null,
                    weight: ex.weight || null,
                    numOfReps: ex.numOfReps || null,
                    ...exercise,
                  };
                })
                .filter(Boolean)}
              userId={item.id}
              trainingKey={currentTrainingKey}
              onToggleInTraining={handleToggleExerciseInTraining}
            />
          ) : exercisesList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="fitness-center" size={60} color="#ccc" />
              <Text style={styles.emptyText}>{strings.noExercises}</Text>
              <Text style={styles.emptySubText}>{strings.noExercisesHint}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ flex: 1 }}>
                <DraggableFlatList
                  data={
                    showExistingInExercisesList
                      ? [
                          ...exercisesList.filter((ex) =>
                            isExerciseInTraining(ex),
                          ),
                          ...exercisesList.filter(
                            (ex) => !isExerciseInTraining(ex),
                          ),
                        ]
                      : exercisesList.filter((ex) => !isExerciseInTraining(ex))
                  }
                  ListHeaderComponent={
                    isCreatingTraining &&
                    exercisesList.some((ex) => isExerciseInTraining(ex)) ? (
                      <TouchableOpacity
                        style={[
                          styles.existingExercisesToggle,
                          { backgroundColor: primaryColor },
                        ]}
                        onPress={() =>
                          setShowExistingInExercisesList((prev) => !prev)
                        }
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name={
                            showExistingInExercisesList
                              ? "keyboard-arrow-up"
                              : "keyboard-arrow-down"
                          }
                          size={22}
                          color="#fff"
                        />
                        <Text style={styles.existingExercisesToggleText}>
                          {"תרגילים באימון הנוכחי"} (
                          {
                            exercisesList.filter((ex) =>
                              isExerciseInTraining(ex),
                            ).length
                          }
                          )
                        </Text>
                      </TouchableOpacity>
                    ) : null
                  }
                  renderItem={({
                    item: exercise,
                    drag,
                    isActive,
                    getIndex,
                  }) => {
                    const isSelected = selectedExercises.includes(exercise.id);
                    const isInSet = exercise.setId !== null;
                    const isFirstInSet =
                      isInSet &&
                      exercisesList.find((ex) => ex.setId === exercise.setId)
                        ?.id === exercise.id;
                    const exercisesInSet = isInSet
                      ? exercisesList.filter(
                          (ex) => ex.setId === exercise.setId,
                        )
                      : [];
                    const isLastInSet =
                      isInSet &&
                      exercisesInSet[exercisesInSet.length - 1]?.id ===
                        exercise.id;

                    return (
                      <View>
                        {isFirstInSet && !isActive && (
                          <View
                            style={[
                              styles.setHeader,
                              { backgroundColor: primaryColor },
                            ]}
                          >
                            <Text style={styles.setHeaderText}>
                              {exercise.setType}
                              {exercise.setReps && (
                                <Text style={styles.setRepsText}>
                                  {" "}
                                  - {exercise.setReps} {strings.setRepsLabel}
                                </Text>
                              )}
                            </Text>
                            <View style={styles.setHeaderActions}>
                              <TouchableOpacity
                                onPress={() => editSet(exercise.setId)}
                                style={styles.setActionButton}
                              >
                                <MaterialIcons
                                  name="edit"
                                  size={18}
                                  color="#fff"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => removeSet(exercise.setId)}
                                style={styles.setActionButton}
                              >
                                <MaterialIcons
                                  name="close"
                                  size={18}
                                  color="#fff"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                        <View
                          style={[
                            isInSet &&
                              !isSelected &&
                              !isActive && {
                                ...styles.setExerciseWrapper,
                                borderColor: primaryColor,
                              },
                            isFirstInSet &&
                              !isSelected &&
                              !isActive &&
                              styles.setExerciseFirst,
                            isLastInSet &&
                              !isSelected &&
                              !isActive &&
                              styles.setExerciseLast,
                          ]}
                        >
                          <StudentTrainingCard
                            item={exercise}
                            drag={drag}
                            isActive={isActive}
                            getIndex={getIndex}
                            selectionMode={selectionMode}
                            isSelected={isSelected}
                            onToggleSelect={() =>
                              toggleExerciseSelection(exercise.id)
                            }
                            isInSet={isInSet}
                            userId={item.id}
                            trainingKey={currentTrainingKey}
                            generalDocId={
                              isGeneralMode
                                ? generalTrainingDocIds[currentTrainingKey]
                                : undefined
                            }
                            isExpanded={expandedExerciseId === exercise.id}
                            onToggleExpand={() => {
                              setExpandedExerciseId(
                                expandedExerciseId === exercise.id
                                  ? null
                                  : exercise.id,
                              );
                            }}
                            isCreatingMode={isCreatingTraining}
                            isInTraining={isExerciseInTraining(exercise)}
                            onToggleInTraining={() =>
                              handleToggleExerciseInTraining(exercise)
                            }
                            onDataUpdate={(numOfSets, weight, numOfReps) => {
                              // Update local state after saving
                              setExercisesList((prevList) =>
                                prevList.map((ex) =>
                                  ex.id === exercise.id
                                    ? { ...ex, numOfSets, weight, numOfReps }
                                    : ex,
                                ),
                              );
                              // Keep tempTrainingExercises in sync so handleCancelCreation
                              // rebuilds the display with the latest values
                              setTempTrainingExercises((prev) =>
                                prev.map((ex) =>
                                  ex.bodyPartId === exercise.bodyPartId &&
                                  ex.exerciseIndex === exercise.exerciseIndex
                                    ? { ...ex, numOfSets, weight, numOfReps }
                                    : ex,
                                ),
                              );
                            }}
                            onPress={() => {
                              if (!selectionMode) {
                                router.push({
                                  pathname: "/ExerciseDetails",
                                  params: {
                                    ...exercise,
                                    youtubeUrls: exercise.youtubeUrls
                                      ? JSON.stringify(exercise.youtubeUrls)
                                      : undefined,
                                    videosUrl: exercise.videosUrl
                                      ? JSON.stringify(exercise.videosUrl)
                                      : undefined,
                                    bodyPartId: exercise.bodyPartId,
                                    exerciseName: exercise.name,
                                  },
                                });
                              }
                            }}
                          />
                        </View>
                      </View>
                    );
                  }}
                  keyExtractor={(exercise) => exercise.id}
                  onDragEnd={handleDragEnd}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </View>
          )}

          <Modal
            visible={showTrainingsModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowTrainingsModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{strings.trainings}</Text>
                  <TouchableOpacity
                    onPress={() => setShowTrainingsModal(false)}
                    style={styles.closeButton}
                  >
                    <AntDesign name="close" size={24} color={primaryColor} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={{ paddingBottom: 30 }}
                >
                  {getSortedTrainingKeys().map((trainingKey) => (
                    <TouchableOpacity
                      key={trainingKey}
                      style={[
                        styles.trainingButton,
                        currentTrainingKey === trainingKey &&
                          styles.trainingButtonActive,
                        currentTrainingKey === trainingKey && {
                          borderColor: primaryColor,
                        },
                      ]}
                      onPress={() => LoadTrainingExercises(trainingKey)}
                    >
                      <MaterialIcons
                        name="fitness-center"
                        size={20}
                        color={primaryColor}
                        style={styles.trainingButtonIcon}
                      />
                      <Text style={styles.trainingButtonText}>
                        {trainings[trainingKey].name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

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
                  <Text style={styles.modalTitle}>
                    {strings.deleteTraining}
                  </Text>
                </View>
                <View style={styles.deleteModalContent}>
                  {!isGeneralMode && (
                    <TouchableOpacity
                      style={styles.deleteOption}
                      onPress={executeDeleteFromUserOnly}
                    >
                      <MaterialIcons
                        name="person-remove"
                        size={24}
                        color="#666"
                        style={styles.deleteOptionIcon}
                      />
                      <Text style={styles.deleteOptionText}>
                        {strings.deleteFromUserOnly}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.deleteOption, styles.deleteOptionDanger]}
                    onPress={executeDeleteFromUserAndArchive}
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
                      {isGeneralMode
                        ? strings.deleteTraining
                        : strings.deleteFromUserAndArchive}
                    </Text>
                  </TouchableOpacity>

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

          {/* SetReps Input Modal */}
          <Modal
            visible={showSetRepsModal}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setShowSetRepsModal(false)}
          >
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <TouchableOpacity
                style={styles.setRepsModalOverlay}
                activeOpacity={1}
                onPress={() => setShowSetRepsModal(false)}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.setRepsModalContent}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text style={styles.setRepsModalTitle}>
                    {strings.setRepsTitle}
                  </Text>
                  <Text style={styles.setRepsModalMessage}>
                    {strings.setRepsMessage}
                  </Text>

                  <TextInput
                    style={styles.setRepsInput}
                    value={setRepsInputValue}
                    onChangeText={setSetRepsInputValue}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#999"
                    autoFocus={true}
                  />

                  <View style={styles.setRepsModalButtons}>
                    <TouchableOpacity
                      style={[
                        styles.setRepsModalButton,
                        styles.setRepsCancelButton,
                      ]}
                      onPress={() => setShowSetRepsModal(false)}
                    >
                      <Text style={styles.setRepsCancelButtonText}>
                        {strings.cancel}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.setRepsModalButton,
                        styles.setRepsOkButton,
                        { backgroundColor: primaryColor },
                      ]}
                      onPress={() => {
                        const repsNumber = parseInt(setRepsInputValue);
                        if (
                          !setRepsInputValue ||
                          isNaN(repsNumber) ||
                          repsNumber <= 0
                        ) {
                          Alert.alert(strings.error, strings.invalidSetReps);
                          return;
                        }
                        setShowSetRepsModal(false);
                        if (setRepsCallback) {
                          setRepsCallback(repsNumber);
                        }
                      }}
                    >
                      <Text style={styles.setRepsOkButtonText}>
                        {strings.ok}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const strings = {
  subTitle: "בניית תוכנית אימונים",
  for: "עבור: ",
  instruction: "לחץ לחיצה ארוכה וגרור כדי לשנות סדר",
  instructionAddExercises:
    "לחץ על תרגיל כדי להוסיף/להסיר מהאימון (שמירה אוטומטית)",
  noExercises: "אין תרגילים מוקצים",
  noExercisesHint: "יש ליצור אימון תחילה",
  save: "שמור סדר תרגילים",
  success: "נשמר בהצלחה",
  saveSuccess: "סדר התרגילים נשמר בהצלחה",
  error: "שגיאה",
  saveError: "לא הצלחנו לשמור את סדר התרגילים",
  loadError: "לא הצלחנו לטעון את התרגילים",
  studentNotFound: "המתאמן לא נמצא",
  ok: "אישור",
  viewTrainings: "הצג אימונים",
  trainings: "אימונים",
  training: "אימון ",
  exercises: "תרגילים",
  info: "מידע",
  noTrainingsAvailable: "אין אימונים קיימים",
  trainingOrderSaved: "סדר האימון נשמר בהצלחה",
  createSet: "צור סט",
  cancelSelection: "סיים בחירה",
  superSet: "סופר סט (2)",
  tripleSet: "טריפל סט (3)",
  quadroSet: "קוודרו סט (4)",
  saveSuperSet: "שמור סופר סט",
  saveTripleSet: "שמור טריפל סט",
  saveQuadroSet: "שמור קוודרו סט",
  selected: "נבחרו",
  pleaseSelect: "אנא בחר",
  removeSet: "הסר סט",
  removeSetConfirm: "האם אתה בטוח שברצונך להסיר את הסט?",
  cancel: "ביטול",
  cancelRemove: "בטל מחיקה",
  remove: "הסר",
  createMoreSetsHint: "ניתן להמשיך וליצור סטים נוספים",
  exerciseAlreadyInSet: "תרגיל זה כבר נמצא בסט. הסר את הסט תחילה.",
  maxSelectionReached: "ניתן לבחור עד 4 תרגילים בלבד",
  saving: "שומר...",
  orderSavedSuccess: "הסדר נשמר בהצלחה",
  createTraining: "צור אימון",
  deleteTraining: "מחיקת אימון",
  cancelCreate: "בטל יצירה",
  finishedCreating: "סיימתי",
  chooseDeleteOption: "בחר אפשרות מחיקה:",
  deleteFromUserOnly: "מחק מהמתאמן בלבד",
  deleteFromUserAndArchive: "מחק מהמתאמן ומהמאגר",
  delete: "מחק",
  pleaseEnterTrainingName: "אנא הכנס שם לאימון",
  setRepsTitle: "מספר סטים",
  setRepsMessage: "כמה פעמים לבצע את הסט?",
  setRepsLabel: "סטים",
  invalidSetReps: "אנא הכנס מספר תקין גדול מ-0",
  editSetRepsTitle: "ערוך מספר סטים",
  editSetRepsMessage: "כמה פעמים לבצע את הסט?",
  trainingCreatedSuccess: "האימון נוצר בהצלחה",
  createTrainingError: "שגיאה ביצירת האימון",
  saveTraining: "שמור אימון",
  pleaseAddExercises: "אנא הוסף לפחות תרגיל אחד",
  addToTraining: "הוסף לאימון",
  removeFromTraining: "הסר מהאימון",
  exerciseAdded: "תרגיל נוסף לאימון",
  exerciseRemoved: "תרגיל הוסר מהאימון",
  setCreatedSuccess: "הסט נוצר בהצלחה",
  trainingCreatedWithSet: "האימון והסט נוצרו בהצלחה",
  addAtLeastTwoExercises: "הוסף לפחות 2 תרגילים לאימון",
  backToBodyParts: "חזור לבחירת חלקי גוף",
  noTrainingSelected: "אנא בחר אימון למחיקה",
  trainingDeleted: "האימון נמחק בהצלחה",
  trainingDeletedFromUser: "האימון נמחק מהמתאמן בהצלחה",
  trainingDeletedFromBoth: "אימון נמחק מהמתאמן ומהמאגר בהצלחה",
  deleteError: "שגיאה במחיקת האימון",
  editTraining: "ערוך אימון זה",
  trainingNameUpdated: "שם האימון עודכן בהצלחה",
  goBackConfirmTitle: "יציאה מיצירת אימון",
  goBackConfirmMessage:
    "האם אתה בטוח שברצונך לצאת? השינויים שנשמרו יישארו, אך תצא ממצב עריכה.",
  yes: "כן, צא",
  no: "לא, הישאר",
  searchExercises: "חפש תרגילים...",
  noExercisesFound: "לא נמצאו תרגילים",
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subTitle: {
    fontSize: 20,
    textAlign: "right",
    fontWeight: "600",
    marginBottom: 10,
  },
  subTitleName: {
    color: "#404040",
  },
  instructionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: "#404040",
    fontWeight: "500",
  },
  loader: {
    marginTop: 50,
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
    marginTop: 20,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 16,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 50,
  },
  savingIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    marginBottom: 10,
  },
  savingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  trainingsButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  trainingsButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  currentTrainingText: {
    fontWeight: "500",
    color: "#666",
  },
  trainingActionsContainer: {
    flexDirection: "row-reverse",
    gap: 10,
    marginBottom: 10,
  },
  trainingActionButton: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  createTrainingButton: {
    borderColor: Colors.COMPLETED,
  },
  createTrainingButtonActive: {
    borderWidth: 1,
  },
  createTrainingButtonCompleted: {
    backgroundColor: Colors.COMPLETED,
    borderColor: Colors.COMPLETED,
  },
  deleteTrainingButton: {
    borderColor: "#ef4444",
  },
  trainingActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.COMPLETED,
  },
  trainingActionTextActive: {
    color: "#fff",
  },
  saveTrainingButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  saveTrainingButtonDisabled: {
    backgroundColor: "#e0e0e0",
  },
  saveTrainingButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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
  closeButton: {
    position: "absolute",
    right: 20,
  },
  modalScroll: {
    paddingVertical: 20,
    paddingHorizontal: 25,
  },
  trainingButton: {
    position: "relative",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 7,
  },
  trainingButtonIcon: {
    right: 12,
    position: "absolute",
  },
  trainingButtonActive: {
    borderWidth: 2,
  },
  trainingButtonText: {
    fontSize: 20,
    fontWeight: "600",
  },
  setControlsContainer: {
    marginBottom: 15,
  },
  selectionModeButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  selectionModeButtonActive: {},
  selectionModeButtonDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#e0e0e0",
    opacity: 0.6,
  },
  selectionModeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  selectionModeTextActive: {
    color: "#fff",
  },
  selectionModeTextDisabled: {
    color: "#999",
  },
  setButtons: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  setButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  setButtonEnabled: {
    opacity: 1,
  },
  superSetButton: {
    backgroundColor: "#f97316",
  },
  tripleSetButton: {
    backgroundColor: "#8b5cf6",
  },
  quadroSetButton: {
    backgroundColor: "#0ea5e9",
  },
  setButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  selectedCount: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 5,
  },
  hintText: {
    textAlign: "center",
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  setHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    marginTop: 8,
  },
  setHeaderText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  setRepsText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.9,
  },
  setHeaderActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  setActionButton: {
    padding: 2,
  },
  setExerciseWrapper: {
    marginLeft: 5,
    marginRight: 5,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    backgroundColor: "#f0f9ff",
    paddingTop: 4,
    minHeight: 60,
  },
  setExerciseFirst: {
    marginTop: 0,
  },
  setExerciseLast: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 3,
    marginBottom: 8,
    paddingBottom: 4,
  },
  backToBodyPartsButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  backToBodyPartsText: {
    fontSize: 16,
    fontWeight: "600",
  },
  createSetFromBodyPartsButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  createSetFromBodyPartsText: {
    fontSize: 16,
    fontWeight: "600",
  },
  editTrainingButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  editTrainingButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  setRepsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  setRepsModalContent: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    width: "80%",
    maxWidth: 350,
  },
  setRepsModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
    color: "#404040",
  },
  setRepsModalMessage: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
  },
  setRepsInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    backgroundColor: "#f9f9f9",
  },
  setRepsModalButtons: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 10,
  },
  setRepsModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  setRepsCancelButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  setRepsCancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  setRepsOkButton: {},
  setRepsOkButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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
  searchBoxContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.light?.border || "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 10,
  },
  searchBoxInput: {
    flex: 1,
    fontSize: 16,
    textAlign: "right",
    color: "#111827",
    paddingVertical: 4,
  },
  searchResultsList: {
    paddingBottom: 80,
    paddingTop: 6,
  },
  existingExercisesToggle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  existingExercisesToggleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    textAlign: "right",
  },
});
