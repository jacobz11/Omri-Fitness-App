import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../configs/FirebaseConfig";

/**
 * Formats a Date object as "DD/MM/YYYY | HH:MM" (matching the app convention).
 */
const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} | ${hours}:${minutes}`;
};

/**
 * Parses a "DD/MM/YYYY | HH:MM" string back to a timestamp (ms).
 * Returns 0 if the string is missing or malformed.
 */
const parseDateString = (str) => {
  if (!str || typeof str !== "string") return 0;
  // str format: "DD/MM/YYYY | HH:MM"
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) \| (\d{2}):(\d{2})$/);
  if (!match) return 0;
  const [, dd, mm, yyyy, hh, min] = match;
  return new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    0,
    0,
  ).getTime();
};

/**
 * Returns the timestamp (ms) of the most recent Saturday at 12:00 noon
 * (local device time).
 * Saturday = weekday index 6 in JS Date (0=Sun … 6=Sat).
 */
const getLastSaturdayNoon = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 (Sun) … 6 (Sat)

  // Days since the last Saturday (0 if today is Saturday)
  const daysSinceSaturday = (dayOfWeek + 1) % 7; // Sun→1, Mon→2, … Sat→0

  const lastSaturday = new Date(now);
  lastSaturday.setDate(now.getDate() - daysSinceSaturday);
  lastSaturday.setHours(12, 0, 0, 0); // noon

  // If today IS Saturday but it's before noon, go back 7 days
  if (daysSinceSaturday === 0 && now < lastSaturday) {
    lastSaturday.setDate(lastSaturday.getDate() - 7);
  }

  return lastSaturday.getTime();
};

/**
 * Fields that are reset on every training entry.
 */
const RESET_TRAINING_FIELDS = {
  completedExerciseIds: [],
  completedExercises: 0,
  repsCompleted: {},
  trainingRepsCompleted: 0,
  exerciseRepsDone: {},
};

/**
 * Checks whether a weekly reset is due for the given Firebase user document
 * (identified by `userId`).  If the user's `lastWeeklyReset` timestamp is
 * older than the most recent Saturday at 12:00, all training progress is
 * cleared and `lastWeeklyReset` is updated.
 *
 * Call this once after the user has been identified (e.g. in _layout.jsx).
 *
 * @param {string} userId  The Firestore document ID under the "Users" collection.
 */
export const runWeeklyResetIfNeeded = async (userId) => {
  if (!userId) return;

  try {
    const userDocRef = doc(db, "Users", userId);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    // lastWeeklyReset is stored as "DD/MM/YYYY | HH:MM"; fall back to 0 if absent
    const lastResetTs = parseDateString(userData.lastWeeklyReset);
    const lastSaturdayNoonTs = getLastSaturdayNoon();

    // Nothing to do if the stored reset is already this week or later
    if (lastResetTs >= lastSaturdayNoonTs) return;

    console.log("[weeklyReset] Weekly reset triggered for user:", userId);

    // Build a flat update object that resets every training's progress
    const trainings = userData.trainings || {};
    const updates = { lastWeeklyReset: formatDate(new Date()) };

    Object.keys(trainings).forEach((trainingKey) => {
      Object.entries(RESET_TRAINING_FIELDS).forEach(([field, emptyValue]) => {
        updates[`trainings.${trainingKey}.${field}`] = emptyValue;
      });
    });

    await updateDoc(userDocRef, updates);
    console.log("[weeklyReset] Reset complete.");
  } catch (error) {
    console.error("[weeklyReset] Error during weekly reset:", error);
  }
};
