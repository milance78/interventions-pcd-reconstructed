import {
  useMemo,
  useRef,
  type ElementType,
  type ReactNode,
} from "react";
import Numbers from "@mui/icons-material/Numbers";
import {
  Contact,
  House,
  KeyRound,
  NotebookTabs,
  Pencil,
  PhoneCall,
  TextInitial,
  Trash2,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import "./HistoryPage.scss";

import AdditionalInformationDialog from "../../components/additionalInformationDialog/AdditionalInformationDialog";

import { ReactComponent as AddressConfirmedIcon } from "../../assets/svg/Address confirmed.svg.tsx";
import { ReactComponent as CIDIcon } from "../../assets/svg/CID.svg.tsx";
import { ReactComponent as IDIcon } from "../../assets/svg/ID.svg.tsx";
import { ReactComponent as LightBulbOnIcon } from "../../assets/svg/Light bulb on.svg.tsx";
import { ReactComponent as NAIcon } from "../../assets/svg/NA.svg.tsx";
import { ReactComponent as OAGIcon } from "../../assets/svg/OAG.svg.tsx";
import { ReactComponent as QuestionMarkOnIcon } from "../../assets/svg/Question mark on.svg.tsx";
import { ReactComponent as SnowOnIcon } from "../../assets/svg/Snow on.svg.tsx";

import { loadInterventionFromHistory } from "../../redux/features/newInterventionSlice";
import { useAppDispatch, useAppSelector } from "../../redux/store";
import { deleteInterventionThunk } from "../../redux/thunks/deleteInterventionThunk";
import type { Intervention } from "../../redux/features/newInterventionSlice";

const hasValue = (value?: string | null): value is string =>
  Boolean(value?.trim());

const displayInfrastructure = (value: string) => {
  if (value === "copper") return "cuivre";
  if (value === "fiber") return "fibre";

  return value;
};

const displayNetwork = (value: string) => {
  if (value === "otherOlo") return "autre OLO";
  if (value === "mobileVikings") return "Mobile Vikings";

  return value;
};

const displayStatus = (value: string) => {
  const labels: Record<string, string> = {
    "on hold": "en attente",
    completed: "terminé",
    transferred: "transmis",
    "consult M&P": "voir avec M&P",
    "closed by another agent": "fermé par un autre agent",
  };

  return labels[value] ?? value;
};

const getStatusClass = (status: string) =>
  status.replace(/\s+/g, "-").replace(/&/g, "").toLowerCase();

const BooleanIcon = ({ children }: { children: ReactNode }) => (
  <div className="history-boolean-icon">{children}</div>
);

type IconValueProps = {
  value: string;
  icon: ElementType;
  large?: boolean;
};

const IconValue = ({ value, icon: Icon, large = false }: IconValueProps) => (
  <div className="history-icon-field">
    <div
      className={`history-field-icon-box ${
        large ? "history-large-icon" : ""
      }`}
    >
      <Icon />
    </div>

    <span className="history-field-value">{value}</span>
  </div>
);

const StackedField = ({
  label,
  value,
}: {
  label: string;
  value?: string;
}) => (
  <div className="history-stacked-field">
    <div className="history-stacked-label">{label}</div>

    <div className="history-stacked-value">{value || "-"}</div>
  </div>
);

const convertToDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (typeof value === "object") {
    const possibleTimestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof possibleTimestamp.toDate === "function") {
      const timestampDate = possibleTimestamp.toDate();

      return Number.isNaN(timestampDate.getTime())
        ? null
        : timestampDate;
    }

    const seconds =
      possibleTimestamp.seconds ?? possibleTimestamp._seconds;

    if (typeof seconds === "number") {
      return new Date(seconds * 1000);
    }
  }

  return null;
};

const getInterventionDate = (intervention: unknown): Date | null => {
  const interventionRecord = intervention as Record<string, unknown>;

  const possibleDates = [
    interventionRecord.dateKey,
    interventionRecord.createdAt,
    interventionRecord.interventionDate,
    interventionRecord.date,
    interventionRecord.updatedAt,
    interventionRecord.timestamp,
  ];

  for (const possibleDate of possibleDates) {
    const convertedDate = convertToDate(possibleDate);

    if (convertedDate) {
      return convertedDate;
    }
  }

  return null;
};

const getActivityDate = (intervention: unknown): Date | null => {
  const interventionRecord = intervention as Record<string, unknown>;

  const possibleDates = [
    interventionRecord.updatedAt,
    interventionRecord.createdAt,
    interventionRecord.timestamp,
    interventionRecord.interventionDate,
    interventionRecord.date,
    interventionRecord.dateKey,
  ];

  for (const possibleDate of possibleDates) {
    const convertedDate = convertToDate(possibleDate);

    if (convertedDate) return convertedDate;
  }

  return null;
};

const getDateKey = (date: Date | null) => {
  if (!date) return "unknown-date";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateTitle = (date: Date | null) => {
  if (!date) return "Date inconnue";

  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatSidebarDate = (date: Date | null) => {
  if (!date) return "Date inconnue";

  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

const formatMonthTitle = (date: Date | null) => {
  if (!date) return "Sans date";

  return new Intl.DateTimeFormat("fr-BE", {
    month: "long",
    year: "numeric",
  }).format(date);
};

const capitalizeFirstLetter = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const HistoryPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const {
    interventions,
    isInitialized,
    isRefreshing,
    error: loadError,
  } = useAppSelector((state) => state.history);

  const isLoading = !isInitialized;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const dateSectionRefs = useRef<
    Record<string, HTMLElement | null>
  >({});

  const groupedInterventions = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        date: Date | null;
        interventions: typeof interventions;
      }
    >();

    interventions.forEach((intervention) => {
      const interventionDate = getInterventionDate(intervention);
      const dateKey = getDateKey(interventionDate);

      const currentGroup = groups.get(dateKey);

      if (currentGroup) {
        currentGroup.interventions.push(intervention);
      } else {
        groups.set(dateKey, {
          key: dateKey,
          date: interventionDate,
          interventions: [intervention],
        });
      }
    });

    groups.forEach((group) => {
      group.interventions.sort((firstIntervention, secondIntervention) => {
        const firstDate = getActivityDate(firstIntervention);
        const secondDate = getActivityDate(secondIntervention);

        if (!firstDate && !secondDate) return 0;
        if (!firstDate) return 1;
        if (!secondDate) return -1;

        return secondDate.getTime() - firstDate.getTime();
      });
    });

    return Array.from(groups.values()).sort((firstGroup, secondGroup) => {
      if (!firstGroup.date && !secondGroup.date) return 0;
      if (!firstGroup.date) return 1;
      if (!secondGroup.date) return -1;

      return secondGroup.date.getTime() - firstGroup.date.getTime();
    });
  }, [interventions]);

  const sidebarMonths = useMemo(() => {
    const months = new Map<
      string,
      {
        title: string;
        dates: typeof groupedInterventions;
      }
    >();

    groupedInterventions.forEach((group) => {
      const monthKey = group.date
        ? `${group.date.getFullYear()}-${group.date.getMonth()}`
        : "unknown-month";

      const existingMonth = months.get(monthKey);

      if (existingMonth) {
        existingMonth.dates.push(group);
      } else {
        months.set(monthKey, {
          title: capitalizeFirstLetter(
            formatMonthTitle(group.date),
          ),
          dates: [group],
        });
      }
    });

    return Array.from(months.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
  }, [groupedInterventions]);

  const scrollToDate = (dateKey: string) => {
    const scrollContainer = scrollContainerRef.current;
    const targetSection = dateSectionRefs.current[dateKey];

    if (!scrollContainer || !targetSection) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = targetSection.getBoundingClientRect();

    const startPosition = scrollContainer.scrollTop;
    const targetPosition =
      startPosition + targetRect.top - containerRect.top - 4;

    const distance = targetPosition - startPosition;
    const duration = 260;
    const startTime = performance.now();

    const animateScroll = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      const easedProgress =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      scrollContainer.scrollTop =
        startPosition + distance * easedProgress;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  };

  return (
    <main className="history-page">
      <div className="history-page-layout">
        <div
          ref={scrollContainerRef}
          className="history-content"
        >
          <header className="history-page-header">
            <div>
              <span className="history-page-eyebrow">
                Archives
              </span>

              <h1>Historique des interventions</h1>
            </div>

            <span
              className={`history-total ${isRefreshing ? "is-refreshing" : ""}`}
              title={isRefreshing ? "Actualisation en cours" : undefined}
            >
              {interventions.length} intervention
              {interventions.length === 1 ? "" : "s"}
            </span>
          </header>

          {isLoading && (
            <div className="history-empty">Chargement de l'historique…</div>
          )}

          {!isLoading && loadError && (
            <div className="history-empty">{loadError}</div>
          )}

          {!isLoading && !loadError && groupedInterventions.map((group) => (
            <section
              key={group.key}
              id={`history-${group.key}`}
              ref={(element) => {
                dateSectionRefs.current[group.key] = element;
              }}
              className="history-date-section"
            >
              <header className="history-date-header">
                <div>
                  <span className="history-date-marker" />

                  <h2>
                    {capitalizeFirstLetter(
                      formatDateTitle(group.date),
                    )}
                  </h2>
                </div>

                <span className="history-date-count">
                  {group.interventions.length}
                </span>
              </header>

              <div className="history-interventions-list">
                {group.interventions.map((intervention) => {
                  const statusClass = getStatusClass(
                    intervention.status,
                  );

                  return (
                    <article
                      key={
                        intervention.documentId ||
                        intervention.interventionId
                      }
                      className={`history-intervention-row status-${statusClass}`}
                    >
                      <div className="history-intervention-actions">
                        <button
                          type="button"
                          className="history-action-button history-edit-button"
                          aria-label="Modifier l'intervention"
                          title="Modifier"
                          onClick={() => {
                            dispatch(
                              loadInterventionFromHistory(intervention),
                            );

                            navigate("/intervention-en-cours");
                          }}
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          className="history-action-button history-delete-button"
                          aria-label="Supprimer l'intervention"
                          title="Supprimer"
                          onClick={async () => {
                            if (!intervention.documentId || !intervention.dateKey) return;

                            await dispatch(
                              deleteInterventionThunk({
                                documentId: intervention.documentId,
                                dateKey: intervention.dateKey,
                              }),
                            );
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                      <div className="history-column history-category-column">
                        <div className="history-category-section">
                          <span
                            className={`history-badge infrastructure ${
                              !hasValue(intervention.infrastructure)
                                ? "history-badge-empty"
                                : ""
                            }`}
                          >
                            {hasValue(intervention.infrastructure)
                              ? displayInfrastructure(
                                  intervention.infrastructure,
                                )
                              : "\u00A0"}
                          </span>

                          <span
                            className={`history-badge network ${
                              !hasValue(intervention.network)
                                ? "history-badge-empty"
                                : ""
                            }`}
                          >
                            {hasValue(intervention.network)
                              ? displayNetwork(intervention.network)
                              : "\u00A0"}
                          </span>

                          <span
                            className={`history-badge history-status status-${statusClass} ${
                              !hasValue(intervention.status)
                                ? "history-badge-empty"
                                : ""
                            }`}
                          >
                            {hasValue(intervention.status)
                              ? displayStatus(intervention.status)
                              : "\u00A0"}
                          </span>
                        </div>

                        <div className="history-flags-section">
                          {intervention.isUnclear && (
                            <BooleanIcon>
                              <QuestionMarkOnIcon />
                            </BooleanIcon>
                          )}

                          {intervention.isAddressConfirmed && (
                            <BooleanIcon>
                              <AddressConfirmedIcon />
                            </BooleanIcon>
                          )}

                          {intervention.isGoodExample && (
                            <BooleanIcon>
                              <LightBulbOnIcon />
                            </BooleanIcon>
                          )}

                          {intervention.isSnow && (
                            <BooleanIcon>
                              <SnowOnIcon />
                            </BooleanIcon>
                          )}
                        </div>
                      </div>

                      <div className="history-column history-identifiers-column">
                        {hasValue(intervention.interventionId) && (
                          <IconValue
                            value={intervention.interventionId}
                            icon={IDIcon}
                          />
                        )}

                        {hasValue(intervention.na) && (
                          <IconValue
                            value={intervention.na}
                            icon={NAIcon}
                            large
                          />
                        )}

                        {hasValue(intervention.oagID) && (
                          <IconValue
                            value={intervention.oagID}
                            icon={OAGIcon}
                            large
                          />
                        )}

                        {hasValue(intervention.clientName) && (
                          <IconValue
                            value={intervention.clientName}
                            icon={UserRound}
                          />
                        )}

                        {hasValue(
                          intervention.interventionDescription,
                        ) && (
                          <IconValue
                            value={
                              intervention.interventionDescription
                            }
                            icon={TextInitial}
                          />
                        )}

                        {hasValue(intervention.LOMKey) && (
                          <IconValue
                            value={intervention.LOMKey}
                            icon={KeyRound}
                          />
                        )}

                        {hasValue(intervention.mainAddress) && (
                          <IconValue
                            value={intervention.mainAddress}
                            icon={House}
                          />
                        )}

                        {hasValue(intervention.clientID) && (
                          <IconValue
                            value={intervention.clientID}
                            icon={Contact}
                          />
                        )}

                        {hasValue(intervention.cid) && (
                          <IconValue
                            value={intervention.cid}
                            icon={CIDIcon}
                            large
                          />
                        )}

                        {hasValue(intervention.phone) && (
                          <IconValue
                            value={intervention.phone}
                            icon={PhoneCall}
                          />
                        )}

                        {hasValue(intervention.addressDetails) && (
                          <IconValue
                            value={intervention.addressDetails}
                            icon={NotebookTabs}
                          />
                        )}

                        {hasValue(intervention.snowReference) && (
                          <IconValue
                            value={intervention.snowReference}
                            icon={Numbers}
                          />
                        )}
                      </div>

                      <div className="history-column history-text-column">
                        <StackedField
                          label="Clients à l'adresse"
                          value={intervention.clientsOnAddress}
                        />
                      </div>

                      <div className="history-column history-text-column">
                        <StackedField
                          label="Commentaire"
                          value={intervention.comment}
                        />

                        {hasValue(intervention.additionalInformation) && (
                          <AdditionalInformationDialog
                            value={intervention.additionalInformation}
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {!isLoading && !loadError && interventions.length === 0 && (
            <div className="history-empty">
              <div className="history-empty-icon">H</div>

              <h2>Aucune intervention disponible</h2>

              <p>
                Les interventions enregistrées apparaîtront ici,
                regroupées par date.
              </p>
            </div>
          )}
        </div>

        <aside className="history-sidebar">
          <div className="history-sidebar-inner">
            <div className="history-sidebar-heading">
              <span>Navigation</span>
              <h2>Dates</h2>
            </div>

            <nav className="history-date-navigation">
              {sidebarMonths.map((month) => (
                <div
                  key={month.key}
                  className="history-sidebar-month"
                >
                  <h3>{month.title}</h3>

                  <div className="history-sidebar-dates">
                    {month.dates.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => scrollToDate(group.key)}
                      >
                        <span>
                          {capitalizeFirstLetter(
                            formatSidebarDate(group.date),
                          )}
                        </span>

                        <strong>
                          {group.interventions.length}
                        </strong>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default HistoryPage;
