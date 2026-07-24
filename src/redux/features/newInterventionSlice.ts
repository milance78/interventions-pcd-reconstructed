import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type InterventionMode =
  | "NEW"
  | "DRAFT"
  | "VIEW_HISTORY"
  | "SEARCH_EDIT"
  | "TODAY_EDIT";

export interface InterventionData {
  documentId: string;
  interventionId: string;
  network: string;
  infrastructure: string;
  oagID: string;
  na: string;
  cid: string;
  clientName: string;
  interventionDescription: string;
  clientID: string;
  mainAddress: string;
  addressDetails: string;
  mailbox: string;
  floor: string;
  apartment: string;
  blockNumber: string;
  clientsOnAddress: string;
  LOMKey: string;
  phone: string;
  displayAllFields: boolean;
  snowReference: string;
  isUnclear: boolean;
  isAddressConfirmed: boolean;
  isGoodExample: boolean;
  isSnow: boolean;
  comment: string;
  additionalInformation: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  dateKey?: string;
}

export interface Intervention extends InterventionData {
  isEditing: boolean;
  isHistoryView: boolean;
  mode: InterventionMode;
  draftSnapshot: InterventionData | null;
  hasDraft: boolean;
}

export type InterventionField = keyof InterventionData;

interface UpdateFieldPayload {
  field: InterventionField;
  value: InterventionData[InterventionField];
}

type ImportedDataPayload = Partial<InterventionData>;

export const emptyInterventionData: InterventionData = {
  documentId: "",
  interventionId: "",
  network: "",
  infrastructure: "",
  oagID: "",
  na: "",
  cid: "",
  clientName: "",
  interventionDescription: "",
  clientID: "",
  mainAddress: "",
  addressDetails: "",
  mailbox: "",
  floor: "",
  apartment: "",
  blockNumber: "",
  clientsOnAddress: "",
  LOMKey: "",
  phone: "",
  displayAllFields: false,
  snowReference: "",
  isUnclear: false,
  isAddressConfirmed: false,
  isGoodExample: false,
  isSnow: false,
  comment: "",
  additionalInformation: "",
  status: "",
  createdAt: null,
  updatedAt: null,
};

export const hasMeaningfulDraft = (
  intervention: Partial<InterventionData> | null | undefined,
) => {
  if (!intervention) return false;

  return Object.entries(intervention).some(([key, value]) => {
    if (
      key === "documentId" ||
      key === "createdAt" ||
      key === "updatedAt" ||
      key === "dateKey" ||
      key === "displayAllFields"
    ) {
      return false;
    }

    if (typeof value === "boolean") return value;
    return typeof value === "string" && value.trim().length > 0;
  });
};

const extractData = (state: Intervention): InterventionData => ({
  documentId: state.documentId,
  interventionId: state.interventionId,
  network: state.network,
  infrastructure: state.infrastructure,
  oagID: state.oagID,
  na: state.na,
  cid: state.cid,
  clientName: state.clientName,
  interventionDescription: state.interventionDescription,
  clientID: state.clientID,
  mainAddress: state.mainAddress,
  addressDetails: state.addressDetails,
  mailbox: state.mailbox,
  floor: state.floor,
  apartment: state.apartment,
  blockNumber: state.blockNumber,
  clientsOnAddress: state.clientsOnAddress,
  LOMKey: state.LOMKey,
  phone: state.phone,
  displayAllFields: state.displayAllFields,
  snowReference: state.snowReference,
  isUnclear: state.isUnclear,
  isAddressConfirmed: state.isAddressConfirmed,
  isGoodExample: state.isGoodExample,
  isSnow: state.isSnow,
  comment: state.comment,
  additionalInformation: state.additionalInformation,
  status: state.status,
  createdAt: state.createdAt,
  updatedAt: state.updatedAt,
  dateKey: state.dateKey,
});

const captureCurrentDraft = (state: Intervention) => {
  if (state.mode !== "NEW" && state.mode !== "DRAFT") {
    return {
      draftSnapshot: state.draftSnapshot,
      hasDraft: state.hasDraft,
    };
  }

  const currentDraft = extractData(state);
  const hasDraft = hasMeaningfulDraft(currentDraft);

  return {
    hasDraft,
    draftSnapshot: hasDraft
      ? {
          ...currentDraft,
          documentId: "",
          createdAt: null,
          updatedAt: null,
          dateKey: undefined,
        }
      : null,
  };
};

export const initialState: Intervention = {
  ...emptyInterventionData,
  isEditing: false,
  isHistoryView: false,
  mode: "NEW",
  draftSnapshot: null,
  hasDraft: false,
};

const NewInterventionSlice = createSlice({
  name: "newIntervention",
  initialState,
  reducers: {
    updateField: (state, action: PayloadAction<UpdateFieldPayload>) => {
      if (state.mode === "VIEW_HISTORY") return;

      const { field, value } = action.payload;
      (
        state as unknown as Record<
          InterventionField,
          InterventionData[InterventionField]
        >
      )[field] = value;

      if (state.mode === "NEW" || state.mode === "DRAFT") {
        const draft = extractData(state);
        state.hasDraft = hasMeaningfulDraft(draft);
        state.mode = state.hasDraft ? "DRAFT" : "NEW";
        state.draftSnapshot = state.hasDraft
          ? {
              ...draft,
              documentId: "",
              createdAt: null,
              updatedAt: null,
              dateKey: undefined,
            }
          : null;
      }
    },

    applyImportedData: (state, action: PayloadAction<ImportedDataPayload>) => {
      if (state.mode === "VIEW_HISTORY") return;

      for (const [key, value] of Object.entries(action.payload)) {
        if (value === undefined || value === null) continue;
        const field = key as InterventionField;
        (state as unknown as Record<string, unknown>)[field] = value;
      }

      if (state.mode === "NEW" || state.mode === "DRAFT") {
        const draft = extractData(state);
        state.hasDraft = hasMeaningfulDraft(draft);
        state.mode = state.hasDraft ? "DRAFT" : "NEW";
        state.draftSnapshot = state.hasDraft
          ? {
              ...draft,
              documentId: "",
              createdAt: null,
              updatedAt: null,
              dateKey: undefined,
            }
          : null;
      }
    },

    loadInterventionForEdit: (
      state,
      action: PayloadAction<Intervention>,
    ): Intervention => ({
      ...initialState,
      ...action.payload,
      isEditing: true,
      isHistoryView: false,
      mode: "TODAY_EDIT",
      draftSnapshot: state.draftSnapshot,
      hasDraft: state.hasDraft,
    }),

    loadInterventionFromHistory: (
      state,
      action: PayloadAction<Intervention>,
    ): Intervention => {
      const draftState = captureCurrentDraft(state);

      return {
        ...initialState,
        ...action.payload,
        isEditing: false,
        isHistoryView: true,
        mode: "VIEW_HISTORY",
        ...draftState,
      };
    },

    loadInterventionFromSearch: (
      state,
      action: PayloadAction<Intervention>,
    ): Intervention => {
      const draftState = captureCurrentDraft(state);

      return {
        ...initialState,
        ...action.payload,
        isEditing: true,
        isHistoryView: false,
        mode: "SEARCH_EDIT",
        ...draftState,
      };
    },

    markSearchInterventionSaved: (
      state,
      action: PayloadAction<Intervention>,
    ): Intervention => ({
      ...initialState,
      ...action.payload,
      isEditing: false,
      isHistoryView: true,
      mode: "VIEW_HISTORY",
      draftSnapshot: state.draftSnapshot,
      hasDraft: state.hasDraft,
    }),

    loadDraft: (
      _state,
      action: PayloadAction<Partial<InterventionData>>,
    ): Intervention => {
      const draft = {
        ...emptyInterventionData,
        ...action.payload,
        documentId: "",
        createdAt: null,
        updatedAt: null,
        dateKey: undefined,
      };
      const hasDraft = hasMeaningfulDraft(draft);

      return {
        ...initialState,
        ...draft,
        mode: hasDraft ? "DRAFT" : "NEW",
        draftSnapshot: hasDraft ? draft : null,
        hasDraft,
      };
    },

    resumeDraft: (state): Intervention => {
      const draft = state.draftSnapshot;
      if (!draft || !hasMeaningfulDraft(draft)) {
        return { ...initialState };
      }

      return {
        ...initialState,
        ...draft,
        mode: "DRAFT",
        draftSnapshot: draft,
        hasDraft: true,
      };
    },

    startNewIntervention: (): Intervention => ({ ...initialState }),
    clearTask: (): Intervention => ({ ...initialState }),
  },
});

export const {
  applyImportedData,
  clearTask,
  loadDraft,
  loadInterventionForEdit,
  loadInterventionFromHistory,
  loadInterventionFromSearch,
  markSearchInterventionSaved,
  resumeDraft,
  startNewIntervention,
  updateField,
} = NewInterventionSlice.actions;

export { NewInterventionSlice };
export default NewInterventionSlice.reducer;
