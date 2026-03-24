import { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../../constants/Colors";
import Toast from "react-native-toast-message";
import StudentHeaderPage from "../StudentHeaderPage";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../../components/ThemeContext";
import { useUser } from "@clerk/clerk-expo";
import { useAuthContext } from "../../../components/AuthContext";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../../configs/FirebaseConfig";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";

// ── Training completion helpers ─────────────────────────────────────────────
const hebrewDayToNumber = {
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  שבת: 6,
};

const parseDisplayDate = (str) => {
  if (!str || typeof str !== "string") return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  return new Date(`${year}-${month}-${day}`);
};

const countTrainingDays = (startDate, endDate, dayNumbers) => {
  if (!startDate || !endDate || !dayNumbers.length) return 0;
  let count = 0;
  const cur = new Date(startDate);
  while (cur <= endDate) {
    if (dayNumbers.includes(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// ── Bar colours ──────────────────────────────────────────────────────────────
const BAR_COLORS = {
  weight: "#4A90D9",
  sets: "#5CB85C",
  reps: "#F0AD4E",
};

const LEGEND_LABELS = {
  weight: "משקל",
  sets: "סטים",
  reps: "חזרות",
};
const COLOR_TO_LABEL = {
  [BAR_COLORS.weight]: LEGEND_LABELS.weight,
  [BAR_COLORS.sets]: LEGEND_LABELS.sets,
  [BAR_COLORS.reps]: LEGEND_LABELS.reps,
};
// ── Dynamic bar width based on date count ────────────────────────────────────
const getBarWidth = (dateCount) => {
  if (dateCount <= 4) return 20;
  if (dateCount <= 8) return 16;
  if (dateCount <= 12) return 12;
  return 10;
};

const getGroupSpacing = (dateCount) => {
  if (dateCount <= 4) return 20;
  if (dateCount <= 8) return 14;
  return 10;
};

// ── Transform exercise data into gifted-charts bar data ───────────────────────
const buildChartData = (exerciseData) => {
  const { dates, weights, sets, reps } = exerciseData;
  const barWidth = getBarWidth(dates.length);
  const groupSpacing = getGroupSpacing(dates.length);
  const data = [];

  dates.forEach((date, i) => {
    const isLast = i === dates.length - 1;
    const groupBars = [];

    if (weights[i] > 0) {
      groupBars.push({ value: weights[i], frontColor: BAR_COLORS.weight });
    }
    if (sets[i] > 0) {
      groupBars.push({ value: sets[i], frontColor: BAR_COLORS.sets });
    }
    if (reps[i] > 0) {
      groupBars.push({ value: reps[i], frontColor: BAR_COLORS.reps });
    }

    if (groupBars.length === 0) return;

    // Label on first bar of group; width covers all bars + inner spacing
    const labelWidth =
      barWidth * groupBars.length + (groupBars.length - 1) * 2 + 10;
    groupBars[0] = {
      ...groupBars[0],
      label: `${date}`,
      labelWidth,
      labelTextStyle: { color: "#666", fontSize: 10, textAlign: "center" },
    };

    // Inner bars get spacing 2; last bar gets group spacing (or 2 if last date)
    groupBars.forEach((bar, j) => {
      groupBars[j] = {
        ...bar,
        spacing: j < groupBars.length - 1 ? 2 : isLast ? 2 : groupSpacing,
      };
    });

    data.push(...groupBars);
  });

  return { data, barWidth };
};

// ── Max Y value ──────────────────────────────────────────────────────────────
const getMaxValue = (exerciseData) => {
  const { weights, sets, reps } = exerciseData;
  const max = Math.max(...weights, ...sets, ...reps);
  return Math.ceil(max / 5) * 5 + 5;
};

// ── Main component ────────────────────────────────────────────────────────────
export default function StudentGraphs() {
  const params = useLocalSearchParams();
  const { primaryColor } = useTheme();
  const { user } = useUser();
  const { isAdmin } = useAuthContext();

  const [graphsData, setGraphsData] = useState({});
  const [trainingsData, setTrainingsData] = useState({});
  const [bodyPartsData, setBodyPartsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);

  // ── Completion stats state ───────────────────────────────────────────────
  const [totalTrainings, setTotalTrainings] = useState(0);
  const [completedTrainings, setCompletedTrainings] = useState(0);
  const [hasProgramData, setHasProgramData] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      let userSnap;

      if (isAdmin && params.id) {
        // Admin viewing a student — use the document ID directly
        const userRef = doc(db, "Users", params.id);
        userSnap = await getDoc(userRef);
      } else {
        // Regular user — find their document by email
        const email = user?.primaryEmailAddress?.emailAddress;
        if (!email) return;
        const allUsersSnap = await getDocs(collection(db, "Users"));
        const match = allUsersSnap.docs.find((d) => d.data().email === email);
        if (!match) return;
        userSnap = match;
      }

      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const userGraphs = userData.graphs || {};
      const userTrainings = userData.trainings || {};

      const bodyPartsSnap = await getDocs(collection(db, "BodyParts"));
      const bodyParts = {};
      bodyPartsSnap.forEach((d) => {
        bodyParts[d.id] = { id: d.id, ...d.data() };
      });

      setBodyPartsData(bodyParts);
      setGraphsData(userGraphs);
      setTrainingsData(userTrainings);

      const trainingIds = Object.keys(userGraphs);
      if (trainingIds.length > 0) {
        setSelectedTraining(trainingIds[0]);
        const exIds = Object.keys(userGraphs[trainingIds[0]]);
        if (exIds.length > 0) setSelectedExercise(exIds[0]);
      }

      // ── Load completion stats ──────────────────────────────────────────
      const completed =
        typeof userData.trainingsCompleted === "number"
          ? userData.trainingsCompleted
          : 0;
      setCompletedTrainings(completed);

      const program = userData.trainingProgram;
      const startRaw =
        typeof program?.startDate === "string" ? program.startDate : null;
      const endRaw =
        typeof program?.endDate === "string" ? program.endDate : null;

      if (startRaw && endRaw) {
        const start = parseDisplayDate(startRaw);
        const end = parseDisplayDate(endRaw);

        let trainingDayNames = [];
        if (program.dayTrainingMap) {
          trainingDayNames = Object.values(program.dayTrainingMap)
            .map((v) => v?.day)
            .filter(Boolean);
        } else if (userData.boarding?.trainingDays) {
          trainingDayNames = Array.isArray(userData.boarding.trainingDays)
            ? userData.boarding.trainingDays
            : [];
        }

        const dayNumbers = trainingDayNames
          .filter((d) => d != null && typeof d === "string")
          .map((d) => hebrewDayToNumber[d])
          .filter((n) => typeof n === "number");

        const total = countTrainingDays(start, end, dayNumbers);
        setTotalTrainings(total);
        setHasProgramData(true);
      }
    } catch (error) {
      console.error("Error loading graphs data:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Resolve display names ────────────────────────────────────────────────
  const getExerciseName = (exerciseId) => {
    const lastDash = exerciseId.lastIndexOf("-");
    if (lastDash === -1) return exerciseId;
    const bodyPartId = exerciseId.substring(0, lastDash);
    const index = parseInt(exerciseId.substring(lastDash + 1));
    const bodyPart = bodyPartsData[bodyPartId];
    return bodyPart?.exercises?.[index]?.name || exerciseId;
  };

  const getTrainingName = (trainingKey) =>
    trainingsData[trainingKey]?.name || trainingKey;

  const trainingIds = Object.keys(graphsData);
  const exerciseIds = selectedTraining
    ? Object.keys(graphsData[selectedTraining] || {})
    : [];

  const handleSelectTraining = (tid) => {
    setSelectedTraining(tid);
    setSelectedExercise(Object.keys(graphsData[tid])[0]);
    setTrainingOpen(false);
  };

  const exerciseData =
    selectedTraining && selectedExercise
      ? graphsData[selectedTraining]?.[selectedExercise]
      : null;

  const chartResult = useMemo(
    () => (exerciseData ? buildChartData(exerciseData) : null),
    [exerciseData],
  );
  const chartData = chartResult?.data ?? [];
  const barWidth = chartResult?.barWidth ?? 20;
  const maxValue = exerciseData ? getMaxValue(exerciseData) : 10;
  const stepValue = 5;
  const noOfSections = maxValue / stepValue;

  // ── Completion pie chart data ────────────────────────────────────────────
  const remaining = Math.max(totalTrainings - completedTrainings, 0);
  const safeCompleted = Math.min(completedTrainings, totalTrainings);
  const percentage =
    totalTrainings > 0 ? Math.round((safeCompleted / totalTrainings) * 100) : 0;
  const pieData =
    totalTrainings === 0
      ? [{ value: 1, color: "#e0e0e0" }]
      : [
          { value: safeCompleted, color: primaryColor, focused: true },
          { value: remaining, color: "#e0e0e0" },
        ];

  const handleBarPress = useCallback((item) => {
    const label = COLOR_TO_LABEL[item.frontColor] || "";
    Toast.show({
      type: "success",
      text1: `${label}: ${item.value}`,
      visibilityTime: 2000,
      topOffset: 50,
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StudentHeaderPage
        title={strings.title}
        imgUrl={params?.imgUrl || (!isAdmin ? user?.imageUrl : undefined)}
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color={primaryColor}
          style={{ marginTop: 60 }}
        />
      ) : trainingIds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{strings.noData}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Dropdowns row ─────────────────────────────────────────────── */}
          <View style={styles.dropdownRow}>
            {/* Training dropdown */}
            <View style={styles.dropdownWrapper}>
              <Text style={styles.dropdownLabel}>{strings.training}</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownTrigger,
                  trainingOpen && {
                    borderColor: primaryColor,
                    backgroundColor: primaryColor + "08",
                  },
                ]}
                onPress={() => {
                  setTrainingOpen(!trainingOpen);
                  setExerciseOpen(false);
                }}
              >
                <Ionicons
                  name={trainingOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={trainingOpen ? primaryColor : "#888"}
                />
                <Text style={styles.dropdownTriggerText}>
                  {getTrainingName(selectedTraining)}
                </Text>
              </TouchableOpacity>
              {trainingOpen && (
                <View style={styles.dropdownList}>
                  {trainingIds.map((tid) => (
                    <TouchableOpacity
                      key={tid}
                      style={[
                        styles.dropdownItem,
                        selectedTraining === tid && {
                          backgroundColor: primaryColor + "20",
                        },
                      ]}
                      onPress={() => handleSelectTraining(tid)}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedTraining === tid && {
                            color: primaryColor,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {getTrainingName(tid)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Exercise dropdown */}
            <View style={styles.dropdownWrapper}>
              <Text style={styles.dropdownLabel}>{strings.exercise}</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownTrigger,
                  exerciseOpen && {
                    borderColor: primaryColor,
                    backgroundColor: primaryColor + "08",
                  },
                ]}
                onPress={() => {
                  setExerciseOpen(!exerciseOpen);
                  setTrainingOpen(false);
                }}
              >
                <Ionicons
                  name={exerciseOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={exerciseOpen ? primaryColor : "#888"}
                />
                <Text
                  style={styles.dropdownTriggerText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {getExerciseName(selectedExercise)}
                </Text>
              </TouchableOpacity>
              {exerciseOpen && (
                <View style={styles.dropdownList}>
                  {exerciseIds.map((eid) => (
                    <TouchableOpacity
                      key={eid}
                      style={[
                        styles.dropdownItem,
                        selectedExercise === eid && {
                          backgroundColor: primaryColor + "20",
                        },
                      ]}
                      onPress={() => {
                        setSelectedExercise(eid);
                        setExerciseOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedExercise === eid && {
                            color: primaryColor,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {getExerciseName(eid)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* ── Chart card ──────────────────────────────────────────────────── */}
          <View style={styles.card}>
            {/* Legend */}
            <View style={styles.legend}>
              {Object.entries(BAR_COLORS).map(([metric, color]) => (
                <View key={metric} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: color }]}
                  />
                  <Text style={styles.legendText}>{LEGEND_LABELS[metric]}</Text>
                </View>
              ))}
            </View>

            {/* Bar chart – built-in scroll keeps Y-axis pinned */}
            {exerciseData && chartData.length > 0 ? (
              <BarChart
                key={`${selectedTraining}-${selectedExercise}`}
                data={chartData}
                barWidth={barWidth}
                barBorderRadius={4}
                maxValue={maxValue}
                noOfSections={noOfSections}
                stepValue={stepValue}
                yAxisThickness={1}
                xAxisThickness={1}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                rulesColor="#E0E0E0"
                yAxisColor="#ccc"
                xAxisColor="#ccc"
                backgroundColor="transparent"
                isAnimated
                animationDuration={600}
                showGradient={false}
                hideRules={false}
                scrollToEnd={false}
                height={220}
                onPress={handleBarPress}
              />
            ) : (
              <View style={styles.emptyChartContainer}>
                <Text style={styles.emptyText}>{strings.noExerciseData}</Text>
              </View>
            )}

            {/* X-axis note */}
            <Text style={styles.axisNote}>{strings.axisNote}</Text>
          </View>

          {/* ── Completion card ──────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.completionCard}
          >
            <Animated.Text
              entering={FadeInDown.delay(100).duration(400)}
              style={styles.completionTitle}
            >
              {strings.completionTitle}
            </Animated.Text>

            <Animated.View
              entering={ZoomIn.delay(200).duration(500)}
              style={styles.pieWrapper}
            >
              <PieChart
                data={pieData}
                donut
                radius={hp(12)}
                innerRadius={hp(8)}
                innerCircleColor="#fff"
                centerLabelComponent={() => (
                  <View style={styles.centerLabel}>
                    <Text
                      style={[styles.centerPercentage, { color: primaryColor }]}
                    >
                      {percentage}%
                    </Text>
                    <Text style={styles.centerSubtext}>{strings.done}</Text>
                  </View>
                )}
              />
            </Animated.View>

            {hasProgramData ? (
              <Animated.View
                entering={FadeInUp.delay(350).duration(400)}
                style={styles.statsRow}
              >
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: primaryColor }]}>
                    {safeCompleted}
                  </Text>
                  <Text style={styles.statLabel}>{strings.completed}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: "#333" }]}>
                    {totalTrainings}
                  </Text>
                  <Text style={styles.statLabel}>{strings.total}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: "#aaa" }]}>
                    {remaining}
                  </Text>
                  <Text style={styles.statLabel}>{strings.remaining}</Text>
                </View>
              </Animated.View>
            ) : (
              <Animated.Text
                entering={FadeInUp.delay(350).duration(400)}
                style={styles.noProgramText}
              >
                {strings.noProgram}
              </Animated.Text>
            )}

            <Animated.View
              entering={FadeInUp.delay(450).duration(400)}
              style={styles.pieLegend}
            >
              <View style={styles.pieLegendItem}>
                <View
                  style={[
                    styles.pieLegendDot,
                    { backgroundColor: primaryColor },
                  ]}
                />
                <Text style={styles.pieLegendText}>
                  {strings.completedLabel}
                </Text>
              </View>
              <View style={styles.pieLegendItem}>
                <View
                  style={[styles.pieLegendDot, { backgroundColor: "#e0e0e0" }]}
                />
                <Text style={styles.pieLegendText}>
                  {strings.remainingLabel}
                </Text>
              </View>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Hebrew strings ───────────────────────────────────────────────────────────
const strings = {
  title: "גרפים וסטטיסטיקות",
  training: "אימון",
  exercise: "תרגיל",
  axisNote: "תאריכי התרגיל",
  noData: "אין נתוני גרפים עדיין",
  noExerciseData: "אין נתונים לתרגיל זה",
  completionTitle: "השלמת אימונים",
  done: "הושלמו",
  completed: "הושלמו",
  total: "סה״כ",
  remaining: "נותרו",
  completedLabel: "אימונים שהושלמו",
  remainingLabel: "אימונים שנותרו",
  noProgram: "לא הוגדרה תכנית אימונים עבור מתאמן זה.",
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 40,
  },
  dropdownRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
    marginBottom: 16,
    marginTop: 4,
    zIndex: 10,
  },
  dropdownWrapper: {
    flex: 1,
    position: "relative",
    zIndex: 10,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    textAlign: "right",
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D0D0D0",
    gap: 8,
    justifyContent: "space-between",
  },
  dropdownTriggerOpen: {},
  dropdownTriggerText: {
    fontSize: 14,
    color: "#222",
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  dropdownList: {
    position: "absolute",
    top: "100%",
    right: 0,
    left: 0,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0D0D0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  dropdownItemActive: {},
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
    textAlign: "right",
  },
  dropdownItemTextActive: {
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: "hidden",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
    gap: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: "#444",
    fontSize: 12,
  },
  axisText: {
    color: "#888",
    fontSize: 10,
  },
  axisNote: {
    color: "#999",
    fontSize: 11,
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
  },
  emptyChartContainer: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#999",
    fontSize: 15,
    textAlign: "center",
  },
  completionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  completionTitle: {
    fontSize: hp(2.5),
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 10,
    textAlign: "center",
  },
  pieWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  centerLabel: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerPercentage: {
    fontSize: hp(3.5),
    fontWeight: "800",
  },
  centerSubtext: {
    fontSize: hp(1.5),
    color: "#999",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: hp(3),
    fontWeight: "800",
  },
  statLabel: {
    fontSize: hp(1.5),
    color: "#999",
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e0e0e0",
  },
  pieLegend: {
    flexDirection: "row-reverse",
    gap: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pieLegendItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  pieLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pieLegendText: {
    fontSize: hp(1.6),
    color: "#555",
    fontWeight: "500",
  },
  noProgramText: {
    fontSize: hp(1.8),
    color: "#999",
    textAlign: "center",
    marginVertical: 20,
  },
});
