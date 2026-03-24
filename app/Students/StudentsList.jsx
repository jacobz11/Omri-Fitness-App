import { View, StyleSheet } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../configs/FirebaseConfig";
import StudentCard from "./StudentCard";
import { useRouter, useFocusEffect } from "expo-router";
import HeaderPage from "../../components/HeaderPage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthContext } from "../../components/AuthContext";
import Search from "../../components/Search/Search";

export default function StudentsList() {
  const { user } = useAuthContext();
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      GetAllUsers();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]),
  );

  const GetAllUsers = async (isRefreshing = false) => {
    if (!isRefreshing) {
      setLoading(true);
    }
    try {
      if (!user?.primaryEmailAddress?.emailAddress) {
        if (!isRefreshing) {
          setLoading(false);
        }
        return;
      }

      // Fetch admin emails to exclude them from the list
      // const adminsSnapshot = await getDocs(collection(db, "Admins"));
      // const adminEmails = new Set(
      //   adminsSnapshot.docs.map((doc) => doc.data().email).filter(Boolean),
      // );

      const users = [];
      const q = query(
        collection(db, "Users"),
        where("email", "!=", user.primaryEmailAddress.emailAddress),
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // if (!adminEmails.has(data.email)) {
        users.push({ id: doc.id, ...data });
        // }
      });

      // Helper function to convert to timestamp in milliseconds
      const getTimestamp = (dateValue) => {
        if (!dateValue) return 0;

        // If it's a Firestore Timestamp with toDate method
        if (dateValue.toDate && typeof dateValue.toDate === "function") {
          return dateValue.toDate().getTime();
        }

        // If it's already a Date object
        if (dateValue instanceof Date) {
          return dateValue.getTime();
        }

        // If it's a string in format "DD/MM/YYYY | HH:MM"
        if (typeof dateValue === "string") {
          // Parse format: "13/02/2026 | 20:26" -> DD/MM/YYYY | HH:MM
          const parts = dateValue.trim().split(" | ");
          if (parts.length === 2) {
            const dateParts = parts[0].split("/"); // ["13", "02", "2026"]
            const timeParts = parts[1].split(":"); // ["20", "26"]

            if (dateParts.length === 3 && timeParts.length === 2) {
              const day = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
              const year = parseInt(dateParts[2], 10); // Already full year: 2026
              const hour = parseInt(timeParts[0], 10);
              const minute = parseInt(timeParts[1], 10);

              const date = new Date(year, month, day, hour, minute);
              return date.getTime();
            }
          }
        }

        // Fallback: try to parse as date string
        return new Date(dateValue).getTime();
      };

      // Sort users by createdAt in descending order (newest first)
      // Sorting by exact timestamp including hours, minutes, seconds
      users.sort((a, b) => {
        const timeA = getTimestamp(a.createdAt);
        const timeB = getTimestamp(b.createdAt);

        // Sort descending (newest first)
        return timeB - timeA;
      });

      setUsersList(users);
    } catch (error) {
      console.error("Error fetching users", error);
    } finally {
      if (!isRefreshing) {
        setLoading(false);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await GetAllUsers(true);
    setRefreshing(false);
  };

  // Adapt flat students list to the bodyPart/exercises shape Search expects
  const adaptedForSearch = useMemo(
    () =>
      usersList.map((student) => ({
        id: student.id,
        bodyPart: student?.boarding?.fullName?.trim() || student?.name || "",
        exercises: [
          {
            ...student,
            name: student?.boarding?.fullName?.trim() || student?.name || "",
          },
        ],
      })),
    [usersList],
  );

  const StudentCardAdapter = useCallback(
    ({ item, index }) => (
      <StudentCard item={item.exercises[0]} router={router} index={index} />
    ),
    [router],
  );

  return (
    <SafeAreaView style={styles.mainContainer}>
      <HeaderPage title={strings.title} />
      <View style={styles.container}>
        <Search
          bodyPartsList={adaptedForSearch}
          loading={loading}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          router={router}
          BodyPartCard={StudentCardAdapter}
          numColumns={1}
          listContentContainerStyle={styles.flat}
          searchPlaceholder="חפש מתאמנים..."
          searchMarginHorizontal={10}
          renderSearchItem={(item) => (
            <StudentCard
              item={item}
              router={router}
              index={item.originalIndex}
            />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const strings = {
  title: "רשימת המתאמנים שלי",
};
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 10,
  },
  flat: {
    paddingBottom: 50,
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 10,
  },
});
