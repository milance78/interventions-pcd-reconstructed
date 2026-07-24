import { createAsyncThunk } from "@reduxjs/toolkit";
import { auth } from "../../firebase/firebaseConfig";
import { deleteIntervention } from "../../firebase/interventionsService";
import { deleteLocalIntervention } from "../features/interventionsListSlice";
import { deleteHistoryIntervention } from "../features/historySlice";

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export type DeleteInterventionPayload = string | { documentId: string; dateKey: string };

const deleteInterventionThunk = createAsyncThunk<
  { documentId: string; dateKey: string },
  DeleteInterventionPayload,
  { rejectValue: string }
>("interventions/delete", async (payload, { dispatch, rejectWithValue }) => {
  try {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return rejectWithValue("User not authenticated");

    const documentId = typeof payload === "string" ? payload : payload.documentId;
    const dateKey = typeof payload === "string" ? getLocalDate() : payload.dateKey;
    if (!documentId) return rejectWithValue("Missing Firestore document ID");

    await deleteIntervention(user.uid, dateKey, documentId);
    if (dateKey === getLocalDate()) dispatch(deleteLocalIntervention(documentId));
    dispatch(deleteHistoryIntervention(documentId));
    return { documentId, dateKey };
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : "Unable to delete intervention");
  }
});

export { deleteInterventionThunk };
