import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebaseConfig";
import type { Intervention, InterventionData } from "../redux/features/newInterventionSlice";

const getDayReference = (userId: string, date: string) =>
  doc(db, "users", userId, "days", date);
const getInterventionsReference = (userId: string, date: string) =>
  collection(db, "users", userId, "days", date, "interventions");
const getSummaryReference = (userId: string, date: string) =>
  doc(db, "users", userId, "days", date, "summary", "daily");
const getActiveReference = (userId: string) =>
  collection(db, "users", userId, "activeInterventions");
const getVersionsReference = (userId: string, caseId: string) =>
  collection(db, "users", userId, "interventionVersions", caseId, "versions");

const convertTimestampToString = (timestamp: any): string | null => {
  if (!timestamp) return null;
  if (typeof timestamp === "string") return timestamp;
  return typeof timestamp.toDate === "function"
    ? timestamp.toDate().toISOString()
    : String(timestamp);
};

const normalizeLegacyFields = (data: Record<string, any>): Record<string, any> => ({
  ...data,
  comment: data.comment ?? data.commentaire ?? "",
  additionalInformation:
    data.additionalInformation ?? data.informationsSupplementaires ?? "",
});

const mapIntervention = (
  documentId: string,
  dateKey: string,
  rawData: Record<string, any>,
): Intervention => {
  const data = normalizeLegacyFields(rawData);
  const { createdAt, updatedAt, ...interventionData } = data;
  return {
    ...interventionData,
    documentId,
    dateKey,
    createdAt: convertTimestampToString(createdAt),
    updatedAt: convertTimestampToString(updatedAt),
    isEditing: false,
    isHistoryView: false,
    mode: "VIEW_HISTORY",
    draftSnapshot: null,
    hasDraft: false,
  } as Intervention;
};

const stripUiFields = (intervention: Intervention) => {
  const {
    documentId: _documentId,
    isEditing: _isEditing,
    isHistoryView: _isHistoryView,
    mode: _mode,
    draftSnapshot: _draftSnapshot,
    hasDraft: _hasDraft,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    dateKey: _dateKey,
    ...interventionData
  } = intervention;
  return interventionData;
};

const activityValue = (intervention: Intervention) =>
  intervention.updatedAt ?? intervention.createdAt ?? intervention.dateKey ?? "";

const logicalKey = (intervention: Intervention) => {
  const interventionId = intervention.interventionId?.trim().toLowerCase();
  if (interventionId) return `intervention:${interventionId}`;
  const oagId = intervention.oagID?.trim().toLowerCase();
  if (oagId) return `oag:${oagId}`;
  return `document:${intervention.documentId}`;
};

const updateSummaryInBackground = (userId: string, date: string) => {
  void recalculateDailySummary(userId, date).catch((error) => {
    console.error("Daily summary update failed:", error);
  });
};

const writeVersion = (
  batch: ReturnType<typeof writeBatch>,
  userId: string,
  caseId: string,
  dateKey: string,
  data: Record<string, any>,
  source: "CREATE" | "TODAY_EDIT" | "SEARCH_EDIT",
) => {
  const versionRef = doc(getVersionsReference(userId, caseId));
  batch.set(versionRef, {
    caseId,
    dateKey,
    source,
    savedAt: serverTimestamp(),
    data,
  });
};

export const createIntervention = async (
  userId: string,
  date: string,
  intervention: Intervention,
) => {
  const snapshotRef = doc(getInterventionsReference(userId, date));
  const caseId = snapshotRef.id;
  const activeRef = doc(getActiveReference(userId), caseId);
  const batch = writeBatch(db);
  const data = stripUiFields(intervention);

  batch.set(getDayReference(userId, date), { date, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(snapshotRef, { ...data, caseId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(activeRef, { ...data, caseId, currentDateKey: date, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  writeVersion(batch, userId, caseId, date, data, "CREATE");
  await batch.commit();

  updateSummaryInBackground(userId, date);
  return caseId;
};

export const loadInterventions = async (userId: string, date: string): Promise<Intervention[]> => {
  const snapshot = await getDocs(getInterventionsReference(userId, date));
  return snapshot.docs.map((item) => mapIntervention(item.data().caseId ?? item.id, date, item.data()));
};

export interface HistoryDay {
  dateKey: string;
  interventions: Intervention[];
}

export const loadCompleteHistory = async (userId: string): Promise<HistoryDay[]> => {
  const daysSnapshot = await getDocs(collection(db, "users", userId, "days"));
  const days = await Promise.all(
    daysSnapshot.docs.map(async (dayDocument) => ({
      dateKey: dayDocument.id,
      interventions: await loadInterventions(userId, dayDocument.id),
    })),
  );
  return days
    .filter((day) => day.interventions.length > 0)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};

export const deleteIntervention = async (userId: string, date: string, documentId: string) => {
  await deleteDoc(doc(getInterventionsReference(userId, date), documentId));
  await setDoc(getDayReference(userId, date), { date, updatedAt: serverTimestamp() }, { merge: true });
  updateSummaryInBackground(userId, date);
};

export const updateIntervention = async (
  userId: string,
  date: string,
  documentId: string,
  intervention: Intervention,
) => {
  const snapshotRef = doc(getInterventionsReference(userId, date), documentId);
  const snapshot = await getDoc(snapshotRef);
  const caseId = snapshot.exists() ? snapshot.data().caseId ?? documentId : documentId;
  const activeRef = doc(getActiveReference(userId), caseId);
  const data = stripUiFields(intervention);
  const batch = writeBatch(db);

  batch.set(snapshotRef, { ...data, caseId, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(activeRef, { ...data, caseId, currentDateKey: date, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(getDayReference(userId, date), { date, updatedAt: serverTimestamp() }, { merge: true });
  writeVersion(batch, userId, caseId, date, data, "TODAY_EDIT");
  await batch.commit();
  updateSummaryInBackground(userId, date);
};

export interface InterventionRevision {
  revisionId: string;
  changedAt: string | null;
  previousDateKey: string;
  snapshot: InterventionData;
}

export const loadInterventionRevisions = async (
  userId: string,
  documentId: string,
  interventionId = "",
  oagID = "",
): Promise<InterventionRevision[]> => {
  const versionsSnapshot = await getDocs(getVersionsReference(userId, documentId));
  const versions = versionsSnapshot.docs.map((item) => {
    const raw = item.data();
    const data = normalizeLegacyFields(raw.data ?? raw.snapshot ?? {});
    return {
      revisionId: item.id,
      changedAt: convertTimestampToString(raw.savedAt ?? raw.changedAt),
      previousDateKey: raw.dateKey ?? raw.previousDateKey ?? "",
      snapshot: { ...data, documentId, dateKey: raw.dateKey ?? raw.previousDateKey ?? "" } as InterventionData,
    };
  });

  const history = await loadCompleteHistory(userId);
  const normalizedInterventionId = interventionId.trim().toLowerCase();
  const normalizedOagId = oagID.trim().toLowerCase();
  const legacy = history
    .flatMap((day) => day.interventions)
    .filter((item) => {
      if (item.documentId === documentId) return true;
      if (normalizedInterventionId && item.interventionId?.trim().toLowerCase() === normalizedInterventionId) return true;
      return Boolean(normalizedOagId && item.oagID?.trim().toLowerCase() === normalizedOagId);
    })
    .map((item) => ({
      revisionId: `legacy-${item.dateKey}-${item.documentId}`,
      changedAt: item.updatedAt ?? item.createdAt,
      previousDateKey: item.dateKey ?? "",
      snapshot: item as InterventionData,
    }));

  const unique = new Map<string, InterventionRevision>();
  [...versions, ...legacy].forEach((revision) => {
    const key = `${revision.previousDateKey}-${revision.changedAt}-${revision.snapshot.comment}-${revision.snapshot.additionalInformation}`;
    if (!unique.has(key)) unique.set(key, revision);
  });
  return Array.from(unique.values()).sort((a, b) => (b.changedAt ?? b.previousDateKey).localeCompare(a.changedAt ?? a.previousDateKey));
};

export const updateSearchInterventionAndMoveToToday = async (
  userId: string,
  originalDate: string,
  today: string,
  intervention: Intervention,
): Promise<Intervention> => {
  if (!intervention.documentId) throw new Error("Missing Firestore document ID");

  const caseId = intervention.documentId;
  const activeRef = doc(getActiveReference(userId), caseId);
  const activeSnapshot = await getDoc(activeRef);
  const currentData: Record<string, any> = activeSnapshot.exists()
    ? activeSnapshot.data()
    : stripUiFields(intervention);
  const todaySnapshotRef = doc(getInterventionsReference(userId, today), caseId);
  const data = stripUiFields(intervention);
  const batch = writeBatch(db);

  // The old day snapshot is intentionally never deleted or overwritten.
  batch.set(todaySnapshotRef, {
    ...data,
    caseId,
    createdAt: currentData.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(activeRef, {
    ...data,
    caseId,
    currentDateKey: today,
    createdAt: currentData.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(getDayReference(userId, today), { date: today, updatedAt: serverTimestamp() }, { merge: true });
  writeVersion(batch, userId, caseId, today, data, "SEARCH_EDIT");
  await batch.commit();

  updateSummaryInBackground(userId, today);
  const now = new Date().toISOString();
  return {
    ...intervention,
    documentId: caseId,
    dateKey: today,
    updatedAt: now,
    createdAt: convertTimestampToString(currentData.createdAt) ?? intervention.createdAt,
    isEditing: false,
    isHistoryView: true,
    mode: "VIEW_HISTORY",
  };
};

export const recalculateDailySummary = async (userId: string, date: string) => {
  const snapshot = await getDocs(getInterventionsReference(userId, date));
  const summary = { total: 0, completed: 0, onHold: 0, transferred: 0, closedByAnotherAgent: 0, lastUpdated: null as null | ReturnType<typeof serverTimestamp> };
  snapshot.docs.forEach((documentSnapshot) => {
    const intervention = documentSnapshot.data();
    summary.total += 1;
    switch (intervention.status) {
      case "completed": summary.completed += 1; break;
      case "on hold": summary.onHold += 1; break;
      case "transferred": summary.transferred += 1; break;
      case "closed by another agent": summary.closedByAnotherAgent += 1; break;
      default: break;
    }
  });
  await setDoc(getSummaryReference(userId, date), { ...summary, lastUpdated: serverTimestamp() }, { merge: true });
};

export const loadDailySummary = async (userId: string, date: string) => {
  const snapshot = await getDoc(getSummaryReference(userId, date));
  return snapshot.exists() ? snapshot.data() : null;
};

const loadOrBuildActiveInterventions = async (userId: string): Promise<Intervention[]> => {
  const activeSnapshot = await getDocs(getActiveReference(userId));
  const active = activeSnapshot.docs.map((item) => {
    const data = item.data();
    return mapIntervention(item.id, data.currentDateKey ?? "", data);
  });

  // Non-destructive compatibility migration: dated legacy snapshots stay untouched.
  // We merge them with the new active collection, so old data remains searchable even
  // after the user has already created records in the V2 structure.
  const history = (await loadCompleteHistory(userId)).flatMap((day) => day.interventions);
  const latestByLogicalKey = new Map<string, Intervention>();

  [...history, ...active].forEach((item) => {
    const key = logicalKey(item);
    const current = latestByLogicalKey.get(key);
    if (!current || activityValue(item) > activityValue(current)) {
      latestByLogicalKey.set(key, item);
    }
  });

  const activeCaseIds = new Set(active.map((item) => item.documentId));
  const missingFromActive = Array.from(latestByLogicalKey.values()).filter(
    (item) => !activeCaseIds.has(item.documentId),
  );

  if (missingFromActive.length > 0) {
    const batch = writeBatch(db);
    missingFromActive.forEach((item) => {
      const caseId = item.documentId;
      batch.set(doc(getActiveReference(userId), caseId), {
        ...stripUiFields(item),
        caseId,
        currentDateKey: item.dateKey ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt ?? item.createdAt,
        migratedFromLegacy: true,
      }, { merge: true });
    });
    await batch.commit();
  }

  return Array.from(latestByLogicalKey.values());
};

export const searchInterventions = async (userId: string, searchValue: string): Promise<Intervention[]> => {
  const normalizedSearchValue = searchValue.trim().toLowerCase();
  if (!normalizedSearchValue) return [];
  const active = await loadOrBuildActiveInterventions(userId);
  return active
    .filter((intervention) => {
      const interventionId = intervention.interventionId?.trim().toLowerCase() ?? "";
      const oagId = intervention.oagID?.trim().toLowerCase() ?? "";
      return interventionId === normalizedSearchValue || oagId === normalizedSearchValue;
    })
    .sort((first, second) => activityValue(second).localeCompare(activityValue(first)));
};
