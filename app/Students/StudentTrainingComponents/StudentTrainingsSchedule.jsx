import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StudentHeaderPage from "../StudentHeaderPage";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { Colors } from "../../../constants/Colors";
import { useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../configs/FirebaseConfig";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Entypo from "@expo/vector-icons/Entypo";
import Toast from "react-native-toast-message";
import { useUser } from "@clerk/clerk-expo";
import { useAuthContext } from "../../../components/AuthContext";
import { useTheme } from "../../../components/ThemeContext";

const generateRandomId = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Configure Hebrew locale
LocaleConfig.locales["he"] = {
  monthNames: [
    "ינואר",
    "פברואר",
    "מרץ",
    "אפריל",
    "מאי",
    "יוני",
    "יולי",
    "אוגוסט",
    "סספטמבר",
    "אוקטובר",
    "נובמבר",
    "דצמבר",
  ],
  monthNamesShort: [
    "ינו׳",
    "פבר׳",
    "מרץ",
    "אפר׳",
    "מאי",
    "יוני",
    "יולי",
    "אוג׳",
    "ספט׳",
    "אוק׳",
    "נוב׳",
    "דצמ׳",
  ],
  dayNames: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  dayNamesShort: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
  today: "היום",
};
LocaleConfig.defaultLocale = "he";

export default function StudentTrainingsSchedule() {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const { isAdmin } = useAuthContext();
  const { primaryColor } = useTheme();

  // If params.id is provided, admin is viewing a student; otherwise the user views themselves
  const isUserMode = !params.id || !isAdmin;

  const [selectedRange, setSelectedRange] = useState({});
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trainingDays, setTrainingDays] = useState([]);
  const [trainings, setTrainings] = useState({});
  const [dayTrainingMap, setDayTrainingMap] = useState({});
  const [showDropdown, setShowDropdown] = useState(null);
  const [archiveTrainings, setArchiveTrainings] = useState([]);
  // User mode: store the Firestore doc ID for the current user
  const [currentUserId, setCurrentUserId] = useState(null);

  const daysOfWeek = [
    { id: "ראשון", label: "ראשון" },
    { id: "שני", label: "שני" },
    { id: "שלישי", label: "שלישי" },
    { id: "רביעי", label: "רביעי" },
    { id: "חמישי", label: "חמישי" },
    { id: "שישי", label: "שישי" },
    { id: "שבת", label: "שבת" },
  ];

  // Hebrew day name → English key used in Firestore
  const hebrewToEnglishDay = {
    ראשון: "sunday",
    שני: "monday",
    שלישי: "tuesday",
    רביעי: "wednesday",
    חמישי: "thursday",
    שישי: "friday",
    שבת: "saturday",
  };

  // Convert UI format { hebrewDay: trainingId } → DB format { english: { day, trainingId } }
  const uiMapToDb = (map) => {
    const dbMap = {};
    Object.entries(map).forEach(([hebrewDay, trainingId]) => {
      const englishKey = hebrewToEnglishDay[hebrewDay];
      if (englishKey) {
        dbMap[englishKey] = { day: hebrewDay, trainingId };
      }
    });
    return dbMap;
  };

  // Convert DB format { english: { day, trainingId } } → UI format { hebrewDay: trainingId }
  const dbMapToUi = (map, validTrainings, archiveTrainingsArr = []) => {
    const uiMap = {};
    const archiveIds = new Set(archiveTrainingsArr.map((t) => t.id));
    Object.values(map).forEach(({ day, trainingId }) => {
      if (
        day &&
        trainingId &&
        (!validTrainings ||
          validTrainings[trainingId] ||
          archiveIds.has(trainingId))
      ) {
        uiMap[day] = trainingId;
      }
    });
    return uiMap;
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD for calendar
  const formatToCalendar = (dateStr) => {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY for display and storage
  const formatToDisplay = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Map Hebrew day names to JavaScript day numbers (0=Sunday, 6=Saturday)
  const hebrewDayToNumber = {
    "יום ראשון": 0,
    "יום שני": 1,
    "יום שלישי": 2,
    "יום רביעי": 3,
    "יום חמישי": 4,
    "יום שישי": 5,
    "יום שבת": 6,
    // Also support short form without "יום" prefix
    ראשון: 0,
    שני: 1,
    שלישי: 2,
    רביעי: 3,
    חמישי: 4,
    שישי: 5,
    שבת: 6,
  };

  // Get all workout dates in the selected range
  const getWorkoutDates = (startDateStr, endDateStr, trainingDaysList) => {
    if (!startDateStr || !endDateStr || !trainingDaysList.length) {
      return [];
    }

    const workoutDates = [];
    const startCalendar = formatToCalendar(startDateStr);
    const endCalendar = formatToCalendar(endDateStr);

    const startDate = new Date(startCalendar);
    const endDate = new Date(endCalendar);
    const currentDate = new Date(startDate);

    // Convert training days to day numbers
    const trainingDayNumbers = trainingDaysList
      .map((day) => hebrewDayToNumber[day])
      .filter((num) => num !== undefined);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (trainingDayNumbers.includes(dayOfWeek)) {
        workoutDates.push(currentDate.toISOString().split("T")[0]);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return workoutDates;
  };

  useEffect(() => {
    loadTrainingProgram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTrainingProgram = async () => {
    try {
      setLoading(true);
      let userData = null;
      let docId = null;

      if (isUserMode) {
        // Load logged-in user's own document
        const targetEmail = user?.primaryEmailAddress?.emailAddress;
        if (!targetEmail) {
          setLoading(false);
          return;
        }
        const q = query(collection(db, "Users"));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          if (d.data().email === targetEmail) {
            userData = { id: d.id, ...d.data() };
            docId = d.id;
          }
        });
        if (docId) setCurrentUserId(docId);
      } else {
        // Admin viewing a specific student
        const userRef = doc(db, "Users", params.id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          userData = userSnap.data();
          docId = params.id;
        }
      }

      if (!userData) {
        setLoading(false);
        return;
      }

      // Load training days from boarding
      if (userData.boarding?.trainingDays) {
        setTrainingDays(userData.boarding.trainingDays);
      }

      // Load user's trainings
      if (userData.trainings) {
        setTrainings(userData.trainings);
      }

      // Load all trainings from the archive (Trainings collection)
      const archiveSnap = await getDocs(collection(db, "Trainings"));
      const archive = [];
      archiveSnap.forEach((d) => {
        archive.push({ id: d.id, ...d.data() });
      });
      setArchiveTrainings(archive);

      // Load existing training program
      if (userData.trainingProgram) {
        const {
          startDate: start,
          endDate: end,
          dayTrainingMap: existingMap,
        } = userData.trainingProgram;
        setStartDate(start);
        setEndDate(end);
        if (existingMap) {
          setDayTrainingMap(
            dbMapToUi(existingMap, userData.trainings, archive),
          );
        }
        updateMarkedDates(
          formatToCalendar(start),
          formatToCalendar(end),
          true,
          userData.boarding?.trainingDays || [],
        );
      }
    } catch (error) {
      console.error("Error loading training program:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateMarkedDates = (
    start,
    end,
    shouldMarkWorkoutDays = false,
    daysToMark = null,
  ) => {
    if (!start || !end) return;

    const marked = {};
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    const currentDate = new Date(startDateObj);

    // Use provided days or fall back to state
    const daysForMarking = daysToMark !== null ? daysToMark : trainingDays;

    // Get workout dates if we should mark them
    const workoutDates = shouldMarkWorkoutDays
      ? getWorkoutDates(
          formatToDisplay(start),
          formatToDisplay(end),
          daysForMarking,
        )
      : [];
    const workoutDatesSet = new Set(workoutDates);

    while (currentDate <= endDateObj) {
      const dateString = currentDate.toISOString().split("T")[0];
      const isWorkoutDay = workoutDatesSet.has(dateString);

      if (dateString === start) {
        marked[dateString] = {
          startingDay: true,
          color: isWorkoutDay ? "#4CAF50" : primaryColor,
          textColor: "white",
        };
      } else if (dateString === end) {
        marked[dateString] = {
          endingDay: true,
          color: isWorkoutDay ? "#4CAF50" : primaryColor,
          textColor: "white",
        };
      } else {
        marked[dateString] = {
          color: isWorkoutDay ? "#4CAF50" : primaryColor + "40",
          textColor: isWorkoutDay ? "white" : primaryColor,
        };
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    setSelectedRange(marked);
  };

  const onDayPress = (day) => {
    const dateString = day.dateString; // YYYY-MM-DD from calendar
    const displayDate = formatToDisplay(dateString); // DD/MM/YYYY for storage

    if (!startDate || (startDate && endDate)) {
      // Start new selection
      setStartDate(displayDate);
      setEndDate(null);
      setSelectedRange({
        [dateString]: {
          startingDay: true,
          color: primaryColor,
          textColor: "white",
        },
      });
    } else {
      // Complete selection
      const startCalendar = formatToCalendar(startDate);
      const start = new Date(startCalendar);
      const selected = new Date(dateString);

      if (selected < start) {
        // If selected date is before start, swap them
        setEndDate(startDate);
        setStartDate(displayDate);
        updateMarkedDates(dateString, startCalendar);
      } else {
        setEndDate(displayDate);
        updateMarkedDates(startCalendar, dateString);
      }
    }
  };

  const saveTrainingProgram = async () => {
    if (!startDate || !endDate) {
      Alert.alert(strings.error, strings.selectRange, [{ text: strings.ok }]);
      return;
    }

    // Check if all training days have assigned trainings
    const unassignedDays = trainingDays.filter((day) => !dayTrainingMap[day]);
    if (unassignedDays.length > 0) {
      Alert.alert(strings.error, strings.assignAllDays, [{ text: strings.ok }]);
      return;
    }

    try {
      setSaving(true);
      const userRef = doc(db, "Users", params.id);

      // Re-fetch the latest user data to get current trainings + graphs
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const currentTrainings = { ...(userData.trainings || {}) };

      // Build a map: archiveId → existing training key (for already-attached archive trainings)
      const archiveIdToKey = {};
      Object.entries(currentTrainings).forEach(([key, t]) => {
        if (t.archiveId) archiveIdToKey[t.archiveId] = key;
      });

      const today = new Date();
      const dateLabel = parseFloat(
        `${today.getDate()}.${today.getMonth() + 1}`,
      );

      const newTrainingEntries = {};
      const newGraphEntries = {};

      // archiveDocId → resolved training key (either existing or newly created)
      const resolvedKeyForArchiveId = {};

      // Find all unique archive IDs assigned to days
      const assignedArchiveIds = new Set(
        Object.values(dayTrainingMap).filter(
          (id) => id && !currentTrainings[id],
        ),
      );

      assignedArchiveIds.forEach((archiveDocId) => {
        if (archiveIdToKey[archiveDocId]) {
          // Already attached before — reuse existing key
          resolvedKeyForArchiveId[archiveDocId] = archiveIdToKey[archiveDocId];
          return;
        }
        // New archive training — create entry
        const archiveTraining = archiveTrainings.find(
          (t) => t.id === archiveDocId,
        );
        if (!archiveTraining) return;

        const randomId = generateRandomId();
        const trainingKey = `training_${randomId}`;
        resolvedKeyForArchiveId[archiveDocId] = trainingKey;

        newTrainingEntries[trainingKey] = {
          name: archiveTraining.name,
          exercises: archiveTraining.exercises,
          archiveId: archiveTraining.id,
        };

        // Initialize graphs
        if (archiveTraining.exercises?.length > 0) {
          const graphsEntry = {};
          archiveTraining.exercises.forEach((ex) => {
            const exerciseId = `${ex.bodyPartId}-${ex.exerciseIndex}`;
            graphsEntry[exerciseId] = {
              dates: [dateLabel],
              weights: [ex.weight || 0],
              sets: [ex.numOfSets || 0],
              reps: [ex.numOfReps || 0],
            };
          });
          newGraphEntries[`graphs.${trainingKey}`] = graphsEntry;
        }
      });

      // Remap dayTrainingMap: replace raw archive IDs with resolved training keys
      const resolvedDayTrainingMap = {};
      Object.entries(dayTrainingMap).forEach(([day, id]) => {
        resolvedDayTrainingMap[day] =
          resolvedKeyForArchiveId[id] !== undefined
            ? resolvedKeyForArchiveId[id]
            : id;
      });

      // Merge new training entries into currentTrainings
      const updatedTrainings = { ...currentTrainings, ...newTrainingEntries };

      await updateDoc(userRef, {
        trainings: updatedTrainings,
        trainingProgram: {
          startDate,
          endDate,
          dayTrainingMap: uiMapToDb(resolvedDayTrainingMap),
          updatedAt: new Date().toISOString(),
        },
        ...newGraphEntries,
      });

      // Update local state
      setTrainings(updatedTrainings);
      setDayTrainingMap(resolvedDayTrainingMap);

      // Update calendar to show workout days
      updateMarkedDates(
        formatToCalendar(startDate),
        formatToCalendar(endDate),
        true,
        trainingDays,
      );

      Alert.alert(strings.success, strings.programSaved, [
        { text: strings.ok },
      ]);
    } catch (error) {
      console.error("Error saving training program:", error);
      Alert.alert(strings.error, strings.saveFailed, [{ text: strings.ok }]);
    } finally {
      setSaving(false);
    }
  };

  const clearSelection = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedRange({});
    setDayTrainingMap({});
  };

  const handleToggleDay = (dayId) => {
    setTrainingDays((prev) => {
      if (prev.includes(dayId)) {
        // Also remove from dayTrainingMap so it gets deleted from DB on save
        setDayTrainingMap((prevMap) => {
          const updated = { ...prevMap };
          delete updated[dayId];
          return updated;
        });
        return prev.filter((d) => d !== dayId);
      }
      return [...prev, dayId];
    });
  };

  const saveUserSchedule = async () => {
    if (!currentUserId) return;
    if (trainingDays.length === 0) {
      Alert.alert(strings.error, strings.selectAtLeastOneDay, [
        { text: strings.ok },
      ]);
      return;
    }
    try {
      setSaving(true);
      const userRef = doc(db, "Users", currentUserId);

      // Re-fetch latest user data
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const currentTrainings = { ...(userData.trainings || {}) };

      // Build archiveId → existing key map
      const archiveIdToKey = {};
      Object.entries(currentTrainings).forEach(([key, t]) => {
        if (t.archiveId) archiveIdToKey[t.archiveId] = key;
      });

      const today = new Date();
      const dateLabel = parseFloat(
        `${today.getDate()}.${today.getMonth() + 1}`,
      );

      const newTrainingEntries = {};
      const newGraphEntries = {};
      const resolvedKeyForArchiveId = {};

      // Find all unique archive IDs assigned to days (values not already in trainings map)
      const assignedArchiveIds = new Set(
        Object.values(dayTrainingMap).filter(
          (id) => id && !currentTrainings[id],
        ),
      );

      assignedArchiveIds.forEach((archiveDocId) => {
        if (archiveIdToKey[archiveDocId]) {
          resolvedKeyForArchiveId[archiveDocId] = archiveIdToKey[archiveDocId];
          return;
        }
        const archiveTraining = archiveTrainings.find(
          (t) => t.id === archiveDocId,
        );
        if (!archiveTraining) return;

        const randomId = generateRandomId();
        const trainingKey = `training_${randomId}`;
        resolvedKeyForArchiveId[archiveDocId] = trainingKey;

        newTrainingEntries[trainingKey] = {
          name: archiveTraining.name,
          exercises: archiveTraining.exercises,
          archiveId: archiveTraining.id,
        };

        if (archiveTraining.exercises?.length > 0) {
          const graphsEntry = {};
          archiveTraining.exercises.forEach((ex) => {
            const exerciseId = `${ex.bodyPartId}-${ex.exerciseIndex}`;
            graphsEntry[exerciseId] = {
              dates: [dateLabel],
              weights: [ex.weight || 0],
              sets: [ex.numOfSets || 0],
              reps: [ex.numOfReps || 0],
            };
          });
          newGraphEntries[`graphs.${trainingKey}`] = graphsEntry;
        }
      });

      // Remap dayTrainingMap: replace raw archive IDs with resolved training keys
      const resolvedDayTrainingMap = {};
      Object.entries(dayTrainingMap).forEach(([day, id]) => {
        resolvedDayTrainingMap[day] =
          resolvedKeyForArchiveId[id] !== undefined
            ? resolvedKeyForArchiveId[id]
            : id;
      });

      const updatedTrainings = { ...currentTrainings, ...newTrainingEntries };

      const updateData = {
        "boarding.trainingDays": trainingDays,
        "boarding.trainingFrequency": String(trainingDays.length),
        trainings: updatedTrainings,
        ...newGraphEntries,
      };

      // Only update dayTrainingMap if a training program exists
      if (startDate && endDate) {
        updateData["trainingProgram.dayTrainingMap"] = uiMapToDb(
          resolvedDayTrainingMap,
        );
      }

      await updateDoc(userRef, updateData);

      // Update local state
      setTrainings(updatedTrainings);
      setDayTrainingMap(resolvedDayTrainingMap);

      // Refresh calendar markers with new days
      if (startDate && endDate) {
        updateMarkedDates(
          formatToCalendar(startDate),
          formatToCalendar(endDate),
          true,
          trainingDays,
        );
      }

      Alert.alert(strings.success, strings.userScheduleSaved, [
        { text: strings.ok },
      ]);
    } catch (error) {
      console.error("Error saving user schedule:", error);
      Alert.alert(strings.error, strings.saveFailed, [{ text: strings.ok }]);
    } finally {
      setSaving(false);
    }
  };

  const handleTrainingSelect = (day, trainingKey) => {
    setDayTrainingMap((prev) => ({
      ...prev,
      [day]: trainingKey,
    }));
    setShowDropdown(null);
  };

  const getTrainingName = (trainingKey) => {
    if (!trainingKey) return strings.notSelected;
    if (trainings[trainingKey])
      return trainings[trainingKey].name || trainingKey;
    const found = archiveTrainings.find((t) => t.id === trainingKey);
    if (found) return found.name || trainingKey;
    return strings.notSelected;
  };

  // Returns combined list: student's own trainings first (highlighted), then archive-only
  const getCombinedTrainingsForDropdown = () => {
    const studentId = isUserMode ? currentUserId : params.id;
    const result = [];

    // Student's own trainings (from their user doc map)
    Object.entries(trainings).forEach(([key, t]) => {
      result.push({ key, name: t.name || key, isStudentOwn: true });
    });

    // Collect archive IDs already attached to this student (to avoid duplicates)
    const attachedArchiveIds = new Set(
      Object.values(trainings)
        .map((t) => t.archiveId)
        .filter(Boolean),
    );

    // Archive trainings that do NOT belong to this student AND are not already attached
    archiveTrainings.forEach((t) => {
      if (t.userId !== studentId && !attachedArchiveIds.has(t.id)) {
        result.push({ key: t.id, name: t.name || t.id, isStudentOwn: false });
      }
    });

    // Sort within each group by name
    return result.sort((a, b) => {
      if (a.isStudentOwn && !b.isStudentOwn) return -1;
      if (!a.isStudentOwn && b.isStudentOwn) return 1;
      return a.name.localeCompare(b.name, "he");
    });
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StudentHeaderPage
        title={strings.title}
        imgUrl={params?.imgUrl || (isUserMode ? user?.imageUrl : null)}
      />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView style={styles.container}>
          {/* Info Card */}
          <View
            style={[styles.infoCard, { backgroundColor: primaryColor + "10" }]}
          >
            <Entypo name="info" size={24} color={primaryColor} />
            <Text style={styles.infoText}>
              {isUserMode ? strings.userInstructions : strings.instructions}
            </Text>
          </View>

          {/* Calendar */}
          <View style={styles.calendarContainer}>
            <Calendar
              markingType="period"
              markedDates={selectedRange}
              onDayPress={
                isUserMode
                  ? () =>
                      Toast.show({
                        type: "errorWithIcon",
                        text1: "פנה למאמן לשנות תקופת אימון",
                        text2: "חזור ולחץ על",
                        position: "top",
                        visibilityTime: 3000,
                      })
                  : onDayPress
              }
              minDate={
                isUserMode ? undefined : new Date().toISOString().split("T")[0]
              }
              renderArrow={(direction) => (
                <FontAwesome6
                  name={direction === "left" ? "chevron-right" : "chevron-left"}
                  size={16}
                  color={primaryColor}
                />
              )}
              theme={{
                calendarBackground: "#fff",
                textSectionTitleColor: "#000",
                selectedDayBackgroundColor: primaryColor,
                selectedDayTextColor: "#fff",
                todayTextColor: primaryColor,
                dayTextColor: "#2d4150",
                textDisabledColor: "#d9e1e8",
                monthTextColor: "#000",
                textMonthFontWeight: "bold",
                textDayHeaderFontWeight: "600",
                arrowColor: primaryColor,
              }}
              style={styles.calendar}
            />
          </View>
          {/* ── ADMIN sections ── */}
          {!isUserMode && (
            <>
              {/* Selected Range Display */}
              {startDate && (
                <View
                  style={[
                    styles.rangeCard,
                    { borderColor: primaryColor + "20" },
                  ]}
                >
                  <View style={styles.rangeRow}>
                    <Text style={styles.rangeTitle}>
                      {strings.selectedRange}:
                    </Text>
                    <View style={styles.datesRow}>
                      <Text style={styles.dateValue}>{startDate}</Text>
                      {endDate && (
                        <>
                          <FontAwesome6
                            name="arrow-right"
                            size={14}
                            color={primaryColor}
                          />
                          <Text style={styles.dateValue}>{endDate}</Text>
                        </>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={clearSelection}
                      style={styles.clearButton}
                    >
                      <FontAwesome6
                        name="xmark"
                        size={16}
                        color={primaryColor}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Training Days Assignment */}
              {startDate && endDate && trainingDays.length > 0 && (
                <View style={styles.assignmentSection}>
                  <View style={styles.sectionHeader}>
                    <FontAwesome6
                      name="calendar-days"
                      size={20}
                      color={primaryColor}
                    />
                    <Text style={styles.sectionTitle}>
                      {strings.assignTrainings}
                    </Text>
                  </View>

                  {trainingDays.map((day) => (
                    <View key={day} style={styles.dayCard}>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>{day}</Text>

                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() =>
                            setShowDropdown(showDropdown === day ? null : day)
                          }
                        >
                          <Text style={styles.dropdownButtonText}>
                            {getTrainingName(dayTrainingMap[day])}
                          </Text>
                          <MaterialIcons
                            name={
                              showDropdown === day
                                ? "arrow-drop-up"
                                : "arrow-drop-down"
                            }
                            size={24}
                            color={primaryColor}
                          />
                        </TouchableOpacity>
                      </View>

                      {showDropdown === day && (
                        <View style={styles.dropdownMenu}>
                          {getCombinedTrainingsForDropdown().length === 0 ? (
                            <Text style={styles.noTrainingsText}>
                              {strings.noTrainings}
                            </Text>
                          ) : (
                            getCombinedTrainingsForDropdown().map(
                              (t, idx, arr) => {
                                const isSelected =
                                  dayTrainingMap[day] === t.key;
                                const prevIsOwn =
                                  idx > 0 ? arr[idx - 1].isStudentOwn : null;
                                const showSeparator =
                                  idx > 0 && prevIsOwn && !t.isStudentOwn;
                                return (
                                  <React.Fragment key={t.key}>
                                    {showSeparator && (
                                      <View style={styles.dropdownSeparator}>
                                        <Text
                                          style={styles.dropdownSeparatorText}
                                        >
                                          {strings.archiveTrainings}
                                        </Text>
                                      </View>
                                    )}
                                    <TouchableOpacity
                                      style={[
                                        styles.dropdownItem,
                                        t.isStudentOwn && {
                                          backgroundColor: primaryColor + "18",
                                        },
                                        isSelected && {
                                          backgroundColor: primaryColor + "10",
                                        },
                                      ]}
                                      onPress={() =>
                                        handleTrainingSelect(day, t.key)
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.dropdownItemText,
                                          isSelected && {
                                            fontWeight: "600",
                                            color: primaryColor,
                                          },
                                        ]}
                                      >
                                        {t.name}
                                      </Text>
                                      {isSelected && (
                                        <FontAwesome6
                                          name="check"
                                          size={16}
                                          color={primaryColor}
                                        />
                                      )}
                                    </TouchableOpacity>
                                  </React.Fragment>
                                );
                              },
                            )
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Warning if no training days */}
              {startDate && endDate && trainingDays.length === 0 && (
                <View style={styles.warningCard}>
                  <FontAwesome6
                    name="triangle-exclamation"
                    size={20}
                    color="#ff9800"
                  />
                  <Text style={styles.warningText}>
                    {strings.noTrainingDays}
                  </Text>
                </View>
              )}

              {/* Admin Save Button */}
              {startDate && endDate && trainingDays.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: primaryColor },
                    saving && styles.saveButtonDisabled,
                  ]}
                  onPress={saveTrainingProgram}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <FontAwesome6 name="save" size={20} color="#fff" />
                      <Text style={styles.saveButtonText}>{strings.save}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── USER sections ── */}
          {isUserMode && (
            <>
              {/* Training Days Selector */}
              <View style={styles.assignmentSection}>
                <View style={styles.sectionHeader}>
                  <FontAwesome6
                    name="calendar-days"
                    size={20}
                    color={primaryColor}
                  />
                  <Text style={styles.sectionTitle}>
                    {strings.myTrainingDays}
                  </Text>
                </View>
                <View style={styles.daysGrid}>
                  {daysOfWeek.map((day) => {
                    const isSelected = trainingDays.includes(day.id);
                    return (
                      <TouchableOpacity
                        key={day.id}
                        style={[
                          styles.dayChip,
                          isSelected && {
                            backgroundColor: primaryColor,
                            borderColor: primaryColor,
                          },
                        ]}
                        onPress={() => handleToggleDay(day.id)}
                      >
                        <Text
                          style={[
                            styles.dayChipText,
                            isSelected && styles.dayChipTextSelected,
                          ]}
                        >
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Training Assignment (only if program exists) */}
              {startDate && endDate && trainingDays.length > 0 && (
                <View style={styles.assignmentSection}>
                  <View style={styles.sectionHeader}>
                    <FontAwesome6
                      name="dumbbell"
                      size={20}
                      color={primaryColor}
                    />
                    <Text style={styles.sectionTitle}>
                      {strings.assignTrainings}
                    </Text>
                  </View>

                  {trainingDays.map((day) => (
                    <View key={day} style={styles.dayCard}>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>{day}</Text>

                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() =>
                            setShowDropdown(showDropdown === day ? null : day)
                          }
                        >
                          <Text style={styles.dropdownButtonText}>
                            {getTrainingName(dayTrainingMap[day])}
                          </Text>
                          <MaterialIcons
                            name={
                              showDropdown === day
                                ? "arrow-drop-up"
                                : "arrow-drop-down"
                            }
                            size={24}
                            color={primaryColor}
                          />
                        </TouchableOpacity>
                      </View>

                      {showDropdown === day && (
                        <View style={styles.dropdownMenu}>
                          {getCombinedTrainingsForDropdown().length === 0 ? (
                            <Text style={styles.noTrainingsText}>
                              {strings.noTrainings}
                            </Text>
                          ) : (
                            getCombinedTrainingsForDropdown().map(
                              (t, idx, arr) => {
                                const isSelected =
                                  dayTrainingMap[day] === t.key;
                                const prevIsOwn =
                                  idx > 0 ? arr[idx - 1].isStudentOwn : null;
                                const showSeparator =
                                  idx > 0 && prevIsOwn && !t.isStudentOwn;
                                return (
                                  <React.Fragment key={t.key}>
                                    {showSeparator && (
                                      <View style={styles.dropdownSeparator}>
                                        <Text
                                          style={styles.dropdownSeparatorText}
                                        >
                                          {strings.archiveTrainings}
                                        </Text>
                                      </View>
                                    )}
                                    <TouchableOpacity
                                      style={[
                                        styles.dropdownItem,
                                        t.isStudentOwn && {
                                          backgroundColor: primaryColor + "18",
                                        },
                                        isSelected && {
                                          backgroundColor: primaryColor + "10",
                                        },
                                      ]}
                                      onPress={() =>
                                        handleTrainingSelect(day, t.key)
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.dropdownItemText,
                                          isSelected && {
                                            fontWeight: "600",
                                            color: primaryColor,
                                          },
                                        ]}
                                      >
                                        {t.name}
                                      </Text>
                                      {isSelected && (
                                        <FontAwesome6
                                          name="check"
                                          size={16}
                                          color={primaryColor}
                                        />
                                      )}
                                    </TouchableOpacity>
                                  </React.Fragment>
                                );
                              },
                            )
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* User Save Button */}
              {trainingDays.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: primaryColor },
                    saving && styles.saveButtonDisabled,
                  ]}
                  onPress={saveUserSchedule}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <FontAwesome6 name="save" size={20} color="#fff" />
                      <Text style={styles.saveButtonText}>
                        {strings.saveUserSchedule}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const strings = {
  title: "יומן אימונים",
  instructions: "בחר/י טווח תאריכים לתכנית האימונים של המתאמן/ת.",
  userInstructions:
    "כאן תוכל/י לראות את תכנית האימונים שלך, לעדכן את ימי האימון ולשבץ אימונים לכל יום.",
  selectedRange: "טווח נבחר",
  assignTrainings: "שיבוץ אימונים לימים",
  myTrainingDays: "ימי האימון שלי",
  notSelected: "בחר אימון",
  noTrainings: "אין אימונים זמינים.",
  archiveTrainings: "אימונים מהארכיון",
  noTrainingDays: "המתאמן/ת לא הגדיר/ה ימי אימון. יש לעדכן את פרטי המתאמן.",
  save: "שמור תכנית אימונים",
  saveUserSchedule: "שמור שינויים",
  success: "הצלחה",
  ok: "אישור",
  programSaved: "תכנית האימונים נשמרה בהצלחה!",
  userScheduleSaved: "ימי האימון עודכנו בהצלחה!",
  error: "שגיאה",
  selectRange: "אנא בחר/י גם תאריך התחלה וגם תאריך סיום",
  selectAtLeastOneDay: "יש לבחור לפחות יום אימון אחד",
  assignAllDays: "יש לשבץ אימון לכל ימי האימון",
  saveFailed: "השמירה נכשלה. אנא נסה/י שוב.",
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  rangeCard: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  rangeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rangeTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  datesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clearButton: {
    padding: 4,
  },
  dateValue: {
    fontSize: 15,
  },
  calendarContainer: {
    direction: "rtl",
  },
  calendar: {
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  assignmentSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  dayCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  dayRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  dropdownButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minWidth: 150,
    gap: 8,
  },
  dropdownButtonText: {
    fontSize: 15,
    color: "#333",
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSecondary,
  },
  dropdownItemSelected: {},
  dropdownItemText: {
    fontSize: 15,
    color: "#333",
  },
  dropdownItemTextSelected: {
    fontWeight: "600",
  },
  noTrainingsText: {
    padding: 12,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
  dropdownItemStudentOwn: {},
  dropdownSeparator: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },
  dropdownSeparatorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textAlign: "right",
    textTransform: "uppercase",
  },
  daysGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#f8f9fa",
  },
  dayChipSelected: {},
  dayChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  dayChipTextSelected: {
    color: "#fff",
  },
  warningCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#fff3cd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ffc107",
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#856404",
    textAlign: "right",
  },
});
