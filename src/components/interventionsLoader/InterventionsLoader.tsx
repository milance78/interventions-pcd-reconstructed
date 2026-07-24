import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../../firebase/firebaseConfig";
import {
  loadCompleteHistory,
  loadDailySummary,
  loadInterventions,
} from "../../firebase/interventionsService";
import {
  clearHistory,
  setHistory,
  setHistoryError,
  startHistoryRefresh,
} from "../../redux/features/historySlice";
import { setInterventions } from "../../redux/features/interventionsListSlice";
import { setStatistics } from "../../redux/features/statisticsSlice";
import { useAppDispatch } from "../../redux/store";

const getLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const InterventionsLoader = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        dispatch(setInterventions([]));
        dispatch(clearHistory());
        return;
      }

      const today = getLocalDate();
      dispatch(startHistoryRefresh());

      const todayPromise = loadInterventions(user.uid, today)
        .then((interventions) => {
          dispatch(setInterventions(interventions));
        })
        .catch((error) => {
          console.error("Unable to load interventions:", error);
          dispatch(setInterventions([]));
        });

      const statisticsPromise = loadDailySummary(user.uid, today)
        .then((summary) => {
          const now = new Date();

          dispatch(
            setStatistics({
              date: now.toLocaleDateString("fr-BE"),
              time: now.toLocaleTimeString("fr-BE"),
              total: summary?.total ?? 0,
              completed: summary?.completed ?? 0,
              onHold: summary?.onHold ?? 0,
              transferred: summary?.transferred ?? 0,
              closedByAnotherAgent: summary?.closedByAnotherAgent ?? 0,
            }),
          );
        })
        .catch((error) => {
          console.error("Unable to load statistics:", error);
        });

      const historyPromise = loadCompleteHistory(user.uid)
        .then((days) => {
          dispatch(setHistory(days.flatMap((day) => day.interventions)));
        })
        .catch((error) => {
          console.error("Unable to load history:", error);
          dispatch(setHistoryError("Impossible de charger l'historique."));
        });

      await Promise.allSettled([
        todayPromise,
        statisticsPromise,
        historyPromise,
      ]);
    });

    return unsubscribe;
  }, [dispatch]);

  return null;
};

export default InterventionsLoader;
