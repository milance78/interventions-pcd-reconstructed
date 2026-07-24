import type { Middleware } from "@reduxjs/toolkit";

import {
  clearDraftFromStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "../../localStorage/localStorage";
import {
  hasMeaningfulDraft,
  type Intervention,
  type InterventionData,
} from "../features/newInterventionSlice";

const currentData = (state: Intervention): InterventionData => ({
  documentId: "",
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
  createdAt: null,
  updatedAt: null,
  dateKey: undefined,
});

export const localStorageMiddleware: Middleware =
  (store) => (next) => (action) => {
    const result = next(action);
    const state = store.getState();
    const intervention = state?.newIntervention as Intervention | undefined;

    if (!intervention) return result;

    const draft = intervention.mode === "VIEW_HISTORY" ||
      intervention.mode === "SEARCH_EDIT" ||
      intervention.mode === "TODAY_EDIT"
      ? intervention.draftSnapshot
      : currentData(intervention);

    if (hasMeaningfulDraft(draft)) {
      saveDraftToStorage(draft);
    } else {
      clearDraftFromStorage();
    }

    return result;
  };

export { loadDraftFromStorage };
