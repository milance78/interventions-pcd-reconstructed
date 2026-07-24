import { createAsyncThunk } from "@reduxjs/toolkit";
import { auth } from "../../firebase/firebaseConfig";
import { updateIntervention } from "../../firebase/interventionsService";
import { updateLocalIntervention } from "../features/interventionsListSlice";
import { updateHistoryIntervention } from "../features/historySlice";
import type { Intervention } from "../features/newInterventionSlice";

const updateInterventionThunk = createAsyncThunk<
  Intervention,
  Intervention,
  { rejectValue: string }
>(
  "interventions/update",
  async (intervention, { dispatch, rejectWithValue }) => {
    try {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) return rejectWithValue("User not authenticated");

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const interventionDate = intervention.dateKey || today;

      if (!intervention.documentId) {
        return rejectWithValue("Missing Firestore document ID");
      }

      await updateIntervention(
        user.uid,
        interventionDate,
        intervention.documentId,
        intervention,
      );

      const updatedIntervention: Intervention = {
        ...intervention,
        isEditing: false,
        isHistoryView: false,
        mode: "TODAY_EDIT",
        updatedAt: new Date().toISOString(),
      };

      dispatch(updateLocalIntervention(updatedIntervention));
      dispatch(updateHistoryIntervention(updatedIntervention));
      return updatedIntervention;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Unable to update intervention",
      );
    }
  },
);

export { updateInterventionThunk };
