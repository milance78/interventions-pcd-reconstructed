import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Intervention } from "./newInterventionSlice";

type HistoryState = {
  interventions: Intervention[];
  isInitialized: boolean;
  isRefreshing: boolean;
  error: string;
};

const initialState: HistoryState = {
  interventions: [],
  isInitialized: false,
  isRefreshing: false,
  error: "",
};

const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    startHistoryRefresh: (state) => {
      state.isRefreshing = true;
      state.error = "";
    },
    setHistory: (state, action: PayloadAction<Intervention[]>) => {
      state.interventions = action.payload;
      state.isInitialized = true;
      state.isRefreshing = false;
      state.error = "";
    },
    setHistoryError: (state, action: PayloadAction<string>) => {
      state.isInitialized = true;
      state.isRefreshing = false;
      state.error = action.payload;
    },
    clearHistory: (state) => {
      state.interventions = [];
      state.isInitialized = true;
      state.isRefreshing = false;
      state.error = "";
    },
    addHistoryIntervention: (state, action: PayloadAction<Intervention>) => {
      const exists = state.interventions.some(
        (item) => item.documentId === action.payload.documentId,
      );

      if (!exists) {
        state.interventions.push(action.payload);
      }
    },
    updateHistoryIntervention: (
      state,
      action: PayloadAction<Intervention>,
    ) => {
      const index = state.interventions.findIndex(
        (item) => item.documentId === action.payload.documentId,
      );

      if (index !== -1) {
        state.interventions[index] = action.payload;
      }
    },
    deleteHistoryIntervention: (state, action: PayloadAction<string>) => {
      state.interventions = state.interventions.filter(
        (item) => item.documentId !== action.payload,
      );
    },
  },
});

export const {
  addHistoryIntervention,
  clearHistory,
  deleteHistoryIntervention,
  setHistory,
  setHistoryError,
  startHistoryRefresh,
  updateHistoryIntervention,
} = historySlice.actions;

export default historySlice.reducer;
