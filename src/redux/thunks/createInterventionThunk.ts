import { createAsyncThunk } from "@reduxjs/toolkit";
import { auth } from "../../firebase/firebaseConfig";
import { createIntervention } from "../../firebase/interventionsService";
import type { Intervention } from "../features/newInterventionSlice";
import { addHistoryIntervention } from "../features/historySlice";

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createInterventionThunk = createAsyncThunk<
  Intervention,
  Intervention,
  { rejectValue: string }
>(
  "interventions/create",
  async (intervention, { dispatch, rejectWithValue }) => {
    try {
      await auth.authStateReady();
      const user = auth.currentUser;

      if (!user) return rejectWithValue("User not authenticated");

      const firestoreId = await createIntervention(
        user.uid,
        getLocalDate(),
        intervention,
      );

      const createdIntervention: Intervention = {
        ...intervention,
        documentId: firestoreId,
        dateKey: intervention.dateKey || getLocalDate(),
        createdAt: intervention.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEditing: false,
        isHistoryView: false,
        mode: "TODAY_EDIT",
      };

      dispatch(addHistoryIntervention(createdIntervention));
      return createdIntervention;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Unable to create intervention",
      );
    }
  },
);

export { createInterventionThunk };
