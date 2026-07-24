import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import newInterventionReducer, {
  loadDraft,
} from "./features/newInterventionSlice";
import interventionsListReducer from "./features/interventionsListSlice";
import statisticsReducer from "./features/statisticsSlice";
import historyReducer from "./features/historySlice";
import {
  loadDraftFromStorage,
  localStorageMiddleware,
} from "./middleware/localStorageMiddleware";
export const store = configureStore({
  reducer: {
    newIntervention: newInterventionReducer,
    interventionsList: interventionsListReducer,
    statistics: statisticsReducer,
    history: historyReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(localStorageMiddleware),
});
const savedDraft = loadDraftFromStorage();
if (savedDraft) {
  store.dispatch(loadDraft(savedDraft));
}
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
